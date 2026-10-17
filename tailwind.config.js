/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deliberate 5-color palette tied to the "atelier fitting room" subject:
        // warm plaster walls, deep aubergine drapes, brass fittings, ink, blush.
        plaster: '#F3ECE3',
        aubergine: '#3B1F2B',
        ink: '#1A1416',
        brass: '#C8A24A',
        blush: '#E7B7A8',
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
