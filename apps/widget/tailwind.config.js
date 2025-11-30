/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
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
  // Shadow DOM内で使用するため、プレフィックスを設定しない
  important: false,
};
