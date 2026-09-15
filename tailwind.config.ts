import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Grain brand palette — deep indigo text, vibrant blue interactive
        // accent, ice-blue tinted surfaces. `teal` keeps its old semantic
        // *role* (primary interactive/success accent) but now points at the
        // brand's vibrant blue instead of the old green-teal, so every
        // existing bg-teal / text-teal / border-teal usage across the app
        // repaints automatically without touching each file.
        ink: {
          DEFAULT: "#111A3A",
          dim: "#556480",
          faint: "#8B96AD",
        },
        paper: {
          DEFAULT: "#FFFFFF",
          surface: "#FFFFFF",
          alt: "#F4F8FD",
        },
        line: "#E7EEFA",
        navy: {
          DEFAULT: "#1A234B",
          dark: "#111836",
        },
        teal: {
          DEFAULT: "#2563EB",
          bg: "#E0ECFD",
        },
        gold: {
          DEFAULT: "#a8752c",
          ink: "#6e4d1c",
          light: "#f2e6d2",
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
        // A single clean geometric sans (Inter) everywhere — serif and mono
        // aliases point at it too, so any existing font-serif / font-mono
        // className in older component code renders as Inter as well
        // instead of needing a file-by-file edit.
        sans: ["'Inter'", "-apple-system", "Segoe UI", "sans-serif"],
        serif: ["'Inter'", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["'Inter'", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "16px",
      },
      backgroundImage: {
        "grain-mesh": "radial-gradient(circle at 50% 10%, rgba(219, 234, 254, 0.6) 0%, rgba(255, 255, 255, 0) 70%)",
        "grain-page": "linear-gradient(180deg, #F4F8FD 0%, #FFFFFF 45%, #EBF3FC 100%)",
        "grain-headline": "linear-gradient(90deg, #1E255E 0%, #2A4494 55%, #60A5FA 100%)",
        "grain-cta": "linear-gradient(90deg, #3B82F6 0%, #2563EB 100%)",
        "grain-cta-hover": "linear-gradient(90deg, #2563EB 0%, #1D4ED8 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
