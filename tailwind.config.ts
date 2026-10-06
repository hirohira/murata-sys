import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans JP"', 'sans-serif'],
      },
      colors: {
        murata: {
          primary: '#1B4F72',
          'primary-light': '#EBF2F7',
          light: '#D4E6F1',
          accent: '#D32F2F',
          'accent-light': '#FDEAEA',
          dark: '#164060',
        },
      },
    },
  },
  plugins: [],
};
export default config;
