const express = require('express')
const libraries = require('./libraries')

const router = express.Router()

router.use('/libraries', libraries)

module.exports = router