import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}','./lib/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter','system-ui','sans-serif'],
        body:    ['Inter','system-ui','sans-serif'],
      },
      colors: {
        accent: { DEFAULT:'#e63946', hover:'#c1121f', 50:'rgba(230,57,70,0.10)' },
        // Light mode
        ink: {
          50:'#f8fafc', 100:'#f1f5f9', 200:'#e2e8f0', 300:'#cbd5e1',
          400:'#94a3b8', 500:'#64748b', 600:'#475569', 700:'#334155',
          800:'#1e293b', 900:'#0f172a', 950:'#020617',
        },
        surface: { DEFAULT:'#ffffff', 2:'#f8fafc', 3:'#f1f5f9' },
        // Dark navy (OneAds-inspired)
        navy: {
          950:'#070e1a',
          900:'#0b1628',
          800:'#0f1d2e',
          700:'#132334',
          600:'#172a3c',
          500:'#1d3044',
          border:'#1e2d3e',
          'border-subtle':'#162030',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-dark': '0 1px 3px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}
export default config
