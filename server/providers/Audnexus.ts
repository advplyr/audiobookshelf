import axios from 'axios'
import Throttle from 'p-throttle'
import Logger from '../Logger'
import { levenshteinDistance } from '../utils/index'
import { isValidASIN } from '../utils/index'

type AuthorData = { asin: string; name: string; description?: string; image?: string | null }
type AuthorAsin = { asin: string; name: string; levenshteinDistance?: number }
// Chapters are passed through unchanged; consumers interpret their fields.
type ChaptersData = Record<string, unknown>

class Audnexus {
  static _instance: Audnexus | null = null
  declare baseUrl: string
  declare limiter: ReturnType<typeof Throttle>

  constructor() {
    // ensures Audnexus class is singleton
    if (Audnexus._instance) {
      return Audnexus._instance
    }

    this.baseUrl = 'https://api.audnex.us'

    // Rate limit is 100 requests per minute.
    // @see https://github.com/laxamentumtech/audnexus#-deployment-
    this.limiter = Throttle({
      // Setting the limit to 1 allows for a short pause between requests that is imperceptible to the end user.
      // A larger limit will grab blocks faster and then wait for the alloted time(interval) before
      // fetching another batch, but with a discernable pause from the user perspective.
      limit: 1,
      strict: true,
      interval: 150
    })

    Audnexus._instance = this
  }

  /**
   *
   * @param {string} name
   * @param {string} region
   * @returns {Promise<{asin:string, name:string}[]>}
   */
  authorASINsRequest(name: string, region?: string | null) {
    const searchParams = new URLSearchParams()
    searchParams.set('name', name)

    if (region) searchParams.set('region', region)

    const authorRequestUrl = `${this.baseUrl}/authors?${searchParams.toString()}`
    Logger.info(`[Audnexus] Searching for author "${authorRequestUrl}"`)

    return this._processRequest(this.limiter(() => axios.get<AuthorAsin[]>(authorRequestUrl)))
      .then((res) => res.data || [])
      .catch((error: Error) => {
        Logger.error(`[Audnexus] Author ASIN request failed for ${name}`, error.message)
        return []
      })
  }

  /**
   *
   * @param {string} asin
   * @param {string} region
   * @returns {Promise<AuthorSearchObj>}
   */
  authorRequest(asin: string, region?: string | null) {
    if (!isValidASIN(asin?.toUpperCase?.())) {
      Logger.error(`[Audnexus] Invalid ASIN ${asin}`)
      return null
    }

    asin = encodeURIComponent(asin.toUpperCase())

    const authorRequestUrl = new URL(`${this.baseUrl}/authors/${asin}`)
    if (region) authorRequestUrl.searchParams.set('region', region)

    Logger.info(`[Audnexus] Searching for author "${authorRequestUrl}"`)

    return this._processRequest(this.limiter(() => axios.get<AuthorData>(authorRequestUrl.toString())))
      .then((res) => res.data)
      .catch((error: Error) => {
        Logger.error(`[Audnexus] Author request failed for ${asin}`, error.message)
        return null
      })
  }

  /**
   *
   * @param {string} asin
   * @param {string} region
   * @returns {Promise<AuthorSearchObj>}
   */
  async findAuthorByASIN(asin: string, region?: string | null) {
    const author = await this.authorRequest(asin, region)

    return author
      ? {
          asin: author.asin,
          description: author.description,
          image: author.image || null,
          name: author.name
        }
      : null
  }

  /**
   *
   * @param {string} name
   * @param {string} region
   * @param {number} maxLevenshtein
   * @returns {Promise<AuthorSearchObj>}
   */
  async findAuthorByName(name: string, region?: string | null, maxLevenshtein = 3) {
    Logger.debug(`[Audnexus] Looking up author by name ${name}`)
    const authorAsinObjs = await this.authorASINsRequest(name, region)

    let closestMatch: AuthorAsin | null = null
    authorAsinObjs.forEach((authorAsinObj) => {
      authorAsinObj.levenshteinDistance = levenshteinDistance(authorAsinObj.name, name)
      if (!closestMatch || closestMatch.levenshteinDistance! > authorAsinObj.levenshteinDistance) {
        closestMatch = authorAsinObj
      }
    })

    // TypeScript does not track assignment inside forEach; the callback above sets this value.
    const match = closestMatch as AuthorAsin | null
    if (!match || match.levenshteinDistance! > maxLevenshtein) {
      return null
    }

    const author = await this.authorRequest(match.asin, region)
    if (!author) {
      return null
    }

    return {
      asin: author.asin,
      description: author.description,
      image: author.image || null,
      name: author.name
    }
  }

  /**
   *
   * @param {string} asin
   * @param {string} region
   * @returns {Promise<Object>}
   */
  getChaptersByASIN(asin: string, region?: string | null) {
    Logger.debug(`[Audnexus] Get chapters for ASIN ${asin}/${region}`)

    asin = encodeURIComponent(asin.toUpperCase())
    const chaptersRequestUrl = new URL(`${this.baseUrl}/books/${asin}/chapters`)
    if (region) chaptersRequestUrl.searchParams.set('region', region)

    return this._processRequest(this.limiter(() => axios.get<ChaptersData>(chaptersRequestUrl.toString())))
      .then((res) => res.data)
      .catch((error: Error) => {
        Logger.error(`[Audnexus] Chapter ASIN request failed for ${asin}/${region}`, error.message)
        return null
      })
  }

  /**
   * Internal method to process requests and retry if rate limit is exceeded.
   */
  async _processRequest<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request()
    } catch (caught) {
      // Preserve property access and coercion for the original axios rejection object.
      const error = caught as { response?: { status?: number; headers?: Record<string, string> } }
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers?.['retry-after'] as string, 10) || 5

        Logger.warn(`[Audnexus] Rate limit exceeded. Retrying in ${retryAfter} seconds.`)
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))

        return this._processRequest(request)
      }

      throw caught
    }
  }
}

declare namespace Audnexus {
  type AuthorSearchObj = ReturnType<Audnexus['findAuthorByASIN']> extends Promise<infer T> ? T : never
}
export = Audnexus
