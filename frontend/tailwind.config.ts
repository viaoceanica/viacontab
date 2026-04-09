import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ocean: {
          bg: "#f8fafb",
          panel: "#ffffff",
          muted: "#f3f6f7",
          text: "#131a20",
          soft: "#6b7785",
          border: "#e4e7ec",
          primary: "#15c28a",
          primaryStrong: "#12a978",
        },
      },
      boxShadow: {
        card: "0 4px 14px rgba(18, 26, 32, 0.06)",
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
