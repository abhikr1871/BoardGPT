/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Blueprint dark theme + evaluation palette (§8, §9)
        panel: '#111827',
        'panel-alt': '#1a2233',
        accent: '#22c55e', // accent green
        'eval-winning': '#22c55e',
        'eval-advantage': '#86efac',
        'eval-slight': '#60a5fa',
        'eval-equal': '#e5e7eb',
        'eval-worse': '#facc15',
        'eval-losing': '#fb923c',
        'eval-critical': '#ef4444',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
