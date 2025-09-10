// server/routers/achievements.js
const express = require('express')
const AchievementManager = require('../managers/AchievementManager')
const sessionOrJwt = require('../middleware/sessionOrJwt')

module.exports = ({ auth } = {}) => {
  if (!auth) throw new Error('[achievements router] Missing auth')

  const router = express.Router()
  const requireUser = sessionOrJwt(auth)

  // PUBLIC — catalog
  router.get('/catalog', async (req, res, next) => {
    try {
      const data = await AchievementManager.getCatalog()
      res.json(data)
    } catch (e) { next(e) }
  })

  // Needs user (session OR JWT) — also backfill/sync counts from DB
  router.get('/me', requireUser, async (req, res, next) => {
    try {
      const userId = String(req.user?.id || req.user?.userId || req.session?.userId)
      const progress = await AchievementManager.getUserProgress(userId, { syncFromDb: true })
      res.json(progress)
    } catch (e) { next(e) }
  })

  // Mark an achievement-related event as completed
  router.post('/complete', requireUser, express.json(), async (req, res, next) => {
    try {
      const userId = String(req.user?.id || req.user?.userId || req.session?.userId)
      const { event, meta } = req.body || {}
      if (!event) return res.status(400).json({ error: 'Missing event' })
      const result = await AchievementManager.applyEvent(userId, event, meta || {})
      res.json(result)
    } catch (e) { next(e) }
  })

  return router
}
