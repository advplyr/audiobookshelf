const express = require('express')
const LibraryController = require('../controllers2/library.controller')

const router = express.Router()

router.get('/', LibraryController.getAllLibraries)
router.get('/:id', LibraryController.getLibrary)
router.get('/:id/items', LibraryController.getLibraryItems)

module.exports = router