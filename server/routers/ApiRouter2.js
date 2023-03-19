const express = require('express')
const LibraryItemController = require('../controllers2/LibraryItemController')

class ApiRouter2 {
  constructor(Server) {
    this.router = express()
    this.router.disable('x-powered-by')
    this.init()
  }

  init() {
    this.router.get('/items/:id', LibraryItemController.get.bind(this))
  }
}
module.exports = ApiRouter2
