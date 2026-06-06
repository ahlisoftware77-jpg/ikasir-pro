/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Essential colors to match web theme variables
        accent: '#3b82f6', // Default Ocean Blue
        surface: '#0f172a',
        background: '#020617',
        'app-border': '#1e293b',
        'app-text-muted': '#94a3b8',
      }
    },
  },
  plugins: [],
}
