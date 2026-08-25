import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WindowPreferencesService, defaultWindowPreferences, keepBoundsVisible } from "./windowPreferences";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("WindowPreferencesService", () => {
  it("saves and loads preferences atomically", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kairos-window-"));
    temporaryDirectories.push(directory);
    const service = new WindowPreferencesService(directory);
    const preferences = { mode: "widget" as const, widgetPosition: { x: 80, y: 120 } };

    await service.save(preferences);

    expect(await service.load()).toEqual(preferences);
    expect(JSON.parse(await readFile(path.join(directory, "window-preferences.json"), "utf8"))).toEqual(preferences);
  });

  it("falls back when preferences are missing or invalid", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kairos-window-"));
    temporaryDirectories.push(directory);
    const service = new WindowPreferencesService(directory);

    expect(await service.load()).toEqual(defaultWindowPreferences);
    await writeFile(path.join(directory, "window-preferences.json"), "{invalid", "utf8");
    expect(await service.load()).toEqual(defaultWindowPreferences);
  });
});

describe("keepBoundsVisible", () => {
  it("moves an off-screen window to the first work area", () => {
    expect(keepBoundsVisible({ x: 2400, y: 20, width: 560, height: 430 }, [{ x: 0, y: 0, width: 1440, height: 900 }])).toEqual({ x: 24, y: 24, width: 560, height: 430 });
  });

  it("keeps a window that still overlaps a work area", () => {
    const bounds = { x: 1300, y: 20, width: 560, height: 430 };
    expect(keepBoundsVisible(bounds, [{ x: 0, y: 0, width: 1440, height: 900 }])).toEqual(bounds);
  });
});
