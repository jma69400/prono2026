/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // =====================================================
        // CHARTE GRAPHIQUE — Règle 60/30/10
        // =====================================================
        // 60% BASE — Fonds, surfaces
        'base-deep':    '#0a0e27',  // Dark mode profond (existant)
        'base-surface': '#1a1f3a',  // Surfaces élevées
        'base-raised':  '#1e293b',  // Surface modals/dropdowns

        // 30% SECONDAIRE — Bleu sport profond
        'sport': {
          50:  '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a',
        },

        // 10% ACCENT — Vert électrique (CTA et IA)
        'cta': {
          50:  '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
          400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
          800: '#065f46', 900: '#064e3b',
        },
        'electric': '#10F981',

        // BRANDING (logo conservé pour reconnaissance visuelle)
        'brand-orange': '#f97316',
        'brand-pink':   '#ec4899',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(to right, #f97316, #ec4899)',
        'sport-gradient': 'linear-gradient(to right, #1e40af, #3b82f6)',
        'cta-gradient':   'linear-gradient(to right, #10b981, #059669)',
      },
    },
  },
  plugins: [],
}
