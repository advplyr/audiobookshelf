// server/routers/recommendations.js
// Community recommendations API (minimal)
const express = require('express')
const { Op } = require('sequelize')
const Database = require('../Database')
const sessionOrJwt = require('../middleware/sessionOrJwt')
const requireAuthFactory = require('../middleware/requireAuth')

const DEFAULT_TAGS = [
  { slug: 'fiction', label: 'Fiction' },
  { slug: 'non-fiction', label: 'Non-Fiction' },
  { slug: 'mystery', label: 'Mystery' },
  { slug: 'romance', label: 'Romance' },
  { slug: 'science-fiction', label: 'Science Fiction' },
  { slug: 'fantasy', label: 'Fantasy' },
  { slug: 'biography', label: 'Biography' },
  { slug: 'history', label: 'History' },
  { slug: 'self-help', label: 'Self-Help' },
  { slug: 'young-adult', label: 'Young Adult' }
]

function enabled(res) {
  if (String(process.env.RECOMMENDATIONS_ENABLED) !== 'true') {
    res.status(501).json({ message: 'Recommendations disabled' })
    return false
  }
  return true
}
const sanitizeNote = (n) => { if (!n) return null; n = String(n).trim(); return n.length > 1000 ? n.slice(0, 1000) : n }

// Common include that also brings back the media title
const BASE_INCLUDE = [
  { association: 'tag', attributes: ['id', 'slug', 'label'] },
  { association: 'recommender', attributes: ['id', 'username'] },
  { association: 'recipient', attributes: ['id', 'username'] },
  {
    association: 'item',
    attributes: ['id'],
    include: [
      { association: 'book', attributes: ['id', 'title'] },
      { association: 'podcast', attributes: ['id', 'title'] }
    ]
  }
]

// helper to flatten title
const addBookTitle = (rowsOrInstance) => {
  const toJSON = (r) => (typeof r?.toJSON === 'function' ? r.toJSON() : r || {})
  const shape = (j) => ({ ...j, bookTitle: j?.item?.book?.title || j?.item?.podcast?.title || null })

  if (Array.isArray(rowsOrInstance)) return rowsOrInstance.map((r) => shape(toJSON(r)))
  if (rowsOrInstance) return shape(toJSON(rowsOrInstance))
  return rowsOrInstance
}

module.exports = (auth) => {
  const router = express.Router()
  const requireAuth = requireAuthFactory(auth)

  router.use(sessionOrJwt(auth))

  // GET /tags (public)
  router.get('/tags', async (req, res) => {
    if (!enabled(res)) return
    const Tag = Database.recommendationTagModel
    if ((await Tag.count()) === 0) {
      const now = new Date()
      await Tag.bulkCreate(DEFAULT_TAGS.map((t) => ({ ...t, isActive: true, createdAt: now, updatedAt: now })))
    }
    const tags = await Tag.findAll({
      where: { isActive: true },
      order: [['label', 'ASC']],
      attributes: ['id', 'slug', 'label']
    })
    res.json(tags)
  })

  // POST / (create; auth)
  router.post('/', requireAuth, async (req, res) => {
    if (!enabled(res)) return
    const { bookId, tagSlug, tagId, recipientUserId, note, visibility } = req.body || {}
    if (!bookId) return res.status(400).json({ message: 'bookId is required' })
    if (!tagSlug && !tagId) return res.status(400).json({ message: 'tagSlug or tagId is required' })

    const Tag = Database.recommendationTagModel
    const tag = tagId
      ? await Tag.findByPk(tagId)
      : await Tag.findOne({ where: { slug: String(tagSlug).toLowerCase() } })
    if (!tag || tag.isActive === false) return res.status(400).json({ message: 'Invalid tag' })

    let recip = null
    if (recipientUserId) {
      recip = await Database.userModel.findByPk(recipientUserId)
      if (!recip) return res.status(400).json({ message: 'Recipient not found' })
    }

    const created = await Database.bookRecommendationModel.create({
      bookId: String(bookId),
      tagId: tag.id,
      recommenderUserId: req.user.id,
      recipientUserId: recip ? recip.id : null,
      note: sanitizeNote(note),
      visibility: visibility === 'recipient-only' ? 'recipient-only' : 'public'
    })

    const full = await Database.bookRecommendationModel.findByPk(created.id, { include: BASE_INCLUDE })
    res.status(201).json(addBookTitle(full))
  })

  // GET /book/:bookId
  router.get('/book/:bookId', async (req, res) => {
    if (!enabled(res)) return
    const me = req.user || null
    const where = {
      bookId: String(req.params.bookId),
      [Op.or]: [
        { visibility: 'public' },
        me
          ? {
              [Op.and]: [
                { visibility: 'recipient-only' },
                { [Op.or]: [{ recommenderUserId: me.id }, { recipientUserId: me.id }] }
              ]
            }
          : { id: null }
      ]
    }
    const rows = await Database.bookRecommendationModel.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: BASE_INCLUDE,
      limit: Math.min(Number(req.query.limit) || 50, 100),
      offset: Number(req.query.offset) || 0
    })
    res.json(addBookTitle(rows))
  })

  // GET /inbox (auth)
  router.get('/inbox', requireAuth, async (req, res) => {
    if (!enabled(res)) return
    const me = req.user.id
    const { bookId, tagSlug } = req.query

    const where = {
      [Op.or]: [
        { recipientUserId: me },
        { [Op.and]: [{ visibility: 'public' }, { recommenderUserId: { [Op.ne]: me } }] }
      ]
    }
    if (bookId) where.bookId = String(bookId)
    if (tagSlug) {
      const tag = await Database.recommendationTagModel.findOne({
        where: { slug: String(tagSlug).toLowerCase() }
      })
      if (!tag) return res.json([])
      where.tagId = tag.id
    }

    const rows = await Database.bookRecommendationModel.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: BASE_INCLUDE,
      limit: Math.min(Number(req.query.limit) || 50, 100),
      offset: Number(req.query.offset) || 0
    })
    res.json(addBookTitle(rows))
  })

  // GET /sent (auth)
  router.get('/sent', requireAuth, async (req, res) => {
    if (!enabled(res)) return
    const rows = await Database.bookRecommendationModel.findAll({
      where: { recommenderUserId: req.user.id },
      order: [['createdAt', 'DESC']],
      include: BASE_INCLUDE,
      limit: Math.min(Number(req.query.limit) || 50, 100),
      offset: Number(req.query.offset) || 0
    })
    res.json(addBookTitle(rows))
  })

  // PUT /:id (auth + owner)
  router.put('/:id', requireAuth, async (req, res) => {
    if (!enabled(res)) return
    const rec = await Database.bookRecommendationModel.findByPk(req.params.id)
    if (!rec) return res.sendStatus(404)
    if (rec.recommenderUserId !== req.user.id) return res.sendStatus(403)

    const update = {}
    if (typeof req.body.note !== 'undefined') update.note = sanitizeNote(req.body.note)
    if (['public', 'recipient-only'].includes(req.body.visibility)) update.visibility = req.body.visibility
    if (req.body.tagId) {
      const tag = await Database.recommendationTagModel.findByPk(req.body.tagId)
      if (!tag || tag.isActive === false) return res.status(400).json({ message: 'Invalid tag' })
      update.tagId = tag.id
    }
    await rec.update(update)
    const full = await Database.bookRecommendationModel.findByPk(rec.id, { include: BASE_INCLUDE })
    res.json(addBookTitle(full))
  })

  // DELETE /:id (auth + owner)
  router.delete('/:id', requireAuth, async (req, res) => {
    if (!enabled(res)) return
    const rec = await Database.bookRecommendationModel.findByPk(req.params.id)
    if (!rec) return res.sendStatus(404)
    if (rec.recommenderUserId !== req.user.id) return res.sendStatus(403)
    await rec.destroy()
    res.sendStatus(204)
  })

  return router
}
