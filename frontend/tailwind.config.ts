import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ECFDF5",  // soft green tint
          100: "#D1FAE5",
          500: "#10B981", // primary soft green
          600: "#059669",
          700: "#047857", // deeper green accent
        },
      },
    },
  },
  plugins: [],
};

export default config;


