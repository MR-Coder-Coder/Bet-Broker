module.exports = {
  darkMode: 'class', // Use 'class' based dark mode
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        flashBg: {
          '0%': { backgroundColor: '#ffd700' },
          '100%': { backgroundColor: 'inherit' },
        },
      },
      animation: {
        flash: 'flashBg 1s ease-in-out',
      },
    },
  },
  plugins: [],
}
