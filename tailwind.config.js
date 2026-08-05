/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#111111',
          hover: '#292929',
        },
        secondary: {
          text: '#667085',
        },
        background: {
          DEFAULT: '#F8F9FA',
          card: '#FFFFFF',
          selected: '#F1F3F5',
        },
        success: {
          DEFAULT: '#079669',
        },
        warning: {
          DEFAULT: '#F59E0B',
        },
        danger: {
          DEFAULT: '#DC2626',
        },
        border: {
          DEFAULT: '#E5E7EB',
        }
      },
      fontFamily: {
        sans: ['Noto Sans Khmer', 'Kantumruy Pro', 'sans-serif'],
      },
      borderRadius: {
        'lg': '10px',
        'xl': '12px',
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      }
    },
  },
  plugins: [],
}
