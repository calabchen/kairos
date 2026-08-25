import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  Tray,
} from "electron";
import path from "node:path";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { IPC_CHANNELS, type ImportPreview } from "../shared/ipc";
import { findImportConflicts, mergeImportedTasks } from "../shared/importTasks";
import { taskFileSchema, type TaskInstance } from "../shared/task";
import { ReminderScheduler } from "./services/reminderScheduler";
import { TaskFileService } from "./services/taskFile";
import { TaskRuntime } from "./services/taskRuntime";

const isDevelopment = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let shouldQuit = false;
let taskFile: TaskFileService;
let reminderScheduler: ReminderScheduler;
let taskRuntime: TaskRuntime;
const pendingImports = new Map<string, { current: TaskInstance[]; imported: TaskInstance[] }>();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "Kairos",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.on("close", (event: { preventDefault: () => void }) => {
    if (!shouldQuit) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDevelopment) {
    void mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

function showWindow() {
  if (!mainWindow) createWindow();
  mainWindow?.show();
  mainWindow?.focus();
}

function createTray() {
  const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\"><rect width=\"16\" height=\"16\" rx=\"4\" fill=\"#202521\"/><path d=\"M4 4h8v2H6v2h5v2H6v2h6v2H4z\" fill=\"#f8f5ee\"/></svg>";
  const icon = nativeImage.createFromDataURL("data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"));
  tray = new Tray(icon);
  tray.setToolTip("Kairos");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "显示 Kairos", click: showWindow },
    { type: "separator" },
    { label: "退出 Kairos", click: quitApplication },
  ]));
  tray.on("click", showWindow);
}

function quitApplication() {
  shouldQuit = true;
  reminderScheduler.dispose();
  tray?.destroy();
  app.quit();
}

function registerIpc() {
  ipcMain.handle(IPC_CHANNELS.loadTasks, async () => {
    return { version: 1 as const, tasks: await taskRuntime.loadAndSchedule() };
  });

  ipcMain.handle(IPC_CHANNELS.saveTasks, async (_event: unknown, rawTasks: unknown) => {
    const tasks = taskFileSchema.parse({ version: 1, tasks: rawTasks }).tasks;
    await taskRuntime.persist(tasks);
  });
  ipcMain.handle(IPC_CHANNELS.startupSettings, () => app.getLoginItemSettings());
  ipcMain.handle(IPC_CHANNELS.setStartup, async (_event: unknown, enabled: boolean) => {
    const openAtLogin = z.boolean().parse(enabled);
    app.setLoginItemSettings({ openAtLogin, openAsHidden: true });
    return app.getLoginItemSettings();
  });
  ipcMain.handle(IPC_CHANNELS.exportTasks, async () => {
    const result = await dialog.showSaveDialog(mainWindow!, { defaultPath: "kairos-backup.json", filters: [{ name: "JSON", extensions: ["json"] }] });
    if (result.canceled || !result.filePath) return { canceled: true, count: 0 };
    const tasks = await taskRuntime.loadAndSchedule();
    const file = { version: 1 as const, tasks };
    await import("node:fs/promises").then(({ writeFile }) => writeFile(result.filePath!, JSON.stringify(file, null, 2), "utf8"));
    return { canceled: false, count: file.tasks.length };
  });
  ipcMain.handle(IPC_CHANNELS.prepareImport, async (): Promise<ImportPreview> => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ["openFile"], filters: [{ name: "JSON", extensions: ["json"] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true, added: [], conflicts: [] };
    const { readFile } = await import("node:fs/promises");
    const imported = taskFileSchema.parse(JSON.parse(await readFile(result.filePaths[0], "utf8")));
    const current = { version: 1 as const, tasks: await taskRuntime.loadAndSchedule() };
    const conflicts = findImportConflicts(current.tasks, imported.tasks);
    const conflictIds = new Set(conflicts.map((conflict) => conflict.incoming.id));
    const token = randomUUID();
    pendingImports.set(token, { current: current.tasks, imported: imported.tasks });
    return { canceled: false, token, added: imported.tasks.filter((task) => !conflictIds.has(task.id)), conflicts };
  });
  ipcMain.handle(IPC_CHANNELS.resolveImport, async (_event: unknown, token: unknown, rawChoices: unknown) => {
    const pending = typeof token === "string" ? pendingImports.get(token) : undefined;
    if (!pending) throw new Error("导入会话已失效，请重新选择文件");
    pendingImports.delete(token as string);
    const choices = z.record(z.string(), z.enum(["keep-current", "overwrite", "duplicate"])).parse(rawChoices);
    const merged = mergeImportedTasks(pending.current, pending.imported, choices);
    const tasks = merged.tasks;
    await taskRuntime.persist(tasks);
    mainWindow?.webContents.send(IPC_CHANNELS.tasksChanged);
    return merged.result;
  });
  ipcMain.handle(IPC_CHANNELS.notificationStatus, () => ({ supported: Notification.isSupported() }));
  ipcMain.handle(IPC_CHANNELS.requestNotification, () => {
    if (!Notification.isSupported()) return { supported: false, attempted: false };
    new Notification({ title: "Kairos 通知", body: "通知已重新请求；未来提醒会按任务设置发送。" }).show();
    return { supported: true, attempted: true };
  });
}

app.whenReady().then(async () => {
  taskFile = new TaskFileService(app.getPath("userData"));
  reminderScheduler = new ReminderScheduler();
  taskRuntime = new TaskRuntime(taskFile, reminderScheduler);
  // Load before creating the window so hidden login starts can schedule reminders.
  await taskRuntime.loadAndSchedule().catch(() => undefined);
  registerIpc();
  createTray();
  const loginSettings = app.getLoginItemSettings();
  if (!loginSettings.wasOpenedAtLogin || !loginSettings.wasOpenedAsHidden) createWindow();

  if (Notification.isSupported()) {
    // Permission is requested by the operating system when the first notification is shown.
  }

  app.on("activate", showWindow);
});

app.on("before-quit", () => {
  shouldQuit = true;
});

app.on("window-all-closed", () => {
  // Keep the process alive so reminders continue while the app is in the tray.
});
