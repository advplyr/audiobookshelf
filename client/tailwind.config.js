const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  purge: {
    options: {
      safelist: [
        'bg-success',
        'bg-red-600',
        'text-green-500',
        'py-1.5',
        'bg-info',
        'px-1.5'
      ]
    }
  },
  darkMode: false,
  theme: {
    extend: {
      height: {
        '7.5': '1.75rem',
        '18': '4.5rem',
        '45': '11.25rem'
      },
      width: {
        '18': '4.5rem'
      },
      maxWidth: {
        '6': '1.5rem',
        '12': '3rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
        '32': '8rem',
        '48': '12rem',
        '64': '16rem',
        '80': '20rem'
      },
      minWidth: {
        '6': '1.5rem',
        '12': '3rem',
        '16': '4rem',
        '24': '6rem',
        '32': '8rem',
        '48': '12rem',
        '64': '16rem',
        '80': '20rem'
      },
      spacing: {
        '-54': '-13.5rem'
      },
      rotate: {
        '-60': '-60deg'
      },
      colors: {
        bg: '#373838',
        primary: '#232323',
        accent: '#1ad691',
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FB8C00',
        darkgreen: 'rgb(34,127,35)',
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
        sans: ['Source Sans Pro', ...defaultTheme.fontFamily.sans],
        mono: ['Ubuntu Mono', ...defaultTheme.fontFamily.mono],
        book: ['Gentium Book Basic', 'serif']
      },
      fontSize: {
        xxs: '0.625rem'
      },
      zIndex: {
        '50': 50
      }
    }
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
