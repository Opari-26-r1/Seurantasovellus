module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(16px) scale(.94)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pop-out': {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to: { opacity: '0', transform: 'translateY(8px) scale(.97)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 250ms ease-out both',
        'fade-out': 'fade-out 180ms ease-in both',
        'pop-in': 'pop-in 350ms cubic-bezier(.16,1,.3,1) both',
        'pop-out': 'pop-out 180ms ease-in both',
      },
    },
  },
  plugins: [],
};
