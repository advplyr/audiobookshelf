'use strict'

module.exports = (injectedManager) => {
  const RecommendationManager = injectedManager || require('../managers/RecommendationManager')

  return {
    async listTags(req, res) {
      await RecommendationManager.ensureTagsSeeded()
      const tags = await RecommendationManager.getActiveTags()
      res.json(tags)
    },

    async create(req, res) {
      const userId = req.user?.id
      if (!userId) return res.status(401).send('Unauthorized')

      const { bookId, tagId, tagSlug, recipientUserId, note, visibility } = req.body || {}
      if (!bookId) return res.status(400).json({ message: 'bookId is required' })
      if (!tagId && !tagSlug) return res.status(400).json({ message: 'tagId or tagSlug is required' })

      const { data, error } = await RecommendationManager.createRecommendation({
        userId,
        bookId,
        tagId,
        tagSlug,
        recipientUserId,
        note,
        visibility
      })
      if (error) return res.status(error.status || 400).json({ message: error.message || 'Invalid request' })
      res.status(201).json(data)
    },

    async byBook(req, res) {
      const rows = await RecommendationManager.getBookFeed({
        bookId: req.params.bookId,
        me: req.user || null,
        limit: req.query.limit,
        offset: req.query.offset
      })
      res.json(rows)
    },

    async inbox(req, res) {
      const userId = req.user?.id
      if (!userId) return res.status(401).send('Unauthorized')

      const rows = await RecommendationManager.getInbox({
        userId,
        bookId: req.query.bookId,
        tagSlug: req.query.tagSlug,
        limit: req.query.limit,
        offset: req.query.offset
      })
      res.json(rows)
    },

    async sent(req, res) {
      const userId = req.user?.id
      if (!userId) return res.status(401).send('Unauthorized')

      const rows = await RecommendationManager.getSent({
        userId,
        limit: req.query.limit,
        offset: req.query.offset
      })
      res.json(rows)
    },

    async update(req, res) {
      const userId = req.user?.id
      if (!userId) return res.status(401).send('Unauthorized')

      const { data, error } = await RecommendationManager.updateRecommendation({
        id: req.params.id,
        userId,
        note: req.body?.note,
        visibility: req.body?.visibility,
        tagId: req.body?.tagId
      })
      if (error) {
        if (error.message) return res.status(error.status || 400).json({ message: error.message })
        return res.sendStatus(error.status || 400)
      }
      res.json(data)
    },

    async destroy(req, res) {
      const userId = req.user?.id
      if (!userId) return res.status(401).send('Unauthorized')

      const { error } = await RecommendationManager.deleteRecommendation({
        id: req.params.id,
        userId
      })
      if (error) return res.sendStatus(error.status || 400)
      res.sendStatus(204)
    }
  }
}
