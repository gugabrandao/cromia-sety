/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        brand: {
          dark: "#0F0F1A",
          purple: "#6B21A8",
          accent: "#A855F7",
        },
        chord: {
          yellow: "#FCD34D",
        },
        lyric: {
          white: "#F9FAFB",
        },
        section: {
          green: "#34D399",
        },
        chorus: {
          line: "#A855F7",
        },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

