import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0A2A4F', dark: '#061a30' },
        brand: { DEFAULT: '#1E4D8C', light: '#E8EFF7', 50: '#F4F7FB' },
        accent: '#F5A623',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
export default config
