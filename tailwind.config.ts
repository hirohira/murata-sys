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
        murata: {
          primary: '#1B4F72',
          light: '#D4E6F1',
          accent: '#E67E22',
          dark: '#2C3E50',
        },
      },
    },
  },
  plugins: [],
};
export default config;
