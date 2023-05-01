const express = require('express')
const Path = require('path')
const childProcess = require('child_process')
const { createProxyMiddleware } = require('http-proxy-middleware');
const Logger = require('../Logger')

class ClientRouter {
  constructor(appRoot, clientPort = 3000, routerBasePath = '') {
    this.appRoot = appRoot
    this.clientPort = clientPort
    this.routerBasePath = routerBasePath

    this.client = null
    this.router = express()
    this.router.disable('x-powered-by')
    this.init()
  }

  init () {
    const target = `http://localhost:${this.clientPort}${this.routerBasePath || '/'}`
    this.router.use(createProxyMiddleware({ target, changeOrigin: true }));

    Logger.info(`[Client] Proxying requests to client on port :${this.clientPort}`)
  }

  start () {
    const clientDir = Path.join(this.appRoot, '/client')
    const clientPath = Path.join(clientDir, '/node_modules/@nuxt/cli/bin/nuxt-cli.js')
    this.client = childProcess.fork(clientPath, ["start"], { cwd: clientDir, stdio: 'pipe' })

    Logger.info(`[Client] Client started under port :${this.clientPort}`)

    this.client.stdout.on('data', (data) => {
      Logger.info('[Client]', data.toString().trim())
    })

    this.client.stderr.on('data', (data) => {
      Logger.error('[Client]', data.toString().trim())
    })

    this.client.on('exit', () => {
      Logger.info('[Client] Client exited unexpectedly, restarting...')
      this.start()
    })
  }

  stop () {
    if (this.client) {
      this.client.off('exit')
      this.client.kill()
    } else {
      Logger.error('Client not running')
    }
  }
}

module.exports = ClientRouter
