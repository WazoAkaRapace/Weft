/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Use class-based dark mode for dynamic toggling
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors matching the existing design
        primary: {
          DEFAULT: '#0066cc',
          hover: '#0052a3',
          light: '#f0f7ff',
        },
        danger: {
          DEFAULT: '#cc0000',
          hover: '#a30000',
          light: '#fee',
        },
        success: {
          DEFAULT: '#22c55e',
          hover: '#16a34a',
          light: '#e6f7e6',
        },
        warning: {
          DEFAULT: '#f59e0b',
          hover: '#d97706',
          light: '#fef3c7',
        },
        background: {
          DEFAULT: '#f5f5f5',
          dark: '#111827',
          card: '#ffffff',
          'card-dark': '#1f2937',
        },
        text: {
          DEFAULT: '#111',
          muted: '#333',
          secondary: '#666',
          hint: '#999',
          'dark-default': '#f9fafb',
          'dark-muted': '#e5e7eb',
          'dark-secondary': '#9ca3af',
          'dark-hint': '#6b7280',
        },
        border: {
          DEFAULT: '#ddd',
          dark: '#374151',
          focus: '#0066cc',
          light: '#f0f0f0',
        },
      },
    },
  },
  plugins: [],
}
