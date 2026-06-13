import type { Config } from "tailwindcss";

const C = (v: string) => `rgb(var(--c-${v}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      /* ─── Aura Enterprise colors + backward-compat aliases ── */
      colors: {
        /* ── Backward-compat tokens (existing pages) ── */
        background:  C("background"),
        surface: {
          DEFAULT: C("surface-container"),  /* existing: card background */
          hi:      C("surface-container-high"),
        },
        /* Unify legacy `violet-*` brand usages onto the indigo brand scale (#6C63FF). */
        violet: {
          50:  "#eeedff",
          100: "#e0dcff",
          200: "#c7c1ff",
          300: "#a5a0ff",
          400: "#8b84ff",
          500: "#6c63ff",
          600: "#5a4fe0",
          700: "#4a40c4",
          800: "#3a329e",
          900: "#2c2678",
        },
        nav:         C("surface-container-low"),
        ink:         C("on-surface"),
        foreground: {
          DEFAULT: `rgb(var(--c-on-surface) / 0.90)`,
          2: `rgb(var(--c-on-surface) / 0.60)`,
          3: `rgb(var(--c-on-surface) / 0.35)`,
          4: `rgb(var(--c-on-surface) / 0.22)`,
          5: `rgb(var(--c-on-surface) / 0.12)`,
        },
        brand:       C("primary"),

        /* ── Aura primary ── */
        primary:                   C("primary"),
        "on-primary":              C("on-primary"),
        "primary-container":       C("primary-container"),
        "on-primary-container":    C("on-primary-container"),
        "inverse-primary":         C("inverse-primary"),
        "primary-fixed":           C("primary-fixed"),
        "primary-fixed-dim":       C("primary-fixed-dim"),
        "on-primary-fixed":        C("on-primary-fixed"),
        "on-primary-fixed-variant": C("on-primary-fixed-variant"),

        /* ── Aura secondary ── */
        secondary:                   C("secondary"),
        "on-secondary":              C("on-secondary"),
        "secondary-container":       C("secondary-container"),
        "on-secondary-container":    C("on-secondary-container"),
        "secondary-fixed":           C("secondary-fixed"),
        "secondary-fixed-dim":       C("secondary-fixed-dim"),
        "on-secondary-fixed":        C("on-secondary-fixed"),
        "on-secondary-fixed-variant": C("on-secondary-fixed-variant"),

        /* ── Aura tertiary ── */
        tertiary:                    C("tertiary"),
        "on-tertiary":               C("on-tertiary"),
        "tertiary-container":        C("tertiary-container"),
        "on-tertiary-container":     C("on-tertiary-container"),
        "tertiary-fixed":            C("tertiary-fixed"),
        "tertiary-fixed-dim":        C("tertiary-fixed-dim"),
        "on-tertiary-fixed":         C("on-tertiary-fixed"),
        "on-tertiary-fixed-variant": C("on-tertiary-fixed-variant"),

        /* ── Aura error ── */
        error:                C("error"),
        "on-error":           C("on-error"),
        "error-container":    C("error-container"),
        "on-error-container": C("on-error-container"),

        /* ── Aura surface scale (flat token names) ── */
        "surface-dim":               C("surface-dim"),
        "surface-bright":            C("surface-bright"),
        "surface-container":         C("surface-container"),
        "surface-container-low":     C("surface-container-low"),
        "surface-container-high":    C("surface-container-high"),
        "surface-container-highest": C("surface-container-highest"),
        "surface-container-lowest":  C("surface-container-lowest"),
        "surface-variant":           C("surface-variant"),
        "surface-tint":              C("surface-tint"),
        "on-surface":                C("on-surface"),
        "on-surface-variant":        C("on-surface-variant"),
        "on-background":             C("on-background"),
        "inverse-surface":           C("inverse-surface"),
        "inverse-on-surface":        C("inverse-on-surface"),

        /* ── Aura outline ── */
        outline:          C("outline"),
        "outline-variant": C("outline-variant"),
      },

      borderColor: {
        faint:  `rgb(var(--c-on-surface) / 0.05)`,
        base:   `rgb(var(--c-on-surface) / 0.07)`,
        strong: `rgb(var(--c-on-surface) / 0.10)`,
        brand:  `rgb(var(--c-primary) / 0.25)`,
      },

      /* ─── Aura spacing tokens ────────────────────────────── */
      spacing: {
        xs:  "4px",
        sm:  "8px",
        md:  "16px",
        lg:  "24px",
        xl:  "32px",
        "2xl": "48px",
        "3xl": "64px",
        gutter: "24px",
        "container-max": "1280px",
        unit: "4px",
      },

      /* ─── Aura font sizes ────────────────────────────────── */
      fontSize: {
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-lg-mobile": ["36px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        h1:       ["30px", { lineHeight: "38px", letterSpacing: "-0.01em", fontWeight: "600" }],
        h2:       ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3:       ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "label-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" }],
        code:     ["14px", { lineHeight: "20px", fontWeight: "400" }],
      },

      /* ─── Aura border radius ─────────────────────────────── */
      borderRadius: {
        DEFAULT: "0.25rem",
        lg:  "0.5rem",
        xl:  "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        full: "9999px",
      },

      /* ─── Font family ────────────────────────────────────── */
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        code: ["monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
