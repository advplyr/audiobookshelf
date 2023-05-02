const express = require('express')
const Path = require('path')
const Logger = require('../Logger')

class ClientRouter {
  constructor(appRoot, routerBasePath = '') {
    this.appRoot = appRoot
    this.routerBasePath = routerBasePath

    this.client = null
    this.router = express()
    this.router.disable('x-powered-by')
  }

  async init () {
    const clientDir = Path.join(this.appRoot, '/client')
    const { loadNuxt } = require(Path.resolve(clientDir, 'node_modules/nuxt'))
    this.client = await loadNuxt({ rootDir: clientDir, for: 'start' })
  }

  async start () {
    Logger.info('[Client] Starting')
    await this.init()

    this.router.use(this.client.render)

    this.client.hook('error', (err) => Logger.error('[Client]', err))
    this.client.ready().then(() => Logger.info('[Client] Ready'))
  }

  async stop () {
    if (this.client) {
      await this.client.close()
      Logger.info('[Client] Stopped')
    } else {
      Logger.error('Client not running')
    }
  }
}

module.exports = ClientRouter
