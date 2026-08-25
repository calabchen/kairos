import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/renderer/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#ffffff",
        panel: "#ffffff",
        ink: "#252724",
        muted: "#737b72",
        line: "#ddd9cf",
        moss: "#536b57",
        mossSoft: "#e7eee6",
        coral: "#fbe9e5",
        coralSoft: "#fff0ed",
        coralLine: "#f25022",
        saffron: "#fff4d8",
        saffronLine: "#ffb900",
        lake: "#e7f4fb",
        lakeLine: "#00a4ef",
        slate: "#edf6e5",
        slateLine: "#7fba00",
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
