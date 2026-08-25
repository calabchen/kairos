import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/renderer/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f4f1ea",
        panel: "#fbfaf6",
        ink: "#252724",
        muted: "#737b72",
        line: "#ddd9cf",
        moss: "#536b57",
        mossSoft: "#e7eee6",
        coral: "#f7e8e1",
        coralLine: "#e9cfc4",
        saffron: "#f4eedb",
        saffronLine: "#e7dcb9",
        lake: "#e4eef0",
        lakeLine: "#c8dde1",
        slate: "#e8ebe6",
        slateLine: "#d1d7cf",
        danger: "#b75e4b",
      },
      fontFamily: {
        sans: ["IBM Plex Sans TC", "PingFang SC", "sans-serif"],
        display: ["Noto Serif SC", "Songti SC", "serif"],
        mono: ["DM Mono", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        soft: "0 8px 24px rgb(32 37 33 / 8%)",
        card: "0 2px 8px rgb(85 80 60 / 5%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
