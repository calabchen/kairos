import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Packaged Electron windows load index.html through file://.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
