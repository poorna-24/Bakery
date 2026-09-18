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
    },
  },
  plugins: [],
};

export default config;
