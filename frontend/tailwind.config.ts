import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* Backgrounds */
        background: "rgb(var(--bg) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--bg-card) / <alpha-value>)",
          hi: "rgb(var(--bg-raised) / <alpha-value>)",
        },
        nav: "rgb(var(--bg-nav) / <alpha-value>)",

        /* Text / overlay — use with opacity modifier: text-ink/40, bg-ink/[0.04] */
        ink: "rgb(var(--fg) / <alpha-value>)",

        /* Semantic text levels */
        foreground: {
          DEFAULT: "rgb(var(--fg) / 0.90)",   /* ~text-white (headings) */
          2: "rgb(var(--fg) / 0.60)",          /* text-white/60-70       */
          3: "rgb(var(--fg) / 0.35)",          /* text-white/30-40       */
          4: "rgb(var(--fg) / 0.22)",          /* text-white/20-25       */
          5: "rgb(var(--fg) / 0.12)",          /* text-white/12-15       */
        },

        /* Brand */
        brand: "rgb(var(--brand) / <alpha-value>)",
      },
      borderColor: {
        faint:  "rgb(var(--fg) / 0.05)",   /* border-faint  — sidebar/topbar seams  */
        base:   "rgb(var(--fg) / 0.07)",   /* border-base   — card / input borders  */
        strong: "rgb(var(--fg) / 0.10)",   /* border-strong — hover / auth inputs   */
        brand:  "rgb(var(--brand) / 0.25)",/* border-brand  — brand accents         */
      },
    },
  },
  plugins: [],
};
export default config;
