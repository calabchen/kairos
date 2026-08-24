import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const electronPackage = path.resolve("node_modules/electron");
const executableByPlatform = {
  darwin: path.join(electronPackage, "dist", "Electron.app", "Contents", "MacOS", "Electron"),
  win32: path.join(electronPackage, "dist", "electron.exe"),
  linux: path.join(electronPackage, "dist", "electron"),
};
const executable = executableByPlatform[process.platform];

if (!executable) {
  throw new Error("当前平台不支持 Electron runtime 自动修复");
}

if (!existsSync(executable)) {
  console.log("Electron runtime 缺失，正在从 npmmirror 修复...");
  execFileSync(process.execPath, [path.join(electronPackage, "install.js")], {
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_MIRROR: process.env.ELECTRON_MIRROR ?? "https://npmmirror.com/mirrors/electron/",
    },
  });
}

if (!existsSync(executable)) {
  throw new Error("Electron runtime 修复失败，请检查网络后重试");
}
