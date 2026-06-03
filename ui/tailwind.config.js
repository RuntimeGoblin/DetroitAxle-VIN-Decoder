/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        /*
         * All bg / border / txt colors reference CSS custom properties
         * defined in index.css.  The <alpha-value> placeholder lets
         * Tailwind's opacity modifiers (e.g. bg-bg-card/80) work correctly
         * even though the value comes from a variable.
         */
        bg: {
          base: "rgb(var(--c-bg-base)     / <alpha-value>)",
          surface: "rgb(var(--c-bg-surface)  / <alpha-value>)",
          card: "rgb(var(--c-bg-card)     / <alpha-value>)",
          elevated: "rgb(var(--c-bg-elevated) / <alpha-value>)",
        },
        border: {
          subtle: "rgb(var(--c-border-subtle) / <alpha-value>)",
          DEFAULT: "rgb(var(--c-border)        / <alpha-value>)",
          strong: "rgb(var(--c-border-strong) / <alpha-value>)",
        },
        txt: {
          primary: "rgb(var(--c-txt-primary)   / <alpha-value>)",
          secondary: "rgb(var(--c-txt-secondary) / <alpha-value>)",
          muted: "rgb(var(--c-txt-muted)     / <alpha-value>)",
        },

        /* Fixed accent / semantic — same in both themes */
        accent: {
          DEFAULT: "#4f8ef7",
          hover: "#3b82f6",
          muted: "#1e3a6e",
        },
        success: "#10b981",
        danger: "#ef4444",
        warn: "#f59e0b",
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },

      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        pop: "pop 0.2s ease-out",
        "slide-in-right": "slideInRight 0.25s ease-out",
        "toast-out": "toastOut 0.2s ease-in forwards",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: {
          from: { transform: "translateY(14px)", opacity: 0 },
          to: { transform: "translateY(0)", opacity: 1 },
        },
        slideIn: {
          from: { transform: "translateX(-12px)", opacity: 0 },
          to: { transform: "translateX(0)", opacity: 1 },
        },
        pop: {
          from: { transform: "scale(0.96)", opacity: 0 },
          to: { transform: "scale(1)", opacity: 1 },
        },
        slideInRight: {
          from: { transform: "translateX(calc(100% + 1.5rem))", opacity: 0 },
          to: { transform: "translateX(0)", opacity: 1 },
        },
        toastOut: {
          from: { opacity: 1, transform: "translateX(0)" },
          to: { opacity: 0, transform: "translateX(calc(100% + 1.5rem))" },
        },
      },

      /* Shadows also use CSS variables so dark/light values differ */
      boxShadow: {
        card: "var(--shadow-card)",
        glow: "var(--shadow-glow)",
        "glow-sm": "var(--shadow-glow-sm)",
        modal: "var(--shadow-modal)",
      },
    },
  },
  plugins: [],
};
