import typography from '@tailwindcss/typography';
import forms from '@tailwindcss/forms';

module.exports = {
  content: ['./src/**/*.{html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'deep-black': '#11151C',
        'deep-blue': '#212D40',
        'muted-blue': '#364156',
        'muted-pink': '#7D4E57',
        'soft-orange': '#D66853',
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
