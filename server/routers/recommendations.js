'use strict'

const express = require('express')

const requireAuth = (req, res, next) => {
  if (req.user && req.user.id) return next()
  return res.status(401).send('Unauthorized')
}

module.exports = ({ manager, featureFlag } = {}) => {
  const router = express.Router()

  const isEnabled = typeof featureFlag === 'function' ? featureFlag : () => String(process.env.RECOMMENDATIONS_ENABLED) === 'true'

  router.use((req, res, next) => {
    if (!isEnabled()) return res.status(501).json({ message: 'Recommendations disabled' })
    next()
  })

  const Controller = require('../controllers/recommendationsController')(manager)

  router.get('/tags', Controller.listTags)
  router.post('/', requireAuth, Controller.create)
  router.get('/book/:bookId', Controller.byBook)
  router.get('/inbox', requireAuth, Controller.inbox)
  router.get('/sent', requireAuth, Controller.sent)
  router.put('/:id', requireAuth, Controller.update)
  router.delete('/:id', requireAuth, Controller.destroy)

  return router
}
