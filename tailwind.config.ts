import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        leste: {
          blue: "#0000A3",
          gold: "#FFD53D",
          support: "#8A929D",
          canvas: "#F5F1EA",
        },
      },
      boxShadow: {
        editorial: "0 20px 60px rgba(0, 0, 163, 0.12)",
      },
      backgroundImage: {
        "editorial-grid":
          "linear-gradient(rgba(0, 0, 163, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 163, 0.04) 1px, transparent 1px)",
      },
      backgroundSize: {
        editorial: "28px 28px",
      },
    },
  },
  plugins: [],
};

export default config;
