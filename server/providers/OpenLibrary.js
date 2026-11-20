const axios = require('axios').default

/** Maximum number of results to request from Open Library search API */
const SEARCH_LIMIT = 20
/** Number of works-detail requests to send concurrently */
const WORKS_BATCH_SIZE = 5
/** Delay (ms) between each batch of works-detail requests */
const WORKS_BATCH_DELAY_MS = 150

/**
 * Wait for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class OpenLibrary {
  #responseTimeout = 30000

  constructor() {
    this.baseUrl = 'https://openlibrary.org'
  }

  /**
   *
   * @param {string} uri
   * @param {number} timeout
   * @returns {Promise<Object>}
   */
  get(uri, timeout = this.#responseTimeout) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout
    return axios
      .get(`${this.baseUrl}/${uri}`, {
        timeout
      })
      .then((res) => {
        return res.data
      })
      .catch((error) => {
        console.error('Failed', error.message)
        return null
      })
  }

  async isbnLookup(isbn) {
    var lookupData = await this.get(`/isbn/${isbn}`)
    if (!lookupData) {
      return {
        errorCode: 404
      }
    }
    return lookupData
  }

  async getWorksData(worksKey, timeout = this.#responseTimeout) {
    var worksData = await this.get(`${worksKey}.json`, timeout)
    if (!worksData) {
      // Return empty works data as a graceful fallback (e.g. 429 / 500 from Open Library)
      return {
        id: worksKey.split('/').pop(),
        key: worksKey,
        covers: [],
        first_publish_date: null,
        description: null
      }
    }
    if (!worksData.covers) worksData.covers = []
    var coverImages = worksData.covers.filter((c) => c > 0).map((c) => `https://covers.openlibrary.org/b/id/${c}-L.jpg`)
    var description = null
    if (worksData.description) {
      if (typeof worksData.description === 'string') {
        description = worksData.description
      } else {
        description = worksData.description.value || null
      }
    }
    return {
      id: worksKey.split('/').pop(),
      key: worksKey,
      covers: coverImages,
      first_publish_date: worksData.first_publish_date,
      description: description
    }
  }

  parsePublishYear(doc, worksData) {
    if (doc.first_publish_year && !isNaN(doc.first_publish_year)) return String(doc.first_publish_year)
    if (worksData.first_publish_date) {
      var year = worksData.first_publish_date.split('-')[0]
      if (!isNaN(year)) return String(year)
    }
    return null
  }

  async cleanSearchDoc(doc, timeout = this.#responseTimeout) {
    var worksData = await this.getWorksData(doc.key, timeout)
    return {
      title: doc.title,
      author: doc.author_name ? doc.author_name.join(', ') : null,
      publishedYear: this.parsePublishYear(doc, worksData),
      edition: doc.cover_edition_key,
      cover: doc.cover_edition_key ? `https://covers.openlibrary.org/b/OLID/${doc.cover_edition_key}-L.jpg` : null,
      ...worksData
    }
  }

  /**
   * Process an array of async tasks in sequential batches with a delay between each batch.
   * This avoids firing thousands of concurrent HTTP requests and triggering 429 rate limits.
   * @template T
   * @param {Array<() => Promise<T>>} tasks - Array of zero-argument async factory functions
   * @param {number} batchSize - Number of tasks to run concurrently per batch
   * @param {number} delayMs - Milliseconds to wait between batches
   * @returns {Promise<T[]>}
   */
  async runInBatches(tasks, batchSize, delayMs) {
    const results = []
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch.map((fn) => fn()))
      results.push(...batchResults)
      if (i + batchSize < tasks.length) {
        await sleep(delayMs)
      }
    }
    return results
  }

  async search(query) {
    var queryString = Object.keys(query)
      .map((key) => key + '=' + query[key])
      .join('&')
    var lookupData = await this.get(`/search.json?${queryString}&limit=${SEARCH_LIMIT}`)
    if (!lookupData) {
      return {
        errorCode: 404
      }
    }
    var tasks = lookupData.docs.map((d) => () => this.cleanSearchDoc(d, this.#responseTimeout))
    var searchDocs = await this.runInBatches(tasks, WORKS_BATCH_SIZE, WORKS_BATCH_DELAY_MS)
    return searchDocs
  }

  /**
   * Search Open Library by title.
   * Results are capped at SEARCH_LIMIT to prevent mass parallel requests that trigger
   * 429 Too Many Requests. Works-detail lookups are processed in small batches with
   * a short delay between each batch.
   * @param {string} title
   * @param {number} timeout
   * @returns {Promise<Object[]>}
   */
  async searchTitle(title, timeout = this.#responseTimeout) {
    title = encodeURIComponent(title)
    var lookupData = await this.get(`/search.json?title=${title}&limit=${SEARCH_LIMIT}`, timeout)
    if (!lookupData) {
      return {
        errorCode: 404
      }
    }
    var tasks = lookupData.docs.map((d) => () => this.cleanSearchDoc(d, timeout))
    var searchDocs = await this.runInBatches(tasks, WORKS_BATCH_SIZE, WORKS_BATCH_DELAY_MS)
    return searchDocs
  }
}
module.exports = OpenLibrary
