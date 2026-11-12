import type { Request, Response } from 'express'
import type User from '../models/User'
import type CustomMetadataProvider from '../models/CustomMetadataProvider'
import Logger from '../Logger'
import BookFinder from '../finders/BookFinder'
import PodcastFinder from '../finders/PodcastFinder'
import AuthorFinder from '../finders/AuthorFinder'
import Database from '../Database'
import { isValidASIN, getQueryParamAsString, ValidationError, NotFoundError } from '../utils'

// Provider name mappings for display purposes
const providerMap: Record<string, string> = {
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

type SearchRequest = Request<Record<string, string>, unknown, unknown, Record<string, unknown>> & { user: User }

class SearchController {
  constructor() {}

  /**
   * Fetches a library item by ID
   * @param {string} id - Library item ID
   * @param {string} methodName - Name of the calling method for logging
   * @returns {Promise<import('../models/LibraryItem').LibraryItemExpanded>}
   */
  static async fetchLibraryItem(id: string) {
    const libraryItem = await Database.libraryItemModel.getExpandedById(id)
    if (!libraryItem) {
      throw new NotFoundError(`library item "${id}" not found`)
    }
    return libraryItem
  }

  /**
   * Maps custom metadata providers to standardized format
   * @param {Array} providers - Array of custom provider objects
   * @returns {Array<{value: string, text: string}>}
   */
  static mapCustomProviders(providers: CustomMetadataProvider[]) {
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
  static formatProvider(providerValue: string) {
    return {
      value: providerValue,
      text: providerMap[providerValue] || providerValue
    }
  }

  /**
   * GET: /api/search/books
   */
  async findBooks(req: SearchRequest, res: Response) {
    try {
      const query = req.query
      const provider = getQueryParamAsString(query, 'provider', 'google')
      const title = getQueryParamAsString(query, 'title', '')
      const author = getQueryParamAsString(query, 'author', '')
      const id = getQueryParamAsString(query, 'id', undefined)

      // Fetch library item
      const libraryItem = id ? await SearchController.fetchLibraryItem(id) : null

      const results = await BookFinder.search(libraryItem, provider, title, author)
      res.json(results)
    } catch (error) {
      Logger.error(`[SearchController] findBooks: ${(error as Error).message}`)
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        return res.status(error.status).json({ error: error.message })
      }
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * GET: /api/search/covers
   */
  async findCovers(req: SearchRequest, res: Response) {
    try {
      const query = req.query
      const podcast = query.podcast === '1' || query.podcast === 1
      const title = getQueryParamAsString(query, 'title', '', true)
      const author = getQueryParamAsString(query, 'author', '')
      const provider = getQueryParamAsString(query, 'provider', 'google')

      let results = null
      if (podcast) results = await PodcastFinder.findCovers(title)
      else results = await BookFinder.findCovers(provider, title, author)
      res.json({ results })
    } catch (error) {
      Logger.error(`[SearchController] findCovers: ${(error as Error).message}`)
      if (error instanceof ValidationError) {
        return res.status(error.status).json({ error: error.message })
      }
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * GET: /api/search/podcasts
   * Find podcast RSS feeds given a term
   */
  async findPodcasts(req: SearchRequest, res: Response) {
    try {
      const query = req.query
      const term = getQueryParamAsString(query, 'term', '', true)
      const country = getQueryParamAsString(query, 'country', 'us')

      const results = await PodcastFinder.search(term, { country })
      res.json(results)
    } catch (error) {
      Logger.error(`[SearchController] findPodcasts: ${(error as Error).message}`)
      if (error instanceof ValidationError) {
        return res.status(error.status).json({ error: error.message })
      }
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * GET: /api/search/authors
   * Note: This endpoint is not currently used in the web client.
   */
  async findAuthor(req: SearchRequest, res: Response) {
    try {
      const query = getQueryParamAsString(req.query, 'q', '', true)

      const author = await AuthorFinder.findAuthorByName(query)
      res.json(author)
    } catch (error) {
      Logger.error(`[SearchController] findAuthor: ${(error as Error).message}`)
      if (error instanceof ValidationError) {
        return res.status(error.status).json({ error: error.message })
      }
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * GET: /api/search/chapters
   */
  async findChapters(req: SearchRequest, res: Response) {
    try {
      const query = req.query
      const asin = getQueryParamAsString(query, 'asin', '', true)
      const region = getQueryParamAsString(query, 'region', 'us').toLowerCase()

      if (!isValidASIN(asin.toUpperCase())) throw new ValidationError('asin', 'is invalid')

      const chapterData = await BookFinder.findChapters(asin, region)
      if (!chapterData) {
        return res.json({ error: 'Chapters not found', stringKey: 'MessageChaptersNotFound' })
      }
      res.json(chapterData)
    } catch (error) {
      Logger.error(`[SearchController] findChapters: ${(error as Error).message}`)
      if (error instanceof ValidationError) {
        if (error.paramName === 'asin') {
          return res.json({ error: 'Invalid ASIN', stringKey: 'MessageInvalidAsin' })
        }
        if (error.paramName === 'region') {
          return res.json({ error: 'Invalid region', stringKey: 'MessageInvalidRegion' })
        }
      }
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * GET: /api/search/providers
   * Get all available metadata providers
   */
  async getAllProviders(_req: SearchRequest, res: Response) {
    const customProviders = await Database.customMetadataProviderModel.findAll()

    const customBookProviders = customProviders.filter((p) => p.mediaType === 'book')
    const customPodcastProviders = customProviders.filter((p) => p.mediaType === 'podcast')

    const bookProviders = BookFinder.providers.filter((p) => p !== 'audiobookcovers')

    // Build minimized payload with custom providers merged in
    const providers = {
      books: [...bookProviders.map((p) => SearchController.formatProvider(p)), ...SearchController.mapCustomProviders(customBookProviders)],
      booksCovers: [SearchController.formatProvider('best'), ...BookFinder.providers.map((p) => SearchController.formatProvider(p)), ...SearchController.mapCustomProviders(customBookProviders), SearchController.formatProvider('all')],
      podcasts: [SearchController.formatProvider('itunes'), ...SearchController.mapCustomProviders(customPodcastProviders)]
    }

    res.json({ providers })
  }
}
export = new SearchController()
