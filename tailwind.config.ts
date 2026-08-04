import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#D7263D", // warm red — primary / CTA
          dark: "#B01E31",
        },
        money: {
          positive: "#0F9D58", // green — money-positive figures
          negative: "#D7263D", // red — expenses
        },
        ink: "#1A1A1A",
        surface: "#F7F7F7",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "12px",
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        pinned: "0 -2px 12px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
