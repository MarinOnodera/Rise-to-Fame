import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kpink: "#ff3d8b",
        kpurple: "#7b2cff",
        kgold: "#ffd166",
        kdark: "#0b0614",
        kpanel: "#18102a",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 32px rgba(255,61,139,0.45)",
      },
    },
  },
  plugins: [],
};
export default config;
