import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("kairos", {
  platform: process.platform,
});
