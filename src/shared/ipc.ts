export const IPC_CHANNELS = {
  loadTasks: "tasks:load",
  saveTasks: "tasks:save",
} as const;

export type TaskFile = {
  version: 1;
  tasks: import("./task").TaskInstance[];
};
