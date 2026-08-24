import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  Tray,
} from "electron";
import path from "node:path";
import { IPC_CHANNELS } from "../shared/ipc";
import { type TaskInstance } from "../shared/task";
import { ReminderScheduler } from "./services/reminderScheduler";
import { TaskFileService } from "./services/taskFile";

const isDevelopment = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let shouldQuit = false;
let taskFile: TaskFileService;
let reminderScheduler: ReminderScheduler;

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

  mainWindow.on("close", (event) => {
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
    const file = await taskFile.load();
    reminderScheduler.reschedule(file.tasks);
    return file;
  });

  ipcMain.handle(IPC_CHANNELS.saveTasks, async (_event, tasks: TaskInstance[]) => {
    await taskFile.save(tasks);
    reminderScheduler.reschedule(tasks);
  });
}

app.whenReady().then(async () => {
  taskFile = new TaskFileService(app.getPath("userData"));
  reminderScheduler = new ReminderScheduler();
  registerIpc();
  createTray();
  createWindow();

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
