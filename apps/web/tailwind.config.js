import typography from '@tailwindcss/typography';
import forms from '@tailwindcss/forms';

module.exports = {
  content: ['./src/**/*.{html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        black: '#000',
        'dark-cream': '#f2eee5',
        'dark-purple': '#160e20',
        green: '#29a176',
        'grey-stroke': '#cbcbcb',
        'light-cream': '#f8f8f0',
        'light-purple': '#cda6ff',
        orange: '#fe4f32',
        'player-purple': '#45355b',
        red: '#ff0000',
        'small-txt': '#605a67',
        white: '#fff',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        mono: ['Monaco', 'monospace'],
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '4rem',
      },
      spacing: {
        128: '32rem',
        144: '36rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glow: '0 0 10px 2px rgba(14, 165, 233, 0.3)',
      },
    },
  },
  plugins: [typography, forms],
};
