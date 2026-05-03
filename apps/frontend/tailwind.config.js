/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta principal de NodoSys
        accent: '#FF6B2B',
        accent2: '#FFB830',
        surface: '#111111',
        surface2: '#1A1A1A',
      },
      fontFamily: {
        sans: ['Archivo', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
