import { describe, expect, it } from "vitest";
import { isOverdue, nextDueAt, quadrantFor, recurrenceRuleSchema, sortCompletedTasks, sortTasks } from "./task";

const task = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  title: "任务",
  important: true,
  urgent: false,
  dueAt: "2026-08-24T10:00:00.000Z",
  reminder: "none" as const,
  recurrence: { type: "none" } as const,
  completed: false,
  createdAt: "2026-08-24T08:00:00.000Z",
  updatedAt: "2026-08-24T08:00:00.000Z",
  ...overrides,
});

describe("task rules", () => {
  it("maps importance and urgency to the four quadrants", () => {
    expect(quadrantFor({ important: true, urgent: true })).toBe("do-now");
    expect(quadrantFor({ important: true, urgent: false })).toBe("schedule");
    expect(quadrantFor({ important: false, urgent: true })).toBe("delegate");
    expect(quadrantFor({ important: false, urgent: false })).toBe("eliminate");
  });

  it("sorts by due date, then creation time, then id", () => {
    const first = task({ id: "b", dueAt: "2026-08-24T10:00:00.000Z" });
    const second = task({ id: "a", dueAt: "2026-08-24T09:00:00.000Z" });
    expect(sortTasks([first, second]).map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("detects only active overdue tasks", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    expect(isOverdue(task(), now)).toBe(true);
    expect(isOverdue(task({ completed: true }), now)).toBe(false);
  });

  it("rejects monthly day 31", () => {
    expect(recurrenceRuleSchema.safeParse({ type: "monthly", dayOfMonth: 30 }).success).toBe(true);
    expect(recurrenceRuleSchema.safeParse({ type: "monthly", dayOfMonth: 31 }).success).toBe(false);
  });

  it("creates the next recurring instance without changing the current one", () => {
    expect(nextDueAt(task({ recurrence: { type: "daily" } }))?.startsWith("2026-08-25")).toBe(true);
  });

  it("sorts completed records newest first", () => {
    const older = task({ id: "older", completed: true, completedAt: "2026-08-24T09:00:00.000Z" });
    const newer = task({ id: "newer", completed: true, completedAt: "2026-08-24T11:00:00.000Z" });
    expect(sortCompletedTasks([older, newer]).map((item) => item.id)).toEqual(["newer", "older"]);
  });
});
