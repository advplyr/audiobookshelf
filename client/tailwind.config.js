module.exports = {
  content: [
    'components/**/*.vue',
    'layouts/**/*.vue',
    'pages/**/*.vue',
    'templates/**/*.vue',
    'plugins/**/*.js',
    'nuxt.config.js'
  ],
  safelist: [
    'bg-red-600',
    'px-1.5',
    'min-w-5',
    'border-warning'
  ],
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
        '40': '10rem',
        '48': '12rem',
        '52': '13rem',
        '64': '16rem',
        '80': '20rem'
      },
      minWidth: {
        '5': '1.25rem',
        '6': '1.5rem',
        '8': '2rem',
        '10': '2.5rem',
        '12': '3rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
        '26': '6.5rem',
        '32': '8rem',
        '48': '12rem',
        '64': '16rem',
        '80': '20rem'
      },
      spacing: {
        '18': '4.5rem',
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
        sans: ['Source Sans Pro'],
        mono: ['Ubuntu Mono']
      },
      fontSize: {
        xxs: '0.625rem',
        '1.5xl': '1.375rem',
        '2.5xl': '1.6875rem'
      },
      zIndex: {
        '50': 50,
        '60': 60
      }
    }
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
