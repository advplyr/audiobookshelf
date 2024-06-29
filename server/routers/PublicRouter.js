const express = require('express')
const ShareController = require('../controllers/ShareController')
const DLNAController = require('../controllers/DLNAController')

class PublicRouter {
  constructor(Server) {
    this.router = express()
    this.router.disable('x-powered-by')
    this.DLNAManager = Server.DLNAManager
    this.init()
  }

  init() {
    this.router.get('/share/:slug', ShareController.getMediaItemShareBySlug.bind(this))
    this.router.get('/dlna/:session/:id/track.*', DLNAController.get_file.bind(this))
  }
}
module.exports = PublicRouter
