/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#fcfcfc',
          50: '#fefefe',
          100: '#fcfcfc',
          200: '#f8f8f8',
          300: '#f3f3f3',
          400: '#ededed',
          500: '#e6e6e6',
        },
        ink: {
          DEFAULT: '#0a0a0a',
          50: '#f5f5f5',
          100: '#e0e0e0',
          200: '#c4c4c4',
          300: '#a0a0a0',
          400: '#7a7a7a',
          500: '#5c5c5c',
          600: '#3d3d3d',
          700: '#262626',
          800: '#141414',
          900: '#0a0a0a',
        },
        line: {
          DEFAULT: '#e8e8e8',
          light: '#f0f0f0',
          dark: '#d4d4d4',
        },
        accent: {
          DEFAULT: '#0d4f3c',
          50: '#f0f7f4',
          100: '#dcebe4',
          200: '#b8d7c9',
          300: '#8abba7',
          400: '#5a9a80',
          500: '#0d4f3c',
          600: '#0a3f30',
          700: '#082f24',
          800: '#061f18',
          900: '#04100c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      letterSpacing: {
        'tightest': '-0.04em',
        'editorial': '0.02em',
        'wide-sm': '0.05em',
      },
      maxWidth: {
        'editorial': '1600px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'scale-in': 'scaleIn 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
