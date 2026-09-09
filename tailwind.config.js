/** @type {import('tailwindcss').Config} */

// "Calm Neon Glass" — see DESIGN-SYSTEM-PROMPT.md for the full spec.
//
// TWO THEMES, ONE SET OF CLASS NAMES.
//
// Nothing here is a literal colour any more. Every shade points at a CSS
// variable defined in app/globals.css — the dark values on :root, the light
// values under [data-theme="light"]. That indirection is the whole trick: a
// component written as `text-ink-900` renders bright on dark and near-black on
// light without a single line of markup changing, and there is exactly one
// place to edit a colour.
//
// Read the numbers as CONTRAST STRENGTH, not lightness:
//
//   ink-50   the page surface itself
//   ink-200  hairline borders
//   ink-400  faint text — the AA floor, never go dimmer
//   ink-500  muted text
//   ink-900  the strongest text
//
// Higher always means "stands out more against the page", in both themes. On
// dark that means brighter; on light it means darker. Because the meaning is
// relative, the same class is correct in both — which is why the markup did
// not have to be touched.
//
// Two forms appear below:
//
//   rgb(var(--x) / <alpha-value>)   opaque shades. The variable holds a bare
//                                   "34 211 238" triplet so Tailwind can still
//                                   apply modifiers like `bg-brand-500/10`.
//   var(--x)                        shades whose transparency IS the design
//                                   (tinted fills, hairlines). Opacity
//                                   modifiers do not apply to these — as was
//                                   already the case before this change.

module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces and text.
        ink: {
          50:  "rgb(var(--c-ink-50) / <alpha-value>)",   // page surface
          100: "var(--c-ink-100)",                       // subtle raised fill
          200: "var(--c-ink-200)",                       // hairline border
          300: "rgb(var(--c-ink-300) / <alpha-value>)",  // clamped to the AA floor — em-dashes still carry meaning
          400: "rgb(var(--c-ink-400) / <alpha-value>)",  // faint — the AA floor
          500: "rgb(var(--c-ink-500) / <alpha-value>)",  // muted
          600: "rgb(var(--c-ink-600) / <alpha-value>)",
          700: "rgb(var(--c-ink-700) / <alpha-value>)",  // body text
          800: "rgb(var(--c-ink-800) / <alpha-value>)",  // strong body
          900: "rgb(var(--c-ink-900) / <alpha-value>)",  // strongest
          950: "rgb(var(--c-ink-950) / <alpha-value>)",
        },

        // Cyan accent. 600/700 are the interactive weights used across the app.
        brand: {
          50:  "var(--c-brand-50)",                       // tinted fill
          100: "var(--c-brand-100)",
          200: "var(--c-brand-200)",
          300: "var(--c-brand-300)",                      // tinted border
          400: "rgb(var(--c-brand-400) / <alpha-value>)", // hover
          500: "rgb(var(--c-brand-500) / <alpha-value>)",
          600: "rgb(var(--c-brand-600) / <alpha-value>)", // primary
          700: "rgb(var(--c-brand-700) / <alpha-value>)", // links
          800: "rgb(var(--c-brand-800) / <alpha-value>)",
          900: "rgb(var(--c-brand-900) / <alpha-value>)",
          950: "rgb(var(--c-brand-950) / <alpha-value>)", // the ink that sits ON the accent
        },

        // Violet — secondary grouping only, per the spec.
        teal: {
          50:  "var(--c-violet-50)",
          500: "rgb(var(--c-violet-500) / <alpha-value>)",
          700: "rgb(var(--c-violet-700) / <alpha-value>)",
        },
        violet: {
          50:  "var(--c-violet-50)",
          700: "rgb(var(--c-violet-700) / <alpha-value>)",
        },

        // Status. Soft fills and borders are tints; the rest are solid.
        emerald: {
          50:  "var(--c-green-50)",
          200: "var(--c-green-200)",
          300: "rgb(var(--c-green-700) / <alpha-value>)",
          500: "rgb(var(--c-green-500) / <alpha-value>)",
          600: "rgb(var(--c-green-600) / <alpha-value>)",
          700: "rgb(var(--c-green-700) / <alpha-value>)",
          900: "rgb(var(--c-green-900) / <alpha-value>)",
        },
        red: {
          50:  "var(--c-red-50)",
          100: "var(--c-red-100)",
          200: "var(--c-red-200)",
          300: "rgb(var(--c-red-700) / <alpha-value>)",
          400: "rgb(var(--c-red-600) / <alpha-value>)",
          500: "rgb(var(--c-red-500) / <alpha-value>)",
          600: "rgb(var(--c-red-600) / <alpha-value>)",
          700: "rgb(var(--c-red-700) / <alpha-value>)",
          900: "rgb(var(--c-red-900) / <alpha-value>)",
        },
        amber: {
          50:  "var(--c-amber-50)",
          200: "var(--c-amber-200)",
          400: "rgb(var(--c-amber-400) / <alpha-value>)",
          600: "rgb(var(--c-amber-600) / <alpha-value>)",
          700: "rgb(var(--c-amber-700) / <alpha-value>)",
          800: "rgb(var(--c-amber-800) / <alpha-value>)",
          900: "rgb(var(--c-amber-900) / <alpha-value>)",
        },

        // Explicit surface tokens for anything that used to be `bg-white`.
        glass:  "var(--card)",
        sticky: "rgb(var(--c-sticky) / <alpha-value>)",  // SOLID — frozen columns, never glass
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
        // Rises from just below where it lands — movement in the direction it
        // came from, so the eye catches it without the motion being showy.
        "toast-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in":  "fade-in 140ms cubic-bezier(0.23, 1, 0.32, 1)",
        "pop-in":   "pop-in 160ms cubic-bezier(0.23, 1, 0.32, 1)",
        "scale-in": "scale-in 200ms cubic-bezier(0.23, 1, 0.32, 1)",
        "toast-in": "toast-in 220ms cubic-bezier(0.23, 1, 0.32, 1)",
      },
    },
  },
  plugins: [],
};
