/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neo: {
          bg: '#F7F8FA',
          shadow: '#d1d9e6',
          highlight: '#ffffff',
          primary: '#4f46e5', // indigo-600 for subtle accents
          text: '#2d3748',
          muted: '#718096',
        }
      },
      boxShadow: {
        'neo-flat': '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
        'neo-pressed': 'inset 4px 4px 8px #d1d9e6, inset -4px -4px 8px #ffffff',
        'neo-hover': '12px 12px 24px #c2ccd8, -12px -12px 24px #ffffff',
        'neo-card': '14px 14px 28px #d1d9e6, -14px -14px 28px #ffffff',
        'neo-btn': '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
        'neo-btn-hover': '6px 6px 12px #c2ccd8, -6px -6px 12px #ffffff',
      },
      borderRadius: {
        'neo': '20px',
      }
    },
  },
  plugins: [],
}
