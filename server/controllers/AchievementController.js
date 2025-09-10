// server/controllers/AchievementController.js

const AchievementManager = require('../managers/AchievementManager')

/**
 * Controller for Achievement endpoints.
 * You can wire these handlers from any Express router:
 *
 *   const ctrl = require('../controllers/AchievementController')
 *   router.get('/catalog', ctrl.catalog)
 *   router.get('/me', auth.jwtAuthCheck, ctrl.me)
 *   router.post('/complete', auth.jwtAuthCheck, express.json(), ctrl.complete)
 */
module.exports = {
  /**
   * GET /api/achievements/catalog
   * Public — returns the full catalog (collections + badges).
   */
  async catalog(req, res, next) {
    try {
      const data = await AchievementManager.getCatalog()
      res.json(data)
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /api/achievements/me
   * Authenticated — returns the caller's progress.
   */
  async me(req, res, next) {
    try {
      const userId = String(req.user?.id || req.user?.userId || '')
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })

      const progress = await AchievementManager.getUserProgress(userId)
      res.json(progress)
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /api/achievements/complete
   * Authenticated — applies a user event and returns any newly unlocked badges.
   * Expects: { event: string, meta?: object }
   */
  async complete(req, res, next) {
    try {
      const userId = String(req.user?.id || req.user?.userId || '')
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })

      const { event, meta } = req.body || {}
      if (!event) return res.status(400).json({ error: 'Missing event' })

      const result = await AchievementManager.applyEvent(userId, event, meta || {})
      res.json(result)
    } catch (err) {
      next(err)
    }
  },

  async getCatalog(req, res, next) {
    try {
      const data = await AchievementManager.getCatalog()
      res.json(data)
    } catch (err) {
      next(err)
    }
  },

  async getUserAchievements(req, res, next) {
    try {
      const userId = String(req.user?.id || req.user?.userId || '')
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })

      const achievements = await AchievementManager.getUserAchievements(userId)
      res.json(achievements)
    } catch (err) {
      next(err)
    }
  },

  async getMyAchievements(req, res, next) {
    try {
      const userId = String(req.user?.id || req.user?.userId || '')
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })

      const myAchievements = await AchievementManager.getMyAchievements(userId)
      res.json(myAchievements)
    } catch (err) {
      next(err)
    }
  },

  async completeItem(req, res, next) {
    try {
      const userId = String(req.user?.id || req.user?.userId || '')
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })

      const { itemId } = req.body || {}
      if (!itemId) return res.status(400).json({ error: 'Missing item ID' })

      const result = await AchievementManager.completeItem(userId, itemId)
      res.json(result)
    } catch (err) {
      next(err)
    }
  }
}
