const express = require('express')
const Path = require('path')
const { getAudioMimeTypeFromExtname } = require('../utils/fileUtils')

class StaticRouter {
  constructor(db) {
    this.db = db

    this.router = express()
    this.init()
  }

  init() {
    // Library Item static file routes
    this.router.get('/item/:id/*', (req, res) => {
      var item = this.db.libraryItems.find(ab => ab.id === req.params.id)
      if (!item) return res.status(404).send('Item not found with id ' + req.params.id)

      var remainingPath = req.params['0']
      var fullPath = null
      if (item.isFile) fullPath = item.path
      else fullPath = Path.join(item.path, remainingPath)

      var opts = {}

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