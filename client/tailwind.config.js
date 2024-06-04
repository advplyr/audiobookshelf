/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['components/**/*.vue', 'layouts/**/*.vue', 'pages/**/*.vue', 'templates/**/*.vue', 'plugins/**/*.js', 'nuxt.config.js'],
  safelist: ['bg-red-600', 'px-1.5', 'min-w-5', 'border-warning'],
  theme: {
    extend: {
      height: {
        7.5: '1.75em',
        18: '4.5em',
        45: '11.25em'
      },
      width: {
        18: '4.5em'
      },
      maxWidth: {
        6: '1.5em',
        12: '3em',
        16: '4em',
        20: '5em',
        24: '6em',
        32: '8em',
        40: '10em',
        48: '12em',
        52: '13em',
        64: '16em',
        80: '20em'
      },
      minWidth: {
        5: '1.25em',
        6: '1.5em',
        8: '2em',
        10: '2.5em',
        12: '3em',
        16: '4em',
        20: '5em',
        24: '6em',
        26: '6.5em',
        32: '8em',
        48: '12em',
        64: '16em',
        80: '20em'
      },
      spacing: {
        18: '4.5em',
        '18r': '4.5rem',
        '-54': '-13.5em',
        '54r': '13.5rem',
        '0.5r': '0.125rem',
        '1r': '0.25rem',
        '1.5r': '0.375rem',
        '2r': '0.5rem',
        '2.5r': '0.625rem',
        '3r': '0.75rem',
        '3.5r': '0.875rem',
        '4r': '1rem',
        '5r': '1.25rem',
        '6r': '1.5rem',
        '7r': '1.75rem',
        '8r': '2rem',
        '9r': '2.25rem',
        '10r': '2.5rem',
        '11r': '2.75rem',
        '12r': '3rem',
        '14r': '3.5rem',
        '16r': '4rem',
        '20r': '5rem',
        '24r': '6rem',
        '28r': '7rem',
        '32r': '8rem',
        '36r': '9rem',
        '40r': '10rem',
        '44r': '11rem',
        '48r': '12rem',
        '52r': '13rem',
        '56r': '14rem',
        '60r': '15rem',
        '64r': '16rem',
        '72r': '18rem',
        '80r': '20rem',
        '96r': '24rem'
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
    },
    spacing: {
      // based on tailwind default config converted to em units, see client\node_modules\tailwindcss\stubs\config.full.js
      px: '1px',
      0: '0px',
      0.5: '0.125em',
      1: '0.25em',
      1.5: '0.375em',
      2: '0.5em',
      2.5: '0.625em',
      3: '0.75em',
      3.5: '0.875em',
      4: '1em',
      5: '1.25em',
      6: '1.5em',
      7: '1.75em',
      8: '2em',
      9: '2.25em',
      10: '2.5em',
      11: '2.75em',
      12: '3em',
      14: '3.5em',
      16: '4em',
      20: '5em',
      24: '6em',
      28: '7em',
      32: '8em',
      36: '9em',
      40: '10em',
      44: '11em',
      48: '12em',
      52: '13em',
      56: '14em',
      60: '15em',
      64: '16em',
      72: '18em',
      80: '20em',
      96: '24em'
    },
    fontSize: {
      // based on tailwind default config converted to em units, see client\node_modules\tailwindcss\stubs\config.full.js
      xs: ['0.75em', '1em'],
      sm: ['0.875em', '1.25em'],
      base: ['1em', '1.5em'],
      lg: ['1.125em', '1.75em'],
      xl: ['1.25em', '1.75em'],
      '2xl': ['1.5em', '2em'],
      '3xl': ['1.875em', '2.25em'],
      '4xl': ['2.25em', '2.5em'],
      '5xl': ['3em', '1'],
      '6xl': ['3.75em', '1'],
      '7xl': ['4.5em', '1'],
      '8xl': ['6em', '1'],
      '9xl': ['8em', '1']
    }
  },
  variants: {
    extend: {}
  },
  plugins: []
}
