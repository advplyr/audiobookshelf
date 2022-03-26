const express = require('express')
const Path = require('path')
const Logger = require('../Logger')

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
      var fullPath = Path.join(item.path, remainingPath)
      console.log('fullpath', fullPath)
      res.sendFile(fullPath)
    })
  }
}
module.exports = StaticRouter