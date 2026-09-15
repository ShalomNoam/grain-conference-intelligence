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
          DEFAULT: "#111827",
          dim: "#64748B",
          faint: "#94A3B8",
        },
        paper: {
          DEFAULT: "#FFFFFF",
          surface: "#FFFFFF",
          alt: "#F8FAFC",
        },
        line: "#E2E8F0",
        navy: {
          DEFAULT: "#1A234B",
          dark: "#111836",
        },
        teal: {
          DEFAULT: "#2563EB",
          bg: "#E0ECFD",
        },
        // Executive B2B FinTech tokens — explicit names for spec-literal
        // utility classes (bg-brand-dark, text-brand-text-muted, …),
        // mirroring ink/ink-dim/teal above at the same values so both
        // naming schemes stay in sync automatically.
        brand: {
          dark: "#111827",
          "text-muted": "#64748B",
          accent: "#2563EB",
        },
        "card-border": "rgba(226, 232, 240, 0.6)",
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
        "grain-mesh": "radial-gradient(circle at 50% 0%, rgba(224, 236, 253, 0.45) 0%, rgba(248, 250, 252, 0) 65%)",
        "grain-page": "linear-gradient(180deg, #EAF3FE 0%, #F3F8FE 45%, #FBFDFF 100%)",
        "grain-headline": "linear-gradient(90deg, #1E255E 0%, #2A4494 55%, #60A5FA 100%)",
        "grain-cta": "linear-gradient(90deg, #3B82F6 0%, #2563EB 100%)",
        "grain-cta-hover": "linear-gradient(90deg, #2563EB 0%, #1D4ED8 100%)",
      },
      boxShadow: {
        card: "0 10px 30px -5px rgba(17, 24, 39, 0.04), 0 2px 6px -1px rgba(17, 24, 39, 0.02)",
      },
    },
  },
  plugins: [],
};
export default config;
