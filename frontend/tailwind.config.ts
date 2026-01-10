import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0efff",
          200: "#b8dfff",
          300: "#7ac5ff",
          400: "#35a7ff",
          500: "#0061ff", // Dropbox blue
          600: "#0052e6",
          700: "#0040b8",
          800: "#003595",
          900: "#002e7a",
        },
        accent: {
          coral: "#ff6b6b",
          teal: "#20bf9f",
          purple: "#a855f7",
          orange: "#ff8c42",
          pink: "#ec4899",
          indigo: "#6366f1",
          emerald: "#10b981",
          cyan: "#06b6d4",
        },
        priority: {
          "must-have": "#ef4444",
          "good-to-have": "#f59e0b",
          "optional": "#6b7280",
        }
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'medium': '0 2px 8px rgba(0, 0, 0, 0.1)',
        'large': '0 4px 16px rgba(0, 0, 0, 0.1)',
        'dropbox': '0 2px 4px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      }
    }
  },
  plugins: []
};

export default config;


