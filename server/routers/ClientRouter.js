const express = require('express')
const Logger = require('../Logger')

class ClientRouter {
  constructor(appRoot, routerBasePath = '') {
    this.appRoot = appRoot
    this.routerBasePath = routerBasePath

    this.router = express()
    this.router.disable('x-powered-by')
  }

  async start () {
    Logger.info('[Client] Starting')

    const { handler } = require('../../client')
    this.router.use('/', handler)
  }
}

module.exports = ClientRouter
