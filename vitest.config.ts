import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/renderer/test/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/dist-electron/**"],
  },
});
