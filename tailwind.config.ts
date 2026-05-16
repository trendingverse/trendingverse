import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}','./lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Georgia','serif'],
        body: ['system-ui','sans-serif'],
      },
      colors: {
        accent: { DEFAULT:'#e63946', hover:'#c1121f', 50:'#fff0f0' },
        ink: {
          50:'#f7f7f5', 100:'#eeede9', 200:'#dcdbd4', 300:'#c4c2b8',
          400:'#a8a59a', 500:'#8f8c80', 600:'#7a776b', 700:'#636058',
          800:'#524f48', 900:'#45423c', 950:'#252320',
        },
        surface: { DEFAULT:'#ffffff', 2:'#f9f9f7', 3:'#f2f1ee' },
      },
    },
  },
  plugins: [],
}
export default config
