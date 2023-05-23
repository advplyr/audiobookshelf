const { defineNuxtConfig } = require('@nuxt/bridge')
const pkg = require('./package.json')

module.exports = defineNuxtConfig({
  // Disable server-side rendering: https://go.nuxtjs.dev/ssr-mode
  ssr: false,
  target: 'server',
  dev: process.env.NODE_ENV !== 'production',
  env: {
    serverUrl: process.env.NODE_ENV === 'production' ? process.env.ROUTER_BASE_PATH || '' : 'http://localhost:3333',
    chromecastReceiver: 'FD1F76C5'
  },
  telemetry: false,

  runtimeConfig: {
    public: {
      version: pkg.version,
      routerBasePath: process.env.ROUTER_BASE_PATH || ''
    }
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
    ]
  },

  router: {
    // We must specify `./` during build to support dynamic router base paths (https://github.com/nuxt/nuxt/issues/10088)
    base: process.env.ROUTER_BASE_PATH || ''
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [
    '@/assets/app.css'
  ],

  favicon: '/favicon.ico',

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
    '@/plugins/constants.js',
    '@/plugins/init.client.js',
    '@/plugins/favicon.js',
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
    '@nuxtjs/tailwindcss',
    'pwa-nuxt-bridge',
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    'nuxt-socket-io',
    '@nuxtjs/axios',
    // '@/modules/rewritePwaManifest.js'
  ],

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
      theme_color: '#373838',
      mobileAppIOS: true,
      nativeUI: true
    },
    manifest: {
      publicPath: `${(process.env.ROUTER_BASE_PATH || '')}_nuxt`,
      name: 'Audiobookshelf',
      short_name: 'Audiobookshelf',
      display: 'standalone',
      background_color: '#373838',
      icons: [
        {
          src: 'icon.svg',
          sizes: "any"
        },
        {
          src: 'icon64.png',
          type: "image/png",
          sizes: "64x64"
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
      postcssOptions: {
        plugins: {
          tailwindcss: {},
          autoprefixer: {},
        },
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

  bridge: {
    capi: false,
    scriptSetup: false
  },

  nitro: {
    preset: './nitro.preset.js',
    devProxy: {
      [`${process.env.ROUTER_BASE_PATH || ''}/dev/`]: {
        target: `http://localhost:3333${process.env.ROUTER_BASE_PATH || ''}`,
        pathRewrite: { [`^${process.env.ROUTER_BASE_PATH || ''}/dev/`]: process.env.ROUTER_BASE_PATH || '' }
      },
      [`${process.env.ROUTER_BASE_PATH || ''}/ebook/`]: {
        target: (process.env.NODE_ENV !== 'production' ? 'http://localhost:3333' : '') + `${process.env.ROUTER_BASE_PATH || ''}/`
      },
      [`${process.env.ROUTER_BASE_PATH || ''}/s/`]: {
        target: (process.env.NODE_ENV !== 'production' ? 'http://localhost:3333' : '') + `${process.env.ROUTER_BASE_PATH || ''}/`
      }
    }
  },

  hooks: {
    // 'nitro:config': (config) => {
    //   console.log('nitro:config', config)
    //   process.exit(0)
    // },
  },

  /**
 * Temporary workaround for @nuxt-community/tailwindcss-module.
 *
 * Reported: 2022-05-23
 * See: [Issue tracker](https://github.com/nuxt-community/tailwindcss-module/issues/480)
 */
  devServerHandlers: [],
})
