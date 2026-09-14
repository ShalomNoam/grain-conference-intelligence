import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#131c24",
          dim: "#4b5a66",
          faint: "#7c8b96",
        },
        paper: {
          DEFAULT: "#f2f4f5",
          surface: "#ffffff",
          alt: "#e9ecee",
        },
        line: "#d7dee2",
        gold: {
          DEFAULT: "#a8752c",
          ink: "#6e4d1c",
          light: "#f2e6d2",
        },
        teal: {
          DEFAULT: "#1f6f5c",
          bg: "#e4f0ec",
        },
        danger: {
          DEFAULT: "#a3362b",
          bg: "#f7e7e4",
        },
        warn: {
          bg: "#fbf0da",
          ink: "#7a5412",
        },
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["'IBM Plex Sans'", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["'IBM Plex Mono'", "SFMono-Regular", "Consolas", "monospace"],
      },
      borderRadius: {
        DEFAULT: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
