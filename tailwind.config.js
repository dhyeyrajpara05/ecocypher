/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        deep: { DEFAULT: "#0B2A3C", 700: "#0F3550", 600: "#164863", 500: "#1E5B7A" },
        foam: "#F4FAF9",
        aqua: { DEFAULT: "#D3EEEA", 200: "#E6F5F2", 400: "#A9DCD5" },
        kelp: { DEFAULT: "#1F7A5C", 600: "#186349", 300: "#7CC4A6", 100: "#DCF1E8" },
        brass: { DEFAULT: "#E2B13C", 600: "#B88A1F", 100: "#FBF0D2" },
        fin: { DEFAULT: "#5C7A86", 300: "#A7BCC4", 200: "#CCDADF" },
        coral: { DEFAULT: "#D9534F", 100: "#FBE3E2" },
      },
      fontFamily: {
        display: ['"Unbounded"', "system-ui", "sans-serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
