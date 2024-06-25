module.exports = {
  content: ['components/**/*.vue', 'layouts/**/*.vue', 'pages/**/*.vue', 'templates/**/*.vue', 'plugins/**/*.js', 'nuxt.config.js'],
  safelist: ['bg-red-600', 'px-1.5', 'min-w-5', 'border-warning'],
  theme: {
    extend: {
      height: {
        7.5: '1.75rem',
        18: '4.5rem',
        45: '11.25rem'
      },
      width: {
        18: '4.5rem'
      },
      maxWidth: {
        6: '1.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        32: '8rem',
        40: '10rem',
        48: '12rem',
        52: '13rem',
        64: '16rem',
        80: '20rem'
      },
      minWidth: {
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        26: '6.5rem',
        32: '8rem',
        48: '12rem',
        64: '16rem',
        80: '20rem'
      },
      spacing: {
        18: '4.5rem',
        '-54': '-13.5rem',
        // based on tailwind default config converted to em units, see client\node_modules\tailwindcss\stubs\config.full.js
        '0.5e': '0.125em',
        '1e': '0.25em',
        '1.5e': '0.375em',
        '2e': '0.5em',
        '2.5e': '0.625em',
        '3e': '0.75em',
        '3.5e': '0.875em',
        '4e': '1em',
        '5e': '1.25em',
        '6e': '1.5em',
        '7e': '1.75em',
        '8e': '2em',
        '9e': '2.25em',
        '10e': '2.5em',
        '11e': '2.75em',
        '12e': '3em',
        '14e': '3.5em',
        '16e': '4em',
        '20e': '5em',
        '24e': '6em',
        '28e': '7em',
        '32e': '8em',
        '36e': '9em',
        '40e': '10em',
        '44e': '11em',
        '48e': '12em',
        '52e': '13em',
        '56e': '14em',
        '60e': '15em',
        '64e': '16em',
        '72e': '18em',
        '80e': '20em',
        '96e': '24em'
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
        '2.5xl': '1.6875rem',
        '4.5xl': '2.625rem'
      },
      zIndex: {
        50: 50,
        60: 60
      }
    }
  },
  variants: {
    extend: {}
  },
  plugins: []
}
