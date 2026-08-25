import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { WindowBounds, WindowPreferences } from "../../shared/windowMode";

const boundsSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
});

const preferencesSchema = z.object({
  mode: z.enum(["normal", "widget"]),
  normalBounds: boundsSchema.optional(),
  widgetPosition: z.object({ x: z.number().finite(), y: z.number().finite() }).optional(),
});

export const defaultWindowPreferences: WindowPreferences = { mode: "normal" };

export function keepBoundsVisible(bounds: WindowBounds, workAreas: WindowBounds[]): WindowBounds {
  const visible = workAreas.some((area) => {
    const overlapWidth = Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
    const overlapHeight = Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y);
    return overlapWidth >= Math.min(120, bounds.width) && overlapHeight >= Math.min(80, bounds.height);
  });
  if (visible || workAreas.length === 0) return bounds;

  const fallback = workAreas[0];
  return {
    ...bounds,
    x: fallback.x + 24,
    y: fallback.y + 24,
  };
}

export class WindowPreferencesService {
  private readonly filePath: string;
  private saveQueue = Promise.resolve();

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "window-preferences.json");
  }

  async load(): Promise<WindowPreferences> {
    try {
      const parsed = preferencesSchema.safeParse(JSON.parse(await readFile(this.filePath, "utf8")));
      return parsed.success ? parsed.data : defaultWindowPreferences;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return defaultWindowPreferences;
      return defaultWindowPreferences;
    }
  }

  async save(preferences: WindowPreferences): Promise<void> {
    const normalized = preferencesSchema.parse(preferences);
    const operation = this.saveQueue.then(async () => {
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      await mkdir(path.dirname(this.filePath), { recursive: true });
      try {
        await writeFile(temporaryPath, JSON.stringify(normalized, null, 2), "utf8");
        await rename(temporaryPath, this.filePath);
      } catch (error) {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
      }
    });
    this.saveQueue = operation.then(() => undefined, () => undefined);
    await operation;
  }
}
