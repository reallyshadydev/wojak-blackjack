/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        felt: { DEFAULT: "#0b6b3a", dark: "#064027", light: "#0f8a4c" },
        gold: { DEFAULT: "#e8c468", dark: "#b8923a", light: "#f6e3a1" },
        ink: { DEFAULT: "#0a0f0c", panel: "#11171340" },
        wojak: { DEFAULT: "#f4b942" },
      },
      fontFamily: {
        display: ['"Bebas Neue"', "Oswald", "Impact", "sans-serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        table: "inset 0 0 120px rgba(0,0,0,.55), inset 0 0 0 2px rgba(232,196,104,.18)",
        card: "0 6px 18px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.4)",
        chip: "0 3px 0 rgba(0,0,0,.35), inset 0 0 0 3px rgba(255,255,255,.18)",
        glow: "0 0 24px rgba(232,196,104,.45)",
      },
      keyframes: {
        deal: {
          "0%": { transform: "translate(220px,-260px) rotate(18deg) scale(.7)", opacity: 0 },
          "100%": { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 },
        },
        flip: {
          "0%": { transform: "rotateY(180deg)" },
          "100%": { transform: "rotateY(0)" },
        },
        pop: { "0%": { transform: "scale(.6)", opacity: 0 }, "100%": { transform: "scale(1)", opacity: 1 } },
        floatUp: {
          "0%": { transform: "translateY(8px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        shine: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        deal: "deal .42s cubic-bezier(.2,.8,.2,1) both",
        flip: "flip .5s ease both",
        pop: "pop .25s ease both",
        floatUp: "floatUp .3s ease both",
        shine: "shine 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};
