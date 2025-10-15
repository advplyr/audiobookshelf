const { Request, Response } = require('express')
const Logger = require('../Logger')
const BookFinder = require('../finders/BookFinder')
const PodcastFinder = require('../finders/PodcastFinder')
const AuthorFinder = require('../finders/AuthorFinder')
const Database = require('../Database')
const { isValidASIN, getQueryParamAsString } = require('../utils')

// Provider name mappings for display purposes
const providerMap = {
  all: 'All',
  best: 'Best',
  google: 'Google Books',
  itunes: 'iTunes',
  openlibrary: 'Open Library',
  fantlab: 'FantLab.ru',
  audiobookcovers: 'AudiobookCovers.com',
  audible: 'Audible.com',
  'audible.ca': 'Audible.ca',
  'audible.uk': 'Audible.co.uk',
  'audible.au': 'Audible.com.au',
  'audible.fr': 'Audible.fr',
  'audible.de': 'Audible.de',
  'audible.jp': 'Audible.co.jp',
  'audible.it': 'Audible.it',
  'audible.in': 'Audible.in',
  'audible.es': 'Audible.es',
  audnexus: 'Audnexus'
}

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class SearchController {
  constructor() {}

  /**
   * Validates that multiple parameters are strings
   * @param {Object} params - Object with param names as keys and values to validate
   * @param {string} methodName - Name of the calling method for logging
   * @returns {{valid: boolean, error?: {status: number, message: string}}}
   */
  static validateStringParams(params, methodName) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value !== 'string') {
        Logger.error(`[SearchController] ${methodName}: Invalid ${key} parameter`)
        return {
          valid: false,
          error: {
            status: 400,
            message: 'Invalid request query params'
          }
        }
      }
    }
    return { valid: true }
  }

  /**
   * Validates that a required string parameter exists and is a string
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for logging
   * @param {string} methodName - Name of the calling method for logging
   * @returns {{valid: boolean, error?: {status: number, message: string}}}
   */
  static validateRequiredString(value, paramName, methodName) {
    if (!value || typeof value !== 'string') {
      Logger.error(`[SearchController] ${methodName}: Invalid or missing ${paramName}`)
      return {
        valid: false,
        error: {
          status: 400,
          message: `Invalid or missing ${paramName}`
        }
      }
    }
    return { valid: true }
  }

  /**
   * Validates and fetches a library item by ID
   * @param {string} id - Library item ID
   * @param {string} methodName - Name of the calling method for logging
   * @returns {Promise<{valid: boolean, libraryItem?: any, error?: {status: number, message: string}}>}
   */
  static async fetchAndValidateLibraryItem(id, methodName) {
    const validation = SearchController.validateRequiredString(id, 'library item id', methodName)
    if (!validation.valid) {
      return validation
    }

    const libraryItem = await Database.libraryItemModel.getExpandedById(id)
    if (!libraryItem) {
      Logger.error(`[SearchController] ${methodName}: Library item not found with id "${id}"`)
      return {
        valid: false,
        error: {
          status: 404,
          message: 'Library item not found'
        }
      }
    }

    return { valid: true, libraryItem }
  }

  /**
   * Maps custom metadata providers to standardized format
   * @param {Array} providers - Array of custom provider objects
   * @returns {Array<{value: string, text: string}>}
   */
  static mapCustomProviders(providers) {
    return providers.map((provider) => ({
      value: provider.getSlug(),
      text: provider.name
    }))
  }

  /**
   * Static helper method to format provider for client (for use in array methods)
   * @param {string} providerValue - Provider identifier
   * @returns {{value: string, text: string}}
   */
  static formatProvider(providerValue) {
    return {
      value: providerValue,
      text: providerMap[providerValue] || providerValue
    }
  }

  /**
   * GET: /api/search/books
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findBooks(req, res) {
    // Safely extract query parameters, rejecting arrays to prevent type confusion
    const provider = getQueryParamAsString(req.query.provider, 'google')
    const title = getQueryParamAsString(req.query.title, '')
    const author = getQueryParamAsString(req.query.author, '')

    // Validate string parameters
    const validation = SearchController.validateStringParams({ provider, title, author }, 'findBooks')
    if (!validation.valid) return res.status(validation.error.status).send(validation.error.message)

    // Fetch and validate library item
    const itemValidation = await SearchController.fetchAndValidateLibraryItem(req.query.id, 'findBooks')
    if (!itemValidation.valid) return res.status(itemValidation.error.status).send(itemValidation.error.message)

    const results = await BookFinder.search(itemValidation.libraryItem, provider, title, author)
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
    const podcast = query.podcast === '1' || query.podcast === 1
    const title = getQueryParamAsString(query.title, '')
    const author = getQueryParamAsString(query.author, '')
    const provider = getQueryParamAsString(query.provider, 'google')

    // Validate required title
    const titleValidation = SearchController.validateRequiredString(title, 'title', 'findCovers')
    if (!titleValidation.valid) return res.status(titleValidation.error.status).send(titleValidation.error.message)

    // Validate other string parameters
    const validation = SearchController.validateStringParams({ author, provider }, 'findCovers')
    if (!validation.valid) return res.status(validation.error.status).send(validation.error.message)

    let results = null
    if (podcast) results = await PodcastFinder.findCovers(title)
    else results = await BookFinder.findCovers(provider, title, author)
    res.json({ results })
  }

  /**
   * GET: /api/search/podcasts
   * Find podcast RSS feeds given a term
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findPodcasts(req, res) {
    const term = getQueryParamAsString(req.query.term)
    const country = getQueryParamAsString(req.query.country, 'us')

    // Validate required term
    const termValidation = SearchController.validateRequiredString(term, 'term', 'findPodcasts')
    if (!termValidation.valid) return res.status(termValidation.error.status).send(termValidation.error.message)

    // Validate country parameter
    const validation = SearchController.validateStringParams({ country }, 'findPodcasts')
    if (!validation.valid) return res.status(validation.error.status).send(validation.error.message)

    const results = await PodcastFinder.search(term, { country })
    res.json(results)
  }

  /**
   * GET: /api/search/authors
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findAuthor(req, res) {
    const query = getQueryParamAsString(req.query.q)

    // Validate query parameter
    const validation = SearchController.validateRequiredString(query, 'query', 'findAuthor')
    if (!validation.valid) return res.status(validation.error.status).send(validation.error.message)

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
    const asin = getQueryParamAsString(req.query.asin)
    const region = getQueryParamAsString(req.query.region, 'us').toLowerCase()

    // Validate ASIN parameter
    const asinValidation = SearchController.validateRequiredString(asin, 'asin', 'findChapters')
    if (!asinValidation.valid) return res.json({ error: 'Invalid ASIN', stringKey: 'MessageInvalidAsin' })

    if (!isValidASIN(asin.toUpperCase())) return res.json({ error: 'Invalid ASIN', stringKey: 'MessageInvalidAsin' })

    // Validate region parameter
    const validation = SearchController.validateStringParams({ region }, 'findChapters')
    if (!validation.valid) res.json({ error: 'Invalid region', stringKey: 'MessageInvalidRegion' })

    const chapterData = await BookFinder.findChapters(asin, region)
    if (!chapterData) {
      return res.json({ error: 'Chapters not found', stringKey: 'MessageChaptersNotFound' })
    }
    res.json(chapterData)
  }

  /**
   * GET: /api/search/providers/podcasts/covers
   * Get available podcast cover metadata providers
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getPodcastCoverProviders(req, res) {
    // Podcast covers only use iTunes
    const customProviders = await Database.customMetadataProviderModel.findAll({
      where: {
        mediaType: 'podcast'
      }
    })

    const providers = [SearchController.formatProvider('itunes'), ...SearchController.mapCustomProviders(customProviders)]

    res.json({ providers })
  }

  /**
   * GET: /api/search/providers/books/covers
   * Get available book cover metadata providers
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getBookCoverProviders(req, res) {
    // Book covers use all book providers
    const customProviders = await Database.customMetadataProviderModel.findAll({
      where: {
        mediaType: 'book'
      }
    })

    const providers = [SearchController.formatProvider('best'), ...BookFinder.providers.map((p) => SearchController.formatProvider(p)), ...SearchController.mapCustomProviders(customProviders), SearchController.formatProvider('all')]

    res.json({ providers })
  }

  /**
   * GET: /api/search/providers/books
   * Get available book metadata providers
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getBookProviders(req, res) {
    const customProviders = await Database.customMetadataProviderModel.findAll({
      where: {
        mediaType: 'book'
      }
    })

    // Filter out cover-only providers
    const bookProviders = BookFinder.providers.filter((p) => p !== 'audiobookcovers')

    const providers = [...bookProviders.map((p) => SearchController.formatProvider(p)), ...SearchController.mapCustomProviders(customProviders)]

    res.json({ providers })
  }

  /**
   * GET: /api/search/providers/podcasts
   * Get available podcast metadata providers
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getPodcastProviders(req, res) {
    const customProviders = await Database.customMetadataProviderModel.findAll({
      where: {
        mediaType: 'podcast'
      }
    })

    const providers = [SearchController.formatProvider('itunes'), ...SearchController.mapCustomProviders(customProviders)]

    res.json({ providers })
  }

  /**
   * GET: /api/search/providers/authors
   * Get available author metadata providers
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getAuthorProviders(req, res) {
    const providers = [SearchController.formatProvider('audnexus')]
    res.json({ providers })
  }

  /**
   * GET: /api/search/providers/chapters
   * Get available chapter metadata providers
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getChapterProviders(req, res) {
    const providers = [SearchController.formatProvider('audnexus')]
    res.json({ providers })
  }
}
module.exports = new SearchController()
