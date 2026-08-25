import * as fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskFileService } from "./taskFile";
import { formatLocalDateTime } from "../../shared/task";

const createdDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirectories.splice(0).map((directory) => fsPromises.rm(directory, { recursive: true, force: true })));
});

describe("TaskFileService", () => {
  it("returns an empty versioned file when no data exists", async () => {
    const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), "kairos-task-file-"));
    createdDirectories.push(directory);
    const service = new TaskFileService(directory);

    await expect(service.load()).resolves.toEqual({ version: 1, tasks: [] });
  });

  it("saves and loads a versioned JSON file", async () => {
    const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), "kairos-task-file-"));
    createdDirectories.push(directory);
    const service = new TaskFileService(directory);
    const task = {
      id: "task-1",
      title: "备份数据",
      important: true,
      urgent: false,
      dueAt: "2026-08-24T10:00",
      reminder: "none" as const,
      recurrence: { type: "none" } as const,
      completed: false,
      createdAt: "2026-08-24T08:00:00.000Z",
      updatedAt: "2026-08-24T08:00:00.000Z",
    };

    await service.save([task]);
    await expect(service.load()).resolves.toEqual({ version: 1, tasks: [task] });
    await expect(fsPromises.readFile(service.path, "utf8")).resolves.toContain('"version": 1');
  });

  it("rejects malformed data", async () => {
    const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), "kairos-task-file-"));
    createdDirectories.push(directory);
    const service = new TaskFileService(directory);
    const original = "{\"version\":1,\"tasks\":[{\"bad\":true}]}";
    await fsPromises.writeFile(service.path, original);

    await expect(service.load()).rejects.toThrow("任务数据文件损坏或版本不受支持");
    await expect(fsPromises.readFile(service.path, "utf8")).resolves.toBe(original);
  });

  it("keeps the original file when atomic replacement fails", async () => {
    const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), "kairos-task-file-"));
    createdDirectories.push(directory);
    const service = new TaskFileService(directory);
    const original = "{\"version\":1,\"tasks\":[]}";
    await fsPromises.writeFile(service.path, original);
    const fileSystem = { ...fsPromises, rename: vi.fn().mockRejectedValue(new Error("模拟替换失败")) };
    const failingService = new TaskFileService(directory, fileSystem);

    await expect(failingService.save([])).rejects.toThrow("模拟替换失败");
    await expect(fsPromises.readFile(service.path, "utf8")).resolves.toBe(original);
  });

  it("migrates ISO due dates to local date-time values", async () => {
    const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), "kairos-task-file-"));
    createdDirectories.push(directory);
    const service = new TaskFileService(directory);
    const task = {
      id: "task-legacy",
      title: "旧任务",
      important: true,
      urgent: true,
      dueAt: "2026-08-24T10:00:00.000Z",
      reminder: "none" as const,
      recurrence: { type: "none" } as const,
      completed: false,
      createdAt: "2026-08-24T08:00:00.000Z",
      updatedAt: "2026-08-24T08:00:00.000Z",
    };
    await fsPromises.writeFile(service.path, JSON.stringify({ version: 1, tasks: [task] }));
    const result = await service.load();
    expect(result.tasks[0].dueAt).toBe(formatLocalDateTime(new Date(task.dueAt)));
  });
});
