/** @type {import('tailwindcss').Config} */

// "Calm Neon Glass" — see DESIGN-SYSTEM-PROMPT.md for the full spec.
//
// The scale names are kept from the old light theme so the app's markup didn't
// have to be rewritten wholesale, but every value is now a dark-theme value.
// Read the numbers as CONTRAST STRENGTH, not lightness:
//
//   ink-50   deepest surface (page background)
//   ink-200  hairline borders
//   ink-400  faint text — the AA floor, never go dimmer
//   ink-500  muted text
//   ink-900  brightest text
//
// That's the same relationship the light theme had (higher = stronger against
// the background); only the direction of "stronger" flipped.

module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces and text. Contrast ratios measured against #0A1118.
        ink: {
          50:  "#0A1118",               // page background
          100: "rgba(255,255,255,.05)", // subtle raised fill
          200: "rgba(255,255,255,.09)", // hairline border
          300: "#7d8798",               // clamped to the AA floor — em-dashes still carry meaning
          400: "#7d8798",               // faint  — 5.23:1, the AA floor
          500: "#98a2b8",               // muted  — 7.41:1
          600: "#aab3c6",               // muted, one step up
          700: "#c3cad9",               // body text
          800: "#d7dce8",               // strong body
          900: "#e8ecf6",               // brightest — 16.05:1
          950: "#f4f6fb",
        },

        // Cyan accent. 600/700 are the interactive weights used across the app.
        brand: {
          50:  "rgba(34,211,238,.12)",  // tinted fill
          100: "rgba(34,211,238,.16)",
          200: "rgba(34,211,238,.28)",
          300: "rgba(34,211,238,.40)",  // tinted border
          400: "#67e8f9",               // hover
          500: "#22d3ee",
          600: "#22d3ee",               // primary
          700: "#67e8f9",               // links read better one step brighter on dark
          800: "#a5f3fc",
          900: "#cffafe",
          950: "#04212a",               // the dark ink that sits ON the accent
        },

        // Violet — secondary grouping only, per the spec.
        teal: {
          50:  "rgba(167,139,250,.12)",
          500: "#a78bfa",
          700: "#c4b5fd",
        },
        violet: {
          50:  "rgba(167,139,250,.12)",
          700: "#c4b5fd",
        },

        // Status. Soft fills at 12%, borders at 22%, text at full strength.
        emerald: {
          50:  "rgba(52,211,153,.12)",
          200: "rgba(52,211,153,.22)",
          500: "#34d399",
          600: "#34d399",
          700: "#6ee7b7",
          900: "#a7f3d0",
        },
        red: {
          50:  "rgba(251,113,133,.12)",
          100: "rgba(251,113,133,.16)",
          200: "rgba(251,113,133,.22)",
          500: "#fb7185",
          600: "#fb7185",
          700: "#fda4af",
          900: "#fecdd3",
        },
        amber: {
          50:  "rgba(251,191,36,.12)",
          200: "rgba(251,191,36,.22)",
          400: "#fbbf24",
          600: "#fbbf24",
          700: "#fcd34d",
          800: "#fde68a",
          900: "#fef3c7",
        },

        // Explicit surface tokens for anything that used to be `bg-white`.
        glass:  "rgba(255,255,255,.03)",
        sticky: "#101a22",   // SOLID — frozen columns, never glass
      },

      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"',
               "Roboto", '"Helvetica Neue"', "Arial", "sans-serif"],
        mono: ["ui-monospace", '"SF Mono"', '"Cascadia Mono"', "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        xl: "14px",
      },
      boxShadow: {
        xs: "0 1px 0 rgba(255,255,255,.04) inset",
        card: "0 1px 0 rgba(255,255,255,.06) inset, 0 8px 32px rgba(0,0,0,.45)",
        lift: "0 1px 0 rgba(255,255,255,.08) inset, 0 12px 40px rgba(0,0,0,.55)",
        pop:  "0 16px 48px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)",
        glow: "0 0 20px rgba(34,211,238,.28)",
        "glow-lg": "0 0 28px rgba(34,211,238,.38)",
      },
      transitionTimingFunction: {
        // Built-in curves are too weak; these are the spec's.
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out": "cubic-bezier(0.77, 0, 0.175, 1)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        // Never from scale(0) — nothing in the real world appears from nothing.
        "pop-in": {
          from: { opacity: "0", transform: "scale(0.97) translateY(-2px)" },
          to:   { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in":  "fade-in 140ms cubic-bezier(0.23, 1, 0.32, 1)",
        "pop-in":   "pop-in 160ms cubic-bezier(0.23, 1, 0.32, 1)",
        "scale-in": "scale-in 200ms cubic-bezier(0.23, 1, 0.32, 1)",
      },
    },
  },
  plugins: [],
};
