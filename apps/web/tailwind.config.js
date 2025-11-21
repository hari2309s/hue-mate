/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx,html}',
    './public/**/*.html',
    './index.html',
    // Add paths to your HTML/JS/TS files here for purging unused styles
  ],
  theme: {
    extend: {
      // Custom color palette based on the site's dark, teal-accented retro-futuristic theme
      colors: {
        // Backgrounds
        'nifty-dark': '#222222', // Primary dark charcoal
        'nifty-mid': '#444444', // Secondary mid-dark gray
        'nifty-void': '#000000', // Pure black for overlays
        // Text
        'nifty-light': '#ffffff', // Primary white
        'nifty-muted': '#9C9C9C', // Secondary muted gray (primary subtitle)
        'nifty-faint': '#666666', // Fainter gray for labels
        // Accents
        'nifty-teal': '#226688', // Deep teal for buttons/links
        'nifty-teal-light': '#4488aa', // Mid teal for hovers
        'nifty-teal-bright': '#66aacc', // Bright teal for active states
        // Highlights
        'nifty-glow': '#eeeecc', // Pale creamy yellow for neon highlights
        // Borders
        'nifty-border': '#aaaaaa', // Light gray borders
        'nifty-border-light': '#cccccc', // Lighter gray dividers
      },
      // Typography: Retro neon-tube font with monospace fallback
      fontFamily: {
        'neon-tube': ['NeonTube', 'monospace'], // Custom font; load via @import or CDN
        'retro-mono': ['Courier New', 'monospace'], // Fallback for body text
      },
      // Custom shadows for neon glow effects
      boxShadow: {
        'neon-glow': '0 0 10px rgba(34, 102, 136, 0.5)', // Subtle teal glow for text/buttons
        'neon-glow-lg': '0 0 20px rgba(34, 102, 136, 0.7)', // Stronger glow for highlights
        'neon-glow-xl': '0 0 30px rgba(102, 170, 204, 0.8)', // Bright glow for interactions
        'retro-drop': '0 4px 8px rgba(0, 0, 0, 0.3)', // Subtle drop for cards/sections
      },
      // Spacing extensions for generous vertical sections (retro scrolling feel)
      spacing: {
        18: '4.5rem', // For section paddings
        20: '5rem',
        24: '6rem', // Hero/ large blocks
      },
      // Border widths: Thin lines for minimalism
      borderWidth: {
        1: '1px', // Standard thin border
      },
      // Letter spacing for all-caps headings
      letterSpacing: {
        widest: '.2em', // Extra wide for bold retro titles
      },
      // Line heights for readable body on dark bg
      lineHeight: {
        relaxed: '1.75', // For body text
      },
      // Animations for retro fades/glows (add to keyframes below)
      animation: {
        'neon-pulse': 'neonPulse 2s ease-in-out infinite alternate',
        'retro-fade': 'retroFade 1s ease-out',
      },
      // Custom keyframes for animations
      keyframes: {
        neonPulse: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(34, 102, 136, 0.5)' },
          '50%': { boxShadow: '0 0 20px rgba(102, 170, 204, 0.8)' },
        },
        retroFade: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    // Optional: Add plugins for advanced features if needed (e.g., typography for prose)
    require('@tailwindcss/typography'), // For better body text handling
    // Custom plugin for neon text shadow (if not using arbitrary)
    function ({ addUtilities }) {
      addUtilities({
        '.neon-text': {
          textShadow: '0 0 5px rgba(34, 102, 136, 0.5)',
        },
        '.neon-text-lg': {
          textShadow: '0 0 10px rgba(102, 170, 204, 0.7)',
        },
      });
    },
  ],
};
