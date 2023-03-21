const express = require('express')
const items = require('./items')
const libraries = require('./libraries')

const router = express.Router()

router.use('/items', items)
router.use('/libraries', libraries)

module.exports = router