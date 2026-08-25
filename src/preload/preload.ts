import { contextBridge, ipcRenderer } from "electron";
import type { ImportChoice, ImportPreview, ImportResult, TaskFile } from "../shared/ipc";
import type { TaskInstance } from "../shared/task";
import type { WindowMode, WindowPreferences } from "../shared/windowMode";

// Keep the sandboxed preload self-contained; it cannot require arbitrary app modules.
const IPC_CHANNELS = {
  loadTasks: "tasks:load",
  saveTasks: "tasks:save",
  startupSettings: "startup:settings",
  setStartup: "startup:set",
  exportTasks: "tasks:export",
  prepareImport: "tasks:import:prepare",
  resolveImport: "tasks:import:resolve",
  notificationStatus: "notifications:status",
  requestNotification: "notifications:request",
  tasksChanged: "tasks:changed",
  windowPreferences: "window:preferences",
  setWindowMode: "window:mode:set",
} as const;

contextBridge.exposeInMainWorld("kairos", {
  platform: process.platform,
  loadTasks: (): Promise<TaskFile> => ipcRenderer.invoke(IPC_CHANNELS.loadTasks),
  saveTasks: (tasks: TaskInstance[]): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.saveTasks, tasks),
  getStartupSettings: (): Promise<{ openAtLogin: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.startupSettings),
  setStartup: (enabled: boolean): Promise<{ openAtLogin: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.setStartup, enabled),
  exportTasks: (): Promise<{ canceled: boolean; count: number }> => ipcRenderer.invoke(IPC_CHANNELS.exportTasks),
  prepareImport: (): Promise<ImportPreview> => ipcRenderer.invoke(IPC_CHANNELS.prepareImport),
  resolveImport: (token: string, choices: Record<string, ImportChoice>): Promise<ImportResult> => ipcRenderer.invoke(IPC_CHANNELS.resolveImport, token, choices),
  getNotificationStatus: (): Promise<{ supported: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.notificationStatus),
  requestNotification: (): Promise<{ supported: boolean; attempted: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.requestNotification),
  getWindowPreferences: (): Promise<WindowPreferences> => ipcRenderer.invoke(IPC_CHANNELS.windowPreferences),
  setWindowMode: (mode: WindowMode): Promise<WindowPreferences> => ipcRenderer.invoke(IPC_CHANNELS.setWindowMode, mode),
  onTasksChanged: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on(IPC_CHANNELS.tasksChanged, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.tasksChanged, listener);
  },
});
