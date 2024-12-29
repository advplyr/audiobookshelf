const { Request, Response } = require('express')
const Logger = require('../Logger')
const BookFinder = require('../finders/BookFinder')
const PodcastFinder = require('../finders/PodcastFinder')
const AuthorFinder = require('../finders/AuthorFinder')
const Database = require('../Database')
const { isValidASIN } = require('../utils')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class SearchController {
  constructor() {}

  /**
   * GET: /api/search/books
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findBooks(req, res) {
    const id = req.query.id
    const libraryItem = await Database.libraryItemModel.getOldById(id)
    const provider = req.query.provider || 'google'
    const title = req.query.title || ''
    const author = req.query.author || ''

    if (typeof provider !== 'string' || typeof title !== 'string' || typeof author !== 'string') {
      Logger.error(`[SearchController] findBooks: Invalid request query params`)
      return res.status(400).send('Invalid request query params')
    }

    const results = await BookFinder.search(libraryItem, provider, title, author)
    res.json(results)
  }

  /**
   * GET: /api/search/covers
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findCovers(req, res) {
    const query = req.query
    const podcast = query.podcast == 1

    if (!query.title || typeof query.title !== 'string') {
      Logger.error(`[SearchController] findCovers: Invalid title sent in query`)
      return res.sendStatus(400)
    }

    let results = null
    if (podcast) results = await PodcastFinder.findCovers(query.title)
    else results = await BookFinder.findCovers(query.provider || 'google', query.title, query.author || '')
    res.json({
      results
    })
  }

  /**
   * GET: /api/search/podcasts
   * Find podcast RSS feeds given a term
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findPodcasts(req, res) {
    const term = req.query.term
    const country = req.query.country || 'us'
    if (!term) {
      Logger.error('[SearchController] Invalid request query param "term" is required')
      return res.status(400).send('Invalid request query param "term" is required')
    }

    const results = await PodcastFinder.search(term, {
      country
    })
    res.json(results)
  }

  /**
   * GET: /api/search/authors
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findAuthor(req, res) {
    const query = req.query.q
    if (!query || typeof query !== 'string') {
      Logger.error(`[SearchController] findAuthor: Invalid query param`)
      return res.status(400).send('Invalid query param')
    }

    const author = await AuthorFinder.findAuthorByName(query)
    res.json(author)
  }

  /**
   * GET: /api/search/chapters
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findChapters(req, res) {
    const asin = req.query.asin
    if (!isValidASIN(asin.toUpperCase())) {
      return res.json({ error: 'Invalid ASIN' })
    }
    const region = (req.query.region || 'us').toLowerCase()
    const chapterData = await BookFinder.findChapters(asin, region)
    if (!chapterData) {
      return res.json({ error: 'Chapters not found' })
    }
    res.json(chapterData)
  }
}
module.exports = new SearchController()
