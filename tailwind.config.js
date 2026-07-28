/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Deep navy — sidebar and headings
        ink: {
          50: "#f6f7f9", 100: "#eceef2", 200: "#d5d9e2", 300: "#b0b8c9",
          400: "#8591ab", 500: "#657391", 600: "#505b78", 700: "#414a61",
          800: "#394053", 900: "#0f172a", 950: "#0a1020",
        },
        // Primary action colour
        brand: {
          50: "#eef4ff", 100: "#d9e6ff", 200: "#bcd3ff", 300: "#8eb5ff",
          400: "#598cff", 500: "#3363ff", 600: "#1d43f5", 700: "#1632e1",
          800: "#182cb6", 900: "#1a2c8f", 950: "#151d57",
        },
        // Secondary accent for shipment / ocean context
        teal: {
          50: "#eefdfb", 100: "#c9f9f3", 200: "#96f0e9", 300: "#5ce0da",
          400: "#2cc5c2", 500: "#12a8a7", 600: "#0a8687", 700: "#0d6b6c",
          800: "#105456", 900: "#124648",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto",
               '"Helvetica Neue"', "Arial", '"Noto Sans"', "sans-serif"],
        mono: ["ui-monospace", '"SF Mono"', '"Cascadia Mono"', "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(15 23 42 / 0.04)",
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        lift: "0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 6px -2px rgb(15 23 42 / 0.05)",
        pop: "0 20px 40px -12px rgb(15 23 42 / 0.25), 0 8px 16px -8px rgb(15 23 42 / 0.15)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": {
          from: { opacity: "0", transform: "translateY(6px) scale(0.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "scale-in": "scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
