import Vue from 'vue'
import Router from 'vue-router'
import { normalizeURL, decode } from 'ufo'
import { interopDefault } from './utils'
import scrollBehavior from './router.scrollBehavior.js'

const _e09ac034 = () => interopDefault(import('..\\pages\\config\\index.vue' /* webpackChunkName: "pages/config/index" */))
const _4bf07cff = () => interopDefault(import('..\\pages\\login.vue' /* webpackChunkName: "pages/login" */))
const _4885a1ad = () => interopDefault(import('..\\pages\\audiobook\\_id\\index.vue' /* webpackChunkName: "pages/audiobook/_id/index" */))
const _73d517ff = () => interopDefault(import('..\\pages\\audiobook\\_id\\edit.vue' /* webpackChunkName: "pages/audiobook/_id/edit" */))
const _fb6e4c30 = () => interopDefault(import('..\\pages\\index.vue' /* webpackChunkName: "pages/index" */))

const emptyFn = () => {}

Vue.use(Router)

export const routerOptions = {
  mode: 'history',
  base: '/',
  linkActiveClass: 'nuxt-link-active',
  linkExactActiveClass: 'nuxt-link-exact-active',
  scrollBehavior,

  routes: [{
    path: "/config",
    component: _e09ac034,
    name: "config"
  }, {
    path: "/login",
    component: _4bf07cff,
    name: "login"
  }, {
    path: "/audiobook/:id",
    component: _4885a1ad,
    name: "audiobook-id"
  }, {
    path: "/audiobook/:id?/edit",
    component: _73d517ff,
    name: "audiobook-id-edit"
  }, {
    path: "/",
    component: _fb6e4c30,
    name: "index"
  }],

  fallback: false
}

export function createRouter (ssrContext, config) {
  const base = (config._app && config._app.basePath) || routerOptions.base
  const router = new Router({ ...routerOptions, base  })

  // TODO: remove in Nuxt 3
  const originalPush = router.push
  router.push = function push (location, onComplete = emptyFn, onAbort) {
    return originalPush.call(this, location, onComplete, onAbort)
  }

  const resolve = router.resolve.bind(router)
  router.resolve = (to, current, append) => {
    if (typeof to === 'string') {
      to = normalizeURL(to)
    }
    return resolve(to, current, append)
  }

  return router
}
