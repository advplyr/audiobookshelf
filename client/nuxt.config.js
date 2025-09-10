const pkg = require('./package.json')

const routerBasePath = process.env.ROUTER_BASE_PATH ?? '/audiobookshelf'
const serverHostUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3333'
const serverPaths = ['api/', 'public/', 'hls/', 'auth/', 'feed/', 'status', 'login', 'logout', 'init']
const proxy = Object.fromEntries(serverPaths.map((path) => [`${routerBasePath}/${path}`, { target: process.env.NODE_ENV !== 'production' ? serverHostUrl : '/' }]))

module.exports = {
  ssr: false,
  target: 'static',
  dev: process.env.NODE_ENV !== 'production',
  env: {
    serverUrl: serverHostUrl + routerBasePath,
    chromecastReceiver: 'FD1F76C5'
  },
  telemetry: false,

  publicRuntimeConfig: {
    version: pkg.version,
    routerBasePath
  },

  head: {
    title: 'Audiobookshelf',
    htmlAttrs: { lang: 'en' },
    meta: [{ charset: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { hid: 'description', name: 'description', content: '' }, { hid: 'robots', name: 'robots', content: 'noindex' }],
    script: [],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: routerBasePath + '/favicon.ico' },
      { rel: 'apple-touch-icon', href: routerBasePath + '/ios_icon.png' }
    ]
  },

  router: { base: routerBasePath },

  css: ['@/assets/tailwind.css', '@/assets/app.css'],

  plugins: [
    '@/plugins/constants.js',
    '@/plugins/init.client.js',
    '@/plugins/axios.js',
    '@/plugins/toast.js',
    '@/plugins/utils.js',
    '@/plugins/i18n.js',

    // ✅ NEW: robust achievement hooks
    '@/plugins/achievements.routes.client.js',
    '@/plugins/achievements.axios.client.js',
    '@/plugins/achievement-hooks.client.js'
  ],

  components: true,

  buildModules: ['@nuxtjs/pwa'],

  modules: ['nuxt-socket-io', '@nuxtjs/axios', '@nuxtjs/proxy'],

  proxy,

  io: {
    sockets: [{ name: 'dev', url: serverHostUrl }, { name: 'prod' }]
  },

  axios: {
    baseURL: routerBasePath,
    progress: false
  },

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
        { src: routerBasePath + '/icon.svg', sizes: 'any' },
        { src: routerBasePath + '/icon192.png', type: 'image/png', sizes: 'any' }
      ]
    },
    workbox: { offline: false, cacheAssets: false, preCaching: [], runtimeCaching: [] }
  },

  build: {},
  watchers: { webpack: { aggregateTimeout: 300, poll: 1000 } },
  server: { port: process.env.NODE_ENV === 'production' ? 80 : 3000, host: '0.0.0.0' },

  // tailwind workaround
  devServerHandlers: [],

  ignore: ['**/*.test.*', '**/*.cy.*']
}
