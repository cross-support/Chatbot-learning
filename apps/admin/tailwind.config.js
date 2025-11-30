/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#007AFF',
          hover: '#0056B3',
        },
      },
      fontFamily: {
        sans: [
          'Hiragino Sans',
          'Hiragino Kaku Gothic ProN',
          'Meiryo',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
