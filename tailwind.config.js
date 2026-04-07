/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          'yd-primary': 'var(--color-primary)',
          'yd-primary-light': 'var(--color-primary-light)',
          'yd-primary-dark': 'var(--color-primary-dark)',
          'yd-accent': 'var(--color-accent)',
          'yd-accent-light': 'var(--color-accent-light)',
          'yd-success': 'var(--color-success)',
          'yd-warning': 'var(--color-warning)',
          'yd-danger': 'var(--color-danger)',
          'yd-info': 'var(--color-info)',
        }
      },
    },
    plugins: [],
  }
