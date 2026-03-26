/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#e8fdf6',
          100: '#c7f8e8',
          200: '#93f0d2',
          300: '#4de3b5',
          400: '#1dd49a',
          500: '#09c186',
          600: '#07b27b',
          700: '#068d61',
          800: '#056b4a',
        }
      },
      boxShadow: {
        'card':     '0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-lg':  '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'selected': '0 0 0 2px #07b27b, 0 4px 16px rgba(7,178,123,0.12)',
        'nav':      '0 -1px 0 rgba(0,0,0,0.06), 0 -4px 20px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    }
  },
  plugins: []
}
