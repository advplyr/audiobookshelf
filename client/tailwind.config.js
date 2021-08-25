const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  purge: {
    options: {
      safelist: [
        'bg-success',
        'bg-red-600'
      ]
    }
  },
  darkMode: false,
  theme: {
    extend: {
      height: {
        '7.5': '1.75rem'
      },
      colors: {
        bg: '#373838',
        primary: '#232323',
        accent: '#1ad691',
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FB8C00',
        'black-50': '#bbbbbb',
        'black-100': '#666666',
        'black-200': '#555555',
        'black-300': '#444444',
        'black-400': '#333333',
        'black-500': '#222222',
        'black-600': '#111111',
        'black-700': '#101010'
      },
      cursor: {
        none: 'none'
      },
      fontFamily: {
        sans: ['Open Sans', ...defaultTheme.fontFamily.sans],
        mono: ['Ubuntu Mono', ...defaultTheme.fontFamily.mono],
        book: ['Gentium Book Basic', 'serif']
      }
    }
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
