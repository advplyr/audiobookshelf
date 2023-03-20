const express = require('express')
const LibraryItemController = require('../controllers2/item.controller')

const router = express.Router()

router.get('/:id', LibraryItemController.getLibraryItem)

module.exports = router