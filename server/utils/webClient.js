const Path = require('path')
const fs = require('../libs/fsExtra')
const express = require('express')
const Logger = require('../Logger')

/**
 * Fork addition: serve the standalone React client (web/) at `<base>/web/`.
 * Only active when WEB_CLIENT_PATH points at its build (web/dist); otherwise nothing changes
 * and the stock client is served exactly as before.
 *
 * @param {import('express').Router} router - router mounted at global.RouterBasePath
 */
function mountWebClient(router) {
  const webClientPath = process.env.WEB_CLIENT_PATH
  if (!webClientPath) return

  const indexPath = Path.join(webClientPath, 'index.html')
  if (!fs.existsSync(indexPath)) {
    Logger.error(`[WebClient] WEB_CLIENT_PATH is set but "${indexPath}" does not exist - not serving web client`)
    return
  }
  Logger.info(`[WebClient] Serving web client from "${webClientPath}" at "${global.RouterBasePath}/web"`)

  // Vite fingerprints everything under assets/, so it can be cached forever
  router.use('/web/assets', express.static(Path.join(webClientPath, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }))
  router.use('/web', express.static(webClientPath, { index: false }))

  // Client-side routes: always answer with index.html, never cached so new builds load
  router.get(['/web', '/web/*'], (req, res) => {
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(indexPath)
  })
}

module.exports = { mountWebClient }
