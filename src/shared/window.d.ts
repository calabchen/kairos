import type { ImportChoice, ImportPreview, ImportResult, TaskFile } from "./ipc";
import type { TaskInstance } from "./task";

declare global {
  interface Window {
    kairos: {
      platform: string;
      loadTasks: () => Promise<TaskFile>;
      saveTasks: (tasks: TaskInstance[]) => Promise<void>;
      getStartupSettings: () => Promise<{ openAtLogin: boolean }>;
      setStartup: (enabled: boolean) => Promise<{ openAtLogin: boolean }>;
      exportTasks: () => Promise<{ canceled: boolean; count: number }>;
      prepareImport: () => Promise<ImportPreview>;
      resolveImport: (token: string, choices: Record<string, ImportChoice>) => Promise<ImportResult>;
      getNotificationStatus: () => Promise<{ supported: boolean }>;
      requestNotification: () => Promise<{ supported: boolean; attempted: boolean }>;
    };
  }
}

export {};
