import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#D7D7D4",
        surface: "#F6F6F3",
        muted: "#F1F1EE",
        ink: "#252525",
        subtle: "#7A7A76",
        line: "#E1E1DC",
        lime: {
          DEFAULT: "#E8FF5A",
          dark: "#CDEB2E",
        },
        pastel: {
          yellow: "#FFF4E4",
          purple: "#F0EAFE",
          cyan: "#E6FAFA",
          green: "#EAFBEF",
        },
      },
      borderRadius: {
        xl: "16px",
        "2xl": "24px",
        "3xl": "32px",
      },
      boxShadow: {
        card: "0 12px 30px rgba(0,0,0,0.06)",
        soft: "0 8px 20px rgba(0,0,0,0.04)",
      },
      backgroundImage: {
        "login-grid":
          "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
