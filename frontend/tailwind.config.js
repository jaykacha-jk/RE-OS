/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        reos: {
          bg: '#f6f8f9',
          surface: '#ffffff',
          muted: '#f1f5f4',
          ink: '#0f172a',
          subtle: '#5b6b7b',
          border: '#e3e9e7',
          borderStrong: '#cbd6d2',
          primary: '#0f766e',
          primaryStrong: '#115e59',
          primarySoft: '#ccfbf1',
          gold: '#b7791f',
          goldSoft: '#fef3c7',
          sidebar: '#0b1220',
          sidebarSoft: '#131c2e',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)',
        raised: '0 10px 30px rgba(15, 23, 42, 0.10)',
        premium: '0 24px 60px rgba(15, 23, 42, 0.14)',
        dropdown: '0 12px 32px rgba(15, 23, 42, 0.16)',
      },
      fontFamily: {
        sans: ['var(--font-reos-sans)'],
      },
      fontSize: {
        // Tightened, consistent type scale.
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'translateY(-6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'scale-in': 'scale-in 0.14s ease-out',
        'slide-in-left': 'slide-in-left 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
