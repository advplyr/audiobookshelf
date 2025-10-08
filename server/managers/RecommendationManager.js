'use strict'

const { Op } = require('sequelize')
const Database = require('../Database')

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

const sanitizeNote = (n) => {
  if (!n) return null
  n = String(n).trim()
  return n.length > 1000 ? n.slice(0, 1000) : n
}

const clampLimit = (v, dflt = 50, max = 100) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return dflt
  return Math.min(n, max)
}

const toOffset = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

const addBookTitle = (rowsOrInstance) => {
  const toJSON = (r) => (typeof r?.toJSON === 'function' ? r.toJSON() : r || {})
  const shape = (j) => ({ ...j, bookTitle: j?.item?.book?.title || j?.item?.podcast?.title || null })
  if (Array.isArray(rowsOrInstance)) return rowsOrInstance.map((r) => shape(toJSON(r)))
  if (rowsOrInstance) return shape(toJSON(rowsOrInstance))
  return rowsOrInstance
}

const RecommendationManager = {
  async ensureTagsSeeded() {
    const Tag = Database.recommendationTagModel
    if ((await Tag.count()) > 0) return
    const now = new Date()
    await Tag.bulkCreate(DEFAULT_TAGS.map((t) => ({ ...t, isActive: true, createdAt: now, updatedAt: now })))
  },

  async getActiveTags() {
    const Tag = Database.recommendationTagModel
    const tags = await Tag.findAll({
      where: { isActive: true },
      order: [['label', 'ASC']],
      attributes: ['id', 'slug', 'label']
    })
    return tags
  },

  async resolveTag({ tagId, tagSlug }) {
    const Tag = Database.recommendationTagModel
    if (tagId) {
      const tag = await Tag.findByPk(tagId)
      return tag && tag.isActive ? tag : null
    }
    if (tagSlug) {
      const tag = await Tag.findOne({ where: { slug: String(tagSlug).toLowerCase(), isActive: true } })
      return tag || null
    }
    return null
  },

  async resolveRecipient({ recipientUserId, recipientUsername }) {
    const User = Database.userModel
    if (recipientUserId) {
      const u = await User.findByPk(recipientUserId)
      return u || null
    }
    if (recipientUsername) {
      const u = await User.findOne({ where: { username: String(recipientUsername) } })
      return u || null
    }
    return null
  },

  async createRecommendation({ userId, bookId, tagId, tagSlug, recipientUserId, recipientUsername, note, visibility }) {
    const tag = await this.resolveTag({ tagId, tagSlug })
    if (!tag) return { error: { status: 400, message: 'Invalid tag' } }

    if (visibility === 'recipient-only' && !recipientUserId && !recipientUsername) {
      return { error: { status: 400, message: 'Recipient is required for recipient-only visibility' } }
    }
    const recip = await this.resolveRecipient({ recipientUserId, recipientUsername })
    if (visibility === 'recipient-only' && !recip) {
      return { error: { status: 400, message: 'Recipient not found' } }
    }
    const created = await Database.bookRecommendationModel.create({
      bookId: String(bookId),
      tagId: tag.id,
      recommenderUserId: userId,
      recipientUserId: recip ? recip.id : null,
      note: sanitizeNote(note),
      visibility: visibility === 'recipient-only' ? 'recipient-only' : 'public'
    })

    const full = await Database.bookRecommendationModel.findByPk(created.id, { include: BASE_INCLUDE })
    return { data: addBookTitle(full) }
  },

  async getBookFeed({ bookId, me /* may be null */, limit, offset }) {
    const where = {
      bookId: String(bookId),
      [Op.or]: [
        { visibility: 'public' },
        me
          ? {
              [Op.and]: [{ visibility: 'recipient-only' }, { [Op.or]: [{ recommenderUserId: me.id }, { recipientUserId: me.id }] }]
            }
          : { id: null }
      ]
    }

    const rows = await Database.bookRecommendationModel.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: BASE_INCLUDE,
      limit: clampLimit(limit),
      offset: toOffset(offset)
    })
    return addBookTitle(rows)
  },

  async getInbox({ userId, bookId, tagSlug, limit, offset }) {
    const where = {
      [Op.or]: [{ recipientUserId: userId }, { [Op.and]: [{ visibility: 'public' }, { recommenderUserId: { [Op.ne]: userId } }] }]
    }
    if (bookId) where.bookId = String(bookId)
    if (tagSlug) {
      const tag = await Database.recommendationTagModel.findOne({
        where: { slug: String(tagSlug).toLowerCase(), isActive: true }
      })
      if (!tag) return []
      where.tagId = tag.id
    }

    const rows = await Database.bookRecommendationModel.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: BASE_INCLUDE,
      limit: clampLimit(limit),
      offset: toOffset(offset)
    })
    return addBookTitle(rows)
  },

  async getSent({ userId, limit, offset }) {
    const rows = await Database.bookRecommendationModel.findAll({
      where: { recommenderUserId: userId },
      order: [['createdAt', 'DESC']],
      include: BASE_INCLUDE,
      limit: clampLimit(limit),
      offset: toOffset(offset)
    })
    return addBookTitle(rows)
  },

  async updateRecommendation({ id, userId, note, visibility, tagId }) {
    const rec = await Database.bookRecommendationModel.findByPk(id)
    if (!rec) return { error: { status: 404 } }
    if (rec.recommenderUserId !== userId) return { error: { status: 403 } }

    const update = {}
    if (typeof note !== 'undefined') update.note = sanitizeNote(note)
    if (['public', 'recipient-only'].includes(visibility)) update.visibility = visibility
    if (tagId) {
      const tag = await Database.recommendationTagModel.findByPk(tagId)
      if (!tag || tag.isActive === false) return { error: { status: 400, message: 'Invalid tag' } }
      update.tagId = tag.id
    }

    await rec.update(update)
    const full = await Database.bookRecommendationModel.findByPk(rec.id, { include: BASE_INCLUDE })
    return { data: addBookTitle(full) }
  },

  async deleteRecommendation({ id, userId }) {
    const rec = await Database.bookRecommendationModel.findByPk(id)
    if (!rec) return { error: { status: 404 } }
    if (rec.recommenderUserId !== userId) return { error: { status: 403 } }
    await rec.destroy()
    return { ok: true }
  }
}

module.exports = RecommendationManager
