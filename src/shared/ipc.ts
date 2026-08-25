export const IPC_CHANNELS = {
  loadTasks: "tasks:load",
  saveTasks: "tasks:save",
  startupSettings: "startup:settings",
  setStartup: "startup:set",
  exportTasks: "tasks:export",
  prepareImport: "tasks:import:prepare",
  resolveImport: "tasks:import:resolve",
  tasksChanged: "tasks:changed",
  notificationStatus: "notifications:status",
  requestNotification: "notifications:request",
} as const;

export type { TaskFile } from "./task";
export type ImportChoice = "keep-current" | "overwrite" | "duplicate";
export type ImportConflict = {
  key: string;
  reason: "id" | "content";
  current: import("./task").TaskInstance;
  incoming: import("./task").TaskInstance;
};
export type ImportPreview = {
  canceled: boolean;
  token?: string;
  added: import("./task").TaskInstance[];
  conflicts: ImportConflict[];
};
export type ImportResult = {
  canceled: boolean;
  added: number;
  overwritten: number;
  kept: number;
  skipped: number;
  duplicated: number;
};
