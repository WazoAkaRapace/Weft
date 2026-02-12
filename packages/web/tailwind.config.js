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
        // Primary (Teal - Brand Color)
        primary: {
          50: '#E6F7F7',
          100: '#B3E6E6',
          200: '#80D4D4',
          300: '#4DC2C2',
          400: '#26B0B0',
          500: '#1A9E9E', // Main brand color (light mode)
          600: '#178B8B',
          700: '#147878',
          800: '#116565',
          900: '#0E5252',
          // Dark mode adjusted (brighter for visibility)
          DEFAULT: '#1A9E9E',
          light: '#B3E6E6',
        },
        // Neutral (Warm Gray - Light Mode)
        neutral: {
          50: '#FAFAF9', // Page background
          100: '#F5F5F4', // Card background
          200: '#E7E5E4', // Subtle borders
          300: '#D6D3D1', // Dividers
          400: '#A8A29E', // Disabled text
          500: '#78716C', // Secondary text
          600: '#57534E', // Body text
          700: '#44403C', // Headings
          800: '#292524', // Dark text
          900: '#1C1917', // Darkest text
        },
        // Dark mode adjusted (Cool Gray)
        dark: {
          50: '#FAFAFA', // Lightest (for text)
          100: '#F4F4F5', // Very light (for text)
          200: '#E4E4E7', // Light text
          300: '#D4D4D8', // Secondary text
          400: '#A1A1AA', // Muted text
          500: '#71717A', // Disabled text
          600: '#52525B', // Borders
          700: '#3F3F46', // Card background
          800: '#27272A', // Elevated surface
          900: '#18181B', // Page background
        },
        // Semantic Colors
        success: {
          light: '#ECFDF5',
          DEFAULT: '#10B981',
          dark: '#059669',
          text: '#065F46',
          // Dark mode adjusted
          'dark-light': '#064E3B',
          'dark-main': '#34D399',
          'dark-hover': '#6EE7B7',
          'dark-text': '#A7F3D0',
        },
        warning: {
          light: '#FFFBEB',
          DEFAULT: '#F59E0B',
          dark: '#D97706',
          text: '#92400E',
          // Dark mode adjusted
          'dark-light': '#78350F',
          'dark-main': '#FBBF24',
          'dark-hover': '#FCD34D',
          'dark-text': '#FDE68A',
        },
        error: {
          light: '#FEF2F2',
          DEFAULT: '#EF4444',
          dark: '#DC2626',
          text: '#991B1B',
          // Dark mode adjusted
          'dark-light': '#7F1D1D',
          'dark-main': '#F87171',
          'dark-hover': '#FCA5A5',
          'dark-text': '#FECACA',
        },
        info: {
          light: '#EFF6FF',
          DEFAULT: '#3B82F6',
          dark: '#2563EB',
          text: '#1E40AF',
          // Dark mode adjusted
          'dark-light': '#1E3A8A',
          'dark-main': '#60A5FA',
          'dark-hover': '#93C5FD',
          'dark-text': '#BFDBFE',
        },
        // Legacy aliases for backward compatibility
        danger: {
          DEFAULT: '#EF4444',
          hover: '#DC2626',
          light: '#FEF2F2',
        },
        // Background aliases
        background: {
          DEFAULT: '#FAFAF9',
          dark: '#18181B',
          card: '#F5F5F4',
          'card-dark': '#27272A',
        },
        // Text aliases
        text: {
          DEFAULT: '#1C1917',
          muted: '#57534E',
          secondary: '#78716C',
          hint: '#A8A29E',
          'dark-default': '#FAFAFA',
          'dark-muted': '#E4E4E7',
          'dark-secondary': '#A1A1AA',
          'dark-hint': '#71717A',
        },
        // Border aliases
        border: {
          DEFAULT: '#E7E5E4',
          dark: '#3F3F46',
          focus: '#1A9E9E',
          light: '#F5F5F4',
        },
        // Emotion Colors for Journal Entries
        emotion: {
          happy: '#FDE047',
          sad: '#60A5FA',
          angry: '#F87171',
          fear: '#C084FC',
          surprise: '#FB923C',
          disgust: '#86EFAC',
          neutral: '#A1A1AA',
        },
      },
      // Extend shadow system for better dark mode support
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        'dark-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'dark-md': '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
        'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
      },
      // Custom animations
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
