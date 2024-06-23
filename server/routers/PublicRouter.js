const express = require('express')
const ShareController = require('../controllers/ShareController')

class PublicRouter {
  constructor() {
    this.router = express()
    this.router.disable('x-powered-by')
    this.init()
  }

  init() {
    this.router.get('/share/:slug', ShareController.getMediaItemShareBySlug.bind(this))
  }
}
module.exports = PublicRouter
