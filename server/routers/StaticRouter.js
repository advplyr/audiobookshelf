const express = require('express')
const Path = require('path')
const Logger = require('../Logger')
const { getAudioMimeTypeFromExtname } = require('../utils/fileUtils')

// TODO: Deprecated as of 2.2.21 edge
class StaticRouter {
  constructor(db) {
    this.db = db

    this.router = express()
    this.router.disable('x-powered-by')
    this.init()
  }

  init() {
    // Library Item static file routes
    this.router.get('/item/:id/*', (req, res) => {
      const item = this.db.libraryItems.find(ab => ab.id === req.params.id)
      if (!item) return res.status(404).send('Item not found with id ' + req.params.id)

      // Replace backslashes with forward slashes
      const remainingPath = req.params['0'].replace(/\\/g, '/')

      // Check user has access to this library item
      if (!req.user.checkCanAccessLibraryItem(item)) {
        Logger.error(`[StaticRouter] User attempted to access library item file without access ${remainingPath}`, req.user)
        return res.sendStatus(403)
      }

      // Prevent path traversal
      //  e.g. ../../etc/passwd
      if (/\/?\.?\.\//.test(remainingPath)) {
        Logger.error(`[StaticRouter] Invalid path to get library item file "${remainingPath}"`)
        return res.sendStatus(403)
      }

      const fullPath = item.isFile ? item.path : Path.join(item.path, remainingPath)

      // Allow reverse proxy to serve files directly
      // See: https://www.nginx.com/resources/wiki/start/topics/examples/x-accel/
      if (global.XAccel) {
        Logger.debug(`Use X-Accel to serve static file ${fullPath}`)
        return res.status(204).header({ 'X-Accel-Redirect': global.XAccel + fullPath }).send()
      }

      let opts = {}

      // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
      const audioMimeType = getAudioMimeTypeFromExtname(Path.extname(fullPath))
      if (audioMimeType) {
        opts = { headers: { 'Content-Type': audioMimeType } }
      }

      res.sendFile(fullPath, opts)
    })
  }
}
module.exports = StaticRouter