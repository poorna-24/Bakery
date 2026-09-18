import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FDF6EC",
        crust: "#F3E3CE",
        cocoa: "#3A2418",
        caramel: "#B4741F",
        berry: "#C2410C",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      keyframes: {
        sheetUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        sheetUp: "sheetUp 260ms cubic-bezier(0.32, 0.72, 0, 1)",
        fadeIn: "fadeIn 180ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
