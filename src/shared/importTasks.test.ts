import { describe, expect, it } from "vitest";
import { findImportConflicts, mergeImportedTasks } from "./importTasks";
import type { TaskInstance } from "./task";

function task(overrides: Partial<TaskInstance> = {}): TaskInstance {
  return {
    id: "task-1",
    title: "整理资料",
    important: true,
    urgent: false,
    dueAt: "2026-08-25T10:00",
    reminder: "none",
    recurrence: { type: "none" },
    completed: false,
    createdAt: "2026-08-25T08:00:00.000Z",
    updatedAt: "2026-08-25T08:00:00.000Z",
    ...overrides,
  };
}

describe("import conflict handling", () => {
  it("detects ID and normalized content conflicts", () => {
    const current = [task(), task({ id: "other", title: "另一个任务" })];
    const incoming = [task({ title: "新标题" }), task({ id: "new-id", title: "  另一个任务 " })];
    expect(findImportConflicts(current, incoming).map((conflict) => conflict.reason)).toEqual(["id", "content"]);
  });

  it("supports keep, overwrite and duplicate choices atomically", () => {
    const current = [task(), task({ id: "content-current", title: "保留这条" })];
    const incoming = [
      task({ title: "覆盖标题" }),
      task({ id: "incoming-copy", title: "保留这条" }),
    ];
    const merged = mergeImportedTasks(current, incoming, {
      "id:task-1": "overwrite",
      "content:incoming-copy": "duplicate",
    }, () => "generated-id");

    expect(merged.result).toEqual({ canceled: false, added: 0, overwritten: 1, kept: 0, skipped: 0, duplicated: 1 });
    expect(merged.tasks.map((item) => item.id)).toEqual(["task-1", "content-current", "generated-id"]);
    expect(merged.tasks.find((item) => item.id === "task-1")?.title).toBe("覆盖标题");
  });

  it("remaps every imported instance in a duplicated series", () => {
    const current = [task({ id: "series-root", title: "旧版本" })];
    const incoming = [
      task({ id: "series-root", seriesId: "series-root", title: "新版本", recurrence: { type: "daily" } }),
      task({ id: "series-next", seriesId: "series-root", title: "新版本", dueAt: "2026-08-26T10:00", recurrence: { type: "daily" } }),
    ];
    const merged = mergeImportedTasks(current, incoming, { "id:series-root": "duplicate" }, () => "generated");
    const imported = merged.tasks.filter((item) => item.title === "新版本");
    expect(new Set(imported.map((item) => item.seriesId)).size).toBe(1);
    expect(imported[0].seriesId).toBe("generated");
    expect(imported.map((item) => item.id)).toEqual(["generated", "series-next"]);
  });
});
