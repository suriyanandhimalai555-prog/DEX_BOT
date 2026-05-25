/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        secondary: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        admin: '#8B5CF6',
      },
      boxShadow: {
        'admin-glow': '0 0 20px rgba(139, 92, 246, 0.15)',
      },
    },
  },
  plugins: [],
};
