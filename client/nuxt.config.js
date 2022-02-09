const pkg = require('./package.json')

module.exports = {
  // Disable server-side rendering: https://go.nuxtjs.dev/ssr-mode
  ssr: false,
  target: 'static',
  dev: process.env.NODE_ENV !== 'production',
  env: {
    serverUrl: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3333',
    // serverUrl: '',
    baseUrl: process.env.BASE_URL || 'http://0.0.0.0'
  },
  // rootDir: process.env.NODE_ENV !== 'production' ? 'client/' : '',
  telemetry: false,

  publicRuntimeConfig: {
    version: pkg.version
  },

  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: 'Audiobookshelf',
    htmlAttrs: {
      lang: 'en'
    },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: '' }
    ],
    script: [
      {
        src: '//cdn.jsdelivr.net/npm/sortablejs@1.8.4/Sortable.min.js'
      }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Ubuntu+Mono&family=Source+Sans+Pro:wght@300;400;600' },
      // { rel: 'stylesheet', href: 'https://fonts.googleapis.com/icon?family=Material+Icons' }
    ]
  },

  router: {
    middleware: ['routed']
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [
    '@/assets/app.css'
  ],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
    '@/plugins/constants.js',
    '@/plugins/init.client.js',
    '@/plugins/axios.js',
    '@/plugins/toast.js'
  ],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    // https://go.nuxtjs.dev/tailwindcss
    '@nuxtjs/tailwindcss',
    '@nuxtjs/pwa'
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    'nuxt-socket-io',
    '@nuxtjs/axios',
    '@nuxtjs/proxy'
  ],

  proxy: {
    '/dev/': { target: 'http://localhost:3333', pathRewrite: { '^/dev/': '' } },
    '/local/': { target: process.env.NODE_ENV !== 'production' ? 'http://localhost:3333' : '/' },
    '/lib/': { target: process.env.NODE_ENV !== 'production' ? 'http://localhost:3333' : '/' },
    '/ebook/': { target: process.env.NODE_ENV !== 'production' ? 'http://localhost:3333' : '/' },
    '/s/': { target: process.env.NODE_ENV !== 'production' ? 'http://localhost:3333' : '/' },
    '/metadata/': { target: process.env.NODE_ENV !== 'production' ? 'http://localhost:3333' : '/' }
  },

  io: {
    sockets: [{
      name: 'dev',
      url: 'http://localhost:3333'
    },
    {
      name: 'prod'
    }]
  },

  // Axios module configuration: https://go.nuxtjs.dev/config-axios
  axios: {
    baseURL: process.env.serverUrl || ''
  },

  // nuxt/pwa https://pwa.nuxtjs.org
  pwa: {
    icon: false,
    meta: {
      appleStatusBarStyle: 'black',
      name: 'Audiobookshelf',
      theme_color: '#373838',
      mobileAppIOS: true,
      nativeUI: true
    },
    manifest: {
      name: 'Audiobookshelf',
      short_name: 'Audiobookshelf',
      display: 'standalone',
      background_color: '#373838',
      icons: [
        {
          src: '/icon64.png',
          sizes: "64x64"
        },
        {
          src: '/icon192.png',
          sizes: "192x192"
        },
        {
          src: '/Logo.png',
          sizes: "512x512"
        }
      ]
    }
  },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {},
  watchers: {
    webpack: {
      aggregateTimeout: 300,
      poll: 1000
    }
  },
  server: {
    port: process.env.NODE_ENV === 'production' ? 80 : 3000,
    host: process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'
  }
}
