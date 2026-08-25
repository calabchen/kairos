export type WindowMode = "normal" | "widget";

export type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WindowPreferences = {
  mode: WindowMode;
  normalBounds?: WindowBounds;
  widgetPosition?: { x: number; y: number };
};
