import { promises as fs } from "node:fs";
import path from "node:path";
import { taskFileSchema, type TaskInstance } from "../../shared/task";
import type { TaskFile } from "../../shared/ipc";

const FILE_NAME = "tasks.json";

export class TaskFileService {
  private readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, FILE_NAME);
  }

  async load(): Promise<TaskFile> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return taskFileSchema.parse(JSON.parse(raw));
    } catch (error) {
      if (isFileMissing(error)) return { version: 1, tasks: [] };
      throw new Error("任务数据文件损坏或版本不受支持");
    }
  }

  async save(tasks: TaskInstance[]): Promise<void> {
    const file = taskFileSchema.parse({ version: 1, tasks });
    const directory = path.dirname(this.filePath);
    const temporaryPath = this.filePath + "." + process.pid + ".tmp";
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(temporaryPath, JSON.stringify(file, null, 2), "utf8");
    await fs.rename(temporaryPath, this.filePath);
  }

  get path() {
    return this.filePath;
  }
}

function isFileMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
