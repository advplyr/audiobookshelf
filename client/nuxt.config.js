const pkg = require('./package.json')

module.exports = {
  // Disable server-side rendering: https://go.nuxtjs.dev/ssr-mode
  ssr: false,
  target: 'static',
  dev: process.env.NODE_ENV !== 'production',
  env: {
    serverUrl: process.env.NODE_ENV === 'production' ? process.env.ROUTER_BASE_PATH || '' : 'http://localhost:3333',
    chromecastReceiver: 'FD1F76C5'
  },
  telemetry: false,

  publicRuntimeConfig: {
    version: pkg.version,
    routerBasePath: process.env.ROUTER_BASE_PATH || ''
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
      { hid: 'description', name: 'description', content: '' },
      { hid: 'robots', name: 'robots', content: 'noindex' }
    ],
    script: [],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: (process.env.ROUTER_BASE_PATH || '') + '/favicon.ico' },
      { rel: 'apple-touch-icon', href: (process.env.ROUTER_BASE_PATH || '') + '/ios_icon.png' }
    ]
  },

  router: {
    base: process.env.ROUTER_BASE_PATH || ''
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [
    '@/assets/tailwind.css',
    '@/assets/app.css'
  ],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
    '@/plugins/constants.js',
    '@/plugins/init.client.js',
    '@/plugins/axios.js',
    '@/plugins/toast.js',
    '@/plugins/utils.js',
    '@/plugins/i18n.js'
  ],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    // https://go.nuxtjs.dev/tailwindcss
    '@nuxtjs/pwa'
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    'nuxt-socket-io',
    '@nuxtjs/axios',
    '@nuxtjs/proxy'
  ],

  proxy: {
    '/api/': { target: process.env.NODE_ENV !== 'production' ? 'http://localhost:3333' : '/' },
    '/dev/': { target: 'http://localhost:3333', pathRewrite: { '^/dev/': '' } }
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
    baseURL: process.env.ROUTER_BASE_PATH || ''
  },

  // nuxt/pwa https://pwa.nuxtjs.org
  pwa: {
    icon: false,
    meta: {
      appleStatusBarStyle: 'black',
      name: 'Audiobookshelf',
      theme_color: '#232323',
      mobileAppIOS: true,
      nativeUI: true
    },
    manifest: {
      name: 'Audiobookshelf',
      short_name: 'Audiobookshelf',
      display: 'standalone',
      background_color: '#232323',
      icons: [
        {
          src: (process.env.ROUTER_BASE_PATH || '') + '/icon.svg',
          sizes: 'any'
        },
        {
          src: (process.env.ROUTER_BASE_PATH || '') + '/icon192.png',
          type: 'image/png',
          sizes: 'any'
        }
      ]
    },
    workbox: {
      offline: false,
      cacheAssets: false,
      preCaching: [],
      runtimeCaching: []
    }
  },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {
    postcss: {
      plugins: {
        tailwindcss: {},
        autoprefixer: {},
      },
    }
  },
  watchers: {
    webpack: {
      aggregateTimeout: 300,
      poll: 1000
    }
  },
  server: {
    port: process.env.NODE_ENV === 'production' ? 80 : 3000,
    host: '0.0.0.0'
  },

  /**
 * Temporary workaround for @nuxt-community/tailwindcss-module.
 *
 * Reported: 2022-05-23
 * See: [Issue tracker](https://github.com/nuxt-community/tailwindcss-module/issues/480)
 */
  devServerHandlers: [],

  ignore: ["**/*.test.*", "**/*.cy.*"]
}
