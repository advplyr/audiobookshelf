const express = require('express')
const mime = require('mime-types')
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
    const { handler } = await import(Path.join(clientDir, '.output/server/index.mjs'))
    this.client = handler
  }

  async start () {
    Logger.info('[Client] Starting')
    await this.init()

    this.router.use('/', this.client)
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
