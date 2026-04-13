import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "ktzh-blue": "#1565C0",
        "ktzh-dark": "#001d44",
        "inverse-surface": "#2d3133",
        "inverse-on-surface": "#eff1f3",
        "on-surface": "#191c1e",
        "surface-container-lowest": "#ffffff",
        "on-primary": "#ffffff",
        background: "#f8f9fb",
        "surface-container": "#eceef0",
        surface: "#f8f9fb",
        "surface-container-high": "#e6e8ea",
        "surface-container-highest": "#e0e3e5",
        "on-surface-variant": "#43474f",
        "surface-tint": "#255dad",
        error: "#ba1a1a",
        "outline-variant": "#c3c6d1",
        outline: "#737780",
        "on-background": "#191c1e",
        "surface-dim": "#d8dadc",
        "on-error": "#ffffff",
        "surface-variant": "#e0e3e5",
        "error-container": "#ffdad6",
        "on-primary-container": "#6b9bef",
        primary: "#001d44",
        "inverse-primary": "#abc7ff",
        secondary: "#48626e",
        "surface-container-low": "#f2f4f6",
        "primary-container": "#00326b",
        "on-secondary": "#ffffff",
        "secondary-container": "#cbe7f5",
      },
      fontFamily: {
        headline: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
