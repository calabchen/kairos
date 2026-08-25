import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { formatLocalDateTime, taskFileSchema, type TaskInstance, type TaskFile } from "../../shared/task";

const FILE_NAME = "tasks.json";
type FileSystem = Pick<typeof fs, "readFile" | "writeFile" | "rename" | "rm" | "mkdir">;

export class TaskFileService {
  private readonly filePath: string;

  constructor(userDataPath: string, private readonly fileSystem: FileSystem = fs) {
    this.filePath = path.join(userDataPath, FILE_NAME);
  }

  async load(): Promise<TaskFile> {
    try {
      const raw = await this.fileSystem.readFile(this.filePath, "utf8");
      return taskFileSchema.parse(migrateTaskFile(JSON.parse(raw)));
    } catch (error) {
      if (isFileMissing(error)) return { version: 1, tasks: [] };
      throw new Error("任务数据文件损坏或版本不受支持");
    }
  }

  async save(tasks: TaskInstance[]): Promise<void> {
    const file = taskFileSchema.parse({ version: 1, tasks });
    const directory = path.dirname(this.filePath);
    const temporaryPath = this.filePath + "." + process.pid + "." + randomUUID() + ".tmp";
    await this.fileSystem.mkdir(directory, { recursive: true });
    try {
      await this.fileSystem.writeFile(temporaryPath, JSON.stringify(file, null, 2), "utf8");
      await this.fileSystem.rename(temporaryPath, this.filePath);
    } catch (error) {
      await this.fileSystem.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  get path() {
    return this.filePath;
  }
}

function migrateTaskFile(value: unknown): TaskFile {
  if (typeof value !== "object" || value === null || !("version" in value) || value.version !== 1 || !("tasks" in value) || !Array.isArray(value.tasks)) {
    throw new Error("任务数据文件损坏或版本不受支持");
  }
  const tasks = value.tasks.map((rawTask) => {
    if (typeof rawTask !== "object" || rawTask === null) return rawTask;
    const task = { ...rawTask } as Record<string, unknown>;
    if (typeof task.dueAt === "string" && task.dueAt.includes("T") && task.dueAt.length > 16) {
      const parsed = new Date(task.dueAt);
      if (!Number.isFinite(parsed.getTime())) throw new Error("任务数据文件损坏或版本不受支持");
      task.dueAt = formatLocalDateTime(parsed);
    }
    if (task.recurrence && typeof task.recurrence === "object" && task.recurrence !== null && "type" in task.recurrence && task.recurrence.type !== "none" && typeof task.seriesId !== "string") {
      task.seriesId = typeof task.id === "string" ? task.id : undefined;
    }
    return task;
  });
  return { version: 1, tasks } as TaskFile;
}

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
