import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskRuntime } from "./taskRuntime";
import type { TaskFile } from "../../shared/task";

const task = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  seriesId: "series-1",
  title: "提醒我",
  important: true,
  urgent: true,
  dueAt: "2026-08-24T10:00",
  reminder: "none" as const,
  recurrence: { type: "daily" } as const,
  completed: false,
  createdAt: "2026-08-24T08:00:00.000Z",
  updatedAt: "2026-08-24T08:00:00.000Z",
  ...overrides,
});

describe("TaskRuntime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 25, 12, 0));
  });

  it("loads recurring instances and schedules once for hidden startup", async () => {
    const loaded: TaskFile = { version: 1, tasks: [task()] };
    const taskFile = { load: vi.fn().mockResolvedValue(loaded), save: vi.fn().mockResolvedValue(undefined) };
    const scheduler = { reschedule: vi.fn(), dispose: vi.fn() };
    const runtime = new TaskRuntime(taskFile, scheduler);

    const first = await runtime.loadAndSchedule();
    const second = await runtime.loadAndSchedule();

    expect(first).toHaveLength(2);
    expect(second).toBe(first);
    expect(taskFile.load).toHaveBeenCalledTimes(1);
    expect(taskFile.save).toHaveBeenCalledTimes(1);
    expect(scheduler.reschedule).toHaveBeenCalledTimes(1);
    expect(new Set(first.map((item) => item.dueAt))).toEqual(new Set(["2026-08-24T10:00", "2026-08-25T10:00"]));
    vi.useRealTimers();
  });

  it("disposes scheduling and preserves the load error for corrupted data", async () => {
    const error = new Error("任务数据文件损坏或版本不受支持");
    const taskFile = { load: vi.fn().mockRejectedValue(error), save: vi.fn() };
    const scheduler = { reschedule: vi.fn(), dispose: vi.fn() };
    const runtime = new TaskRuntime(taskFile, scheduler);

    await expect(runtime.loadAndSchedule()).rejects.toThrow(error.message);
    expect(scheduler.dispose).toHaveBeenCalledTimes(1);
    expect(scheduler.reschedule).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
