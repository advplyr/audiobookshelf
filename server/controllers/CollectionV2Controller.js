const { Request, Response, NextFunction } = require('express')

const collectionFilters = require('../utils/queries/collectionFilters')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestLibraryObject
 * @property {import('../models/Library')} library
 *
 * @typedef CollectionSummaryQueryObject
 * @property {number} page
 * @property {number} limit
 * @property {string} sort
 * @property {boolean} desc
 * @property {string} filter
 *
 * @typedef {RequestWithUser & RequestLibraryObject & { collectionSummaryQuery: CollectionSummaryQueryObject }} CollectionV2ControllerRequest
 */

const defaultQuery = {
  page: 0,
  limit: 20,
  sort: 'name',
  desc: false,
  filter: ''
}

class CollectionV2Controller {
  constructor() {}

  /**
   * Preserve raw v2 values before the shared library middleware normalizes pagination.
   *
   * @param {Request} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  captureQuery(req, res, next) {
    req.collectionSummaryRawQuery = { ...req.query }
    next()
  }

  /**
   * Validate and normalize collection query parameters
   *
   * @param {Request} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  validateQuery(req, res, next) {
    const query = req.collectionSummaryRawQuery || req.query
    const integerPattern = /^(0|[1-9]\d*)$/

    if (query.page !== undefined && (typeof query.page !== 'string' || !integerPattern.test(query.page))) {
      return res.status(400).send('Invalid request. Page must be a non-negative integer')
    }
    if (query.limit !== undefined && (typeof query.limit !== 'string' || !integerPattern.test(query.limit))) {
      return res.status(400).send('Invalid request. Limit must be an integer between 1 and 100')
    }
    if (query.sort !== undefined && (typeof query.sort !== 'string' || !['name', 'createdAt', 'updatedAt'].includes(query.sort))) {
      return res.status(400).send('Invalid request. Sort must be name, createdAt, or updatedAt')
    }
    if (query.desc !== undefined && (typeof query.desc !== 'string' || !['0', '1'].includes(query.desc))) {
      return res.status(400).send('Invalid request. Desc must be 0 or 1')
    }
    if (query.filter !== undefined && typeof query.filter !== 'string') {
      return res.status(400).send('Invalid request. Filter must be a string')
    }

    const page = query.page === undefined ? defaultQuery.page : Number(query.page)
    const limit = query.limit === undefined ? defaultQuery.limit : Number(query.limit)

    if (!Number.isSafeInteger(page)) {
      return res.status(400).send('Invalid request. Page must be a non-negative integer')
    }
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).send('Invalid request. Limit must be an integer between 1 and 100')
    }
    if (!Number.isSafeInteger(page * limit)) {
      return res.status(400).send('Invalid request. Page and limit exceed the supported range')
    }

    req.collectionSummaryQuery = {
      page,
      limit,
      sort: query.sort || defaultQuery.sort,
      desc: query.desc === '1',
      filter: query.filter || defaultQuery.filter
    }
    next()
  }

  /**
   * GET: /api/v2/libraries/:id/collections
   *
   * @param {CollectionV2ControllerRequest} req
   * @param {Response} res
   */
  async findAll(req, res) {
    const options = req.collectionSummaryQuery
    const payload = await collectionFilters.getCollectionSummaries({
      libraryId: req.library.id,
      user: req.user,
      ...options
    })

    res.json({
      ...payload,
      limit: options.limit,
      page: options.page,
      sortBy: options.sort,
      sortDesc: options.desc,
      filterBy: options.filter
    })
  }
}

module.exports = new CollectionV2Controller()
