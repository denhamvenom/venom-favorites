import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // LSU brand (mirrored from venom-scouting)
        purple: {
          DEFAULT: '#461D7C',
          light: '#5A2A9E',
          dark: '#2E0F5C',
        },
        gold: {
          DEFAULT: '#FDD023',
          dark: '#C9A71A',
        },
        // Worlds-spec semantic colors
        feasible: '#16A34A', // green W / suggested path
        loss: '#DC2626', // red conflict / loss
        tight: '#F59E0B', // amber tight slack
        tie: '#6B7280', // gray tie / inactive
        // Alliance chips (compact, distinct from W/L)
        'alliance-red': '#ED1C24',
        'alliance-blue': '#0066B3',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
