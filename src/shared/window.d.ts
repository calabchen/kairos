import type { TaskFile } from "./ipc";
import type { TaskInstance } from "./task";

declare global {
  interface Window {
    kairos: {
      platform: string;
      loadTasks: () => Promise<TaskFile>;
      saveTasks: (tasks: TaskInstance[]) => Promise<void>;
    };
  }
}

export {};
