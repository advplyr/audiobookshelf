import { setMaxListeners } from 'events'
import Logger from '../Logger'
import BookFinder from '../finders/BookFinder'
import PodcastFinder from '../finders/PodcastFinder'

/**
 * Manager for handling streaming cover search across multiple providers
 */
type SearchParams = { title: string; author?: string; provider: string; podcast: boolean }
type ResultCallback = (result: { provider: string; covers: string[]; total: number }) => void
// Top-level failures use one argument; provider failures use two, as before.
type ErrorCallback = (providerOrMessage: string, message?: string) => void
type CoverResult = string | { covers?: string[]; cover?: string }

class CoverSearchManager {
  declare activeSearches: Map<string, AbortController>
  declare providerTimeout: number
  declare maxListeners: number
  constructor() {
    /** @type {Map<string, AbortController>} Map of requestId to AbortController */
    this.activeSearches = new Map()

    // Default timeout for each provider search
    this.providerTimeout = 10000 // 10 seconds

    // Set to 0 to disable the max listeners limit
    // We need one listener per provider (15+) and may have multiple concurrent searches
    this.maxListeners = 0
  }

  /**
   * Start a streaming cover search
   * @param {string} requestId - Unique identifier for this search request
   * @param {Object} searchParams - Search parameters
   * @param {string} searchParams.title - Title to search for
   * @param {string} searchParams.author - Author to search for (optional)
   * @param {string} searchParams.provider - Provider to search (or 'all')
   * @param {boolean} searchParams.podcast - Whether this is a podcast search
   * @param {Function} onResult - Callback for each result chunk
   * @param {Function} onComplete - Callback when search completes
   * @param {Function} onError - Callback for errors
   */
  async startSearch(requestId: string, searchParams: SearchParams, onResult: ResultCallback, onComplete: () => void, onError: ErrorCallback) {
    if (this.activeSearches.has(requestId)) {
      Logger.warn(`[CoverSearchManager] Search with requestId ${requestId} already exists`)
      return
    }

    const abortController = new AbortController()

    // Increase max listeners on this signal to accommodate parallel provider searches
    // AbortSignal is an EventTarget, so we use the events module's setMaxListeners
    setMaxListeners(this.maxListeners, abortController.signal)

    this.activeSearches.set(requestId, abortController)

    Logger.info(`[CoverSearchManager] Starting search ${requestId} with params:`, searchParams)

    try {
      const { title, author, provider, podcast } = searchParams

      if (podcast) {
        await this.searchPodcastCovers(requestId, title, abortController.signal, onResult, onError)
      } else {
        await this.searchBookCovers(requestId, provider, title, author, abortController.signal, onResult, onError)
      }

      if (!abortController.signal.aborted) {
        onComplete()
      }
    } catch (caught) {
      const error = caught as Error
      if (error.name === 'AbortError') {
        Logger.info(`[CoverSearchManager] Search ${requestId} was cancelled`)
      } else {
        Logger.error(`[CoverSearchManager] Search ${requestId} failed:`, error)
        onError(error.message)
      }
    } finally {
      this.activeSearches.delete(requestId)
    }
  }

  /**
   * Cancel an active search
   * @param {string} requestId - Request ID to cancel
   */
  cancelSearch(requestId: string) {
    const abortController = this.activeSearches.get(requestId)
    if (abortController) {
      Logger.info(`[CoverSearchManager] Cancelling search ${requestId}`)
      abortController.abort()
      this.activeSearches.delete(requestId)
      return true
    }
    return false
  }

  /**
   * Search for podcast covers
   */
  async searchPodcastCovers(requestId: string, title: string, signal: AbortSignal, onResult: ResultCallback, onError: ErrorCallback) {
    try {
      const results = await this.executeWithTimeout(() => PodcastFinder.findCovers(title), this.providerTimeout, signal)

      if (signal.aborted) return

      const covers = this.extractCoversFromResults(results)
      if (covers.length > 0) {
        onResult({
          provider: 'itunes',
          covers,
          total: covers.length
        })
      }
    } catch (caught) {
      const error = caught as Error
      if (error.name !== 'AbortError') {
        Logger.error(`[CoverSearchManager] Podcast search failed:`, error)
        onError('itunes', error.message)
      }
    }
  }

  /**
   * Search for book covers across providers
   */
  async searchBookCovers(requestId: string, provider: string, title: string, author: string | undefined, signal: AbortSignal, onResult: ResultCallback, onError: ErrorCallback) {
    let providers = []

    if (provider === 'all') {
      providers = [...BookFinder.providers]
    } else if (provider === 'best') {
      // Best providers: google, fantlab, and audible.com
      providers = ['google', 'fantlab', 'audible']
    } else {
      providers = [provider]
    }

    Logger.debug(`[CoverSearchManager] Searching ${providers.length} providers in parallel`)

    // Search all providers in parallel
    const searchPromises = providers.map(async (providerName) => {
      if (signal.aborted) return

      try {
        const searchResults = await this.executeWithTimeout(() => BookFinder.search(null, providerName, title, author || ''), this.providerTimeout, signal)

        if (signal.aborted) return

        const covers = this.extractCoversFromResults(searchResults)

        Logger.debug(`[CoverSearchManager] Found ${covers.length} covers from ${providerName}`)

        if (covers.length > 0) {
          onResult({
            provider: providerName,
            covers,
            total: covers.length
          })
        }
      } catch (caught) {
        const error = caught as Error
        if (error.name !== 'AbortError') {
          Logger.warn(`[CoverSearchManager] Provider ${providerName} failed:`, error.message)
          onError(providerName, error.message)
        }
      }
    })

    await Promise.allSettled(searchPromises)
  }

  /**
   * Execute a promise with timeout and abort signal
   */
  async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let abortHandler: (() => void) | null = null
      let timeoutId: ReturnType<typeof setTimeout> | null = null

      // Cleanup function to ensure we always remove listeners
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        if (abortHandler) {
          signal.removeEventListener('abort', abortHandler)
          abortHandler = null
        }
      }

      // Set up timeout
      timeoutId = setTimeout(() => {
        cleanup()
        const error = new Error('Provider timeout')
        error.name = 'TimeoutError'
        reject(error)
      }, timeout)

      // Check if already aborted
      if (signal.aborted) {
        cleanup()
        const error = new Error('Search cancelled')
        error.name = 'AbortError'
        reject(error)
        return
      }

      // Set up abort handler
      abortHandler = () => {
        cleanup()
        const error = new Error('Search cancelled')
        error.name = 'AbortError'
        reject(error)
      }
      signal.addEventListener('abort', abortHandler)

      void (async () => {
        try {
          const result = await fn()
          cleanup()
          resolve(result)
        } catch (caught) {
          const error = caught as Error
          cleanup()
          reject(error)
        }
      })()
    })
  }

  /**
   * Extract cover URLs from search results
   */
  extractCoversFromResults(results: unknown) {
    const covers: string[] = []
    if (!Array.isArray(results)) return covers

    results.forEach((result: CoverResult) => {
      if (typeof result === 'string') {
        covers.push(result)
      }
      if ((result as Exclude<CoverResult, string>).covers && Array.isArray((result as Exclude<CoverResult, string>).covers)) {
        covers.push(...(result as Exclude<CoverResult, string>).covers!)
      }
      if ((result as Exclude<CoverResult, string>).cover) {
        covers.push((result as Exclude<CoverResult, string>).cover!)
      }
    })

    // Remove duplicates
    return [...new Set(covers)]
  }

  /**
   * Cancel all active searches (cleanup on server shutdown)
   */
  cancelAllSearches() {
    Logger.info(`[CoverSearchManager] Cancelling ${this.activeSearches.size} active searches`)
    for (const abortController of this.activeSearches.values()) {
      abortController.abort()
    }
    this.activeSearches.clear()
  }
}

const coverSearchManager = new CoverSearchManager()
export = coverSearchManager
