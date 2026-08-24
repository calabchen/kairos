import { contextBridge, ipcRenderer } from "electron";
import type { TaskFile } from "../shared/ipc";
import type { TaskInstance } from "../shared/task";

// Keep the sandboxed preload self-contained; it cannot require arbitrary app modules.
const IPC_CHANNELS = {
  loadTasks: "tasks:load",
  saveTasks: "tasks:save",
} as const;

contextBridge.exposeInMainWorld("kairos", {
  platform: process.platform,
  loadTasks: (): Promise<TaskFile> => ipcRenderer.invoke(IPC_CHANNELS.loadTasks),
  saveTasks: (tasks: TaskInstance[]): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.saveTasks, tasks),
});
