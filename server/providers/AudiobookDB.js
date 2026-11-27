const axios = require('axios').default
const { marked } = require('marked')
const htmlSanitizer = require('../utils/htmlSanitizer')
const packageJson = require('../../package.json')
const Logger = require('../Logger')
const { isValidASIN, timestampToSeconds, levenshteinSimilarity } = require('../utils/index')

const errors = {
  audiobookdb_search_only: [400, 'AudiobookDB is available for book metadata search only.'],
  audiobookdb_key_required: [503, 'Set AUDIOBOOKDB_API_KEY on the server using a key from your AudiobookDB account.'],
  audiobookdb_auth: [502, 'AudiobookDB refused access. Check AUDIOBOOKDB_API_KEY and your AudiobookDB account status.'],
  audiobookdb_timeout: [504, 'The AudiobookDB search took too long. Please try again.'],
  audiobookdb_rate_limited: [429, 'AudiobookDB request or account quota limit reached.'],
  audiobookdb_unavailable: [503, 'AudiobookDB is unavailable. Please try again later.']
}

class AudiobookDBError extends Error {
  constructor(code) {
    const [status, message] = errors[code]
    super(message)
    this.name = 'AudiobookDBError'
    this.code = code
    this.status = status
  }

  /** Classify an unexpected upstream HTTP or transport failure. */
  static fromResponse(response, code) {
    if (response?.status === 401 || response?.status === 403) return new AudiobookDBError('audiobookdb_auth')
    if (response?.status === 429) {
      const error = new AudiobookDBError('audiobookdb_rate_limited')
      const header = response.headers?.['retry-after']
      if (typeof header === 'string' && header.trim()) {
        const value = header.trim()
        if (/^\d+(\.\d+)?$/.test(value)) error.retryAfter = Math.ceil(Number(value))
        else if (!/^[+-]?[\d.]+$/.test(value)) {
          const date = Date.parse(value)
          if (Number.isFinite(date)) error.retryAfter = Math.max(0, Math.ceil((date - Date.now()) / 1000))
        }
      }
      return error
    }
    if (!response) return new AudiobookDBError(code === 'ECONNABORTED' || code === 'ETIMEDOUT' ? 'audiobookdb_timeout' : 'audiobookdb_unavailable')
    return new AudiobookDBError('audiobookdb_unavailable')
  }

  /**
   * Serialize to the provider HTTP contract: `{ error, code, retryAfter }`
   * plus a `Retry-After` header when present.
   *
   * @param {object} res - Express response
   * @returns {object}
   */
  sendResponse(res) {
    if (this.retryAfter !== undefined) res.set('Retry-After', String(this.retryAfter))
    return res.status(this.status).json({ error: this.message, code: this.code, ...(this.retryAfter !== undefined ? { retryAfter: this.retryAfter } : {}) })
  }
}

const API_ORIGIN = 'https://api.audiobookdb.org'
const WEBSITE_ORIGIN = 'https://audiobookdb.org'

/**
 * Unlike p-throttle, this queue can skip expired work without spending a slot.
 * Requests run one at a time, with at least `interval` ms between starts.
 */
function createSpacedQueue(interval) {
  let slot = Promise.resolve()
  let lastStart = 0
  return (fn, deadline) => {
    const run = slot.then(async () => {
      const now = Date.now()
      const wait = Math.max(0, lastStart + interval - now)
      if (now + wait >= deadline) throw new AudiobookDBError('audiobookdb_timeout')
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
      const start = Date.now()
      if (start >= deadline) throw new AudiobookDBError('audiobookdb_timeout')
      lastStart = start
      return fn()
    })
    slot = run.then(() => {}, () => {})
    return run
  }
}

/**
 * Native AudiobookDB book/release search provider (https://api.audiobookdb.org/api,
 * key from AUDIOBOOKDB_API_KEY). One candidate per release (recording):
 * book-scoped fields come from the book, release-scoped fields from the
 * release refs in the book detail response. A supplied ASIN resolves only
 * its matchedReleaseId; a miss returns no candidates. An ASIN-shaped title
 * (no ASIN supplied) is probed opportunistically, then falls through to the
 * title search.
 */
class AudiobookDB {
  #responseTimeout = 10000

  // Cap hydrated book detail requests per search to conserve quota.
  #maxBooksPerSearch = 5

  // Relations hydrated per search hit: release refs carry each recording's
  // Audible ASIN and other release-scoped identifiers.
  #hydrationInclude = 'releasesExternal,people,series,genres,tags,externalItems,images'

  constructor() {
    this.baseUrl = `${API_ORIGIN}/api`
    this.limiter = createSpacedQueue(300)
  }

  get userAgentString() {
    return `audiobookshelf/${packageJson.version} (https://audiobookshelf.org)`
  }

  get apiKey() {
    return process.env.AUDIOBOOKDB_API_KEY?.trim() || ''
  }

  /**
   * Rate-limited request to the AudiobookDB API. The deadline bounds the
   * whole call, including queue wait: the deadline timer rejects with the
   * typed timeout and aborts in-flight axios work; a queue entry that
   * reaches the front past the deadline skips without a slot, so its timer
   * settles it. Axios never follows redirects. Book hydration can inspect one
   * merged-book response and make a separate request through this queue.
   */
  async _request(path, method, body, deadline, { expectedMiss404 = false, allowBookRedirect = false } = {}) {
    const apiKey = this.apiKey
    if (!apiKey) throw new AudiobookDBError('audiobookdb_key_required')
    const config = {
      method,
      url: `${this.baseUrl}${path}`,
      maxRedirects: 0,
      headers: { 'User-Agent': this.userAgentString, 'X-API-Key': apiKey }
    }
    if (method === 'POST') {
      config.data = body
      config.headers['Content-Type'] = 'application/json'
    }
    const controller = new AbortController()
    const request = this.limiter(() => {
      return axios({ ...config, timeout: Math.max(1, deadline - Date.now()), signal: controller.signal })
        .catch((error) => {
          if (controller.signal.reason === 'deadline-expired') throw new AudiobookDBError('audiobookdb_timeout')
          if (error?.response?.status === 301 && allowBookRedirect) return error.response
          if (error?.response?.status === 404 && expectedMiss404) {
            Logger.debug(`[AudiobookDB] ${method} ${path} not found (expected identifier miss)`)
            return null
          }
          const providerError = AudiobookDBError.fromResponse(error.response, error.code)
          Logger.error(`[AudiobookDB] request failed: ${providerError.code}`)
          throw providerError
        })
    }, deadline)
    let timer
    const deadlineTimer = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort('deadline-expired')
        reject(new AudiobookDBError('audiobookdb_timeout'))
      }, Math.max(0, deadline - Date.now()))
    })
    try {
      return await Promise.race([request, deadlineTimer])
    } finally {
      clearTimeout(timer)
      controller.abort('request-settled')
    }
  }

  async #getBook(id, deadline) {
    const include = `?include=${this.#hydrationInclude}`
    const path = `/books/${encodeURIComponent(id)}${include}`
    const response = await this._request(path, 'GET', null, deadline, { expectedMiss404: true, allowBookRedirect: true })
    if (response?.status !== 301) return response?.data

    // The catalog can use its website origin in Location. Extract only the
    // winner ID and keep the original API host, query, queue and deadline.
    const location = response.headers.location
    let winner
    if (location) {
      try {
        const source = new URL(`${this.baseUrl}${path}`)
        const target = new URL(location, source)
        if (target.origin === source.origin || (source.origin === API_ORIGIN && target.origin === WEBSITE_ORIGIN)) {
          winner = /^\/api\/books\/([a-zA-Z0-9]{12})$/.exec(target.pathname)?.[1]
        }
      } catch {
        // Malformed Location is an upstream failure, not a catalog miss.
      }
    }
    if (!winner) throw new AudiobookDBError('audiobookdb_unavailable')
    const merged = await this._request(`/books/${winner}${include}`, 'GET', null, deadline, { expectedMiss404: true })
    return merged?.data
  }

  /** Image URLs are storage keys that 404 bare; append a derivative name. */
  buildCoverUrl(url) {
    if (!url || typeof url !== 'string') return undefined
    if (/\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url)) return url
    return `${url}/detail.jpg`
  }

  /** Prefer the full-resolution `sourceUrl` over any CDN derivative. */
  #imageCover(image) {
    if (!image || typeof image !== 'object') return undefined
    const sourceUrl = image.sourceUrl
    if (typeof sourceUrl === 'string' && /^https?:\/\//i.test(sourceUrl)) return sourceUrl
    return this.buildCoverUrl(image.url)
  }

  /** Comma-join names of people with a given role. */
  #peopleNames(people, role) {
    const names = (Array.isArray(people) ? people : [])
      .filter((p) => p?.role?.name === role && p?.person?.name)
      .map((p) => p.person.name)
    return names.length ? names.join(', ') : undefined
  }

  /** Map series to native series name + sequence only; an absent relation is unknown, never an empty set. */
  #mapSeries(series) {
    if (!Array.isArray(series)) return undefined
    const mapped = []
    for (const membership of series) {
      const ref = membership?.series
      if (typeof ref?.title !== 'string' || !ref.title.trim()) continue
      const item = { series: ref.title }
      const rawSequence = membership.ordinal ?? membership.position?.sortKey ?? membership.position?.label
      const sequence = typeof rawSequence === 'string' ? rawSequence.trim() : rawSequence
      if (typeof sequence === 'number' || (typeof sequence === 'string' && sequence)) item.sequence = String(sequence)
      mapped.push(item)
    }
    return mapped.length ? mapped : undefined
  }

  /** Find the itemId of an external item by category title. */
  #externalItemId(external, categoryTitle) {
    if (!Array.isArray(external)) return undefined
    return external.find((e) => e?.itemId && e?.category?.title?.toLowerCase() === categoryTitle.toLowerCase())?.itemId
  }

  /** Book-scoped candidate fields; description is markdown, rendered with marked then sanitized as BookFinder does. */
  #bookBase(book) {
    const description = book.description ? htmlSanitizer.sanitize(marked.parse(book.description)) : undefined
    return {
      id: book.id,
      title: book.title,
      subtitle: book.subtitle,
      description,
      descriptionPlain: description ? htmlSanitizer.stripAllTags(description) : undefined,
      author: this.#peopleNames(book.people, 'Author'),
      // isAdult is a nullable boolean: null or absent means unknown, so only a real boolean maps to the ABS flag.
      explicit: typeof book.isAdult === 'boolean' ? book.isAdult : undefined,
      genres: Array.isArray(book.genres) ? book.genres.map((g) => g?.title).filter(Boolean) : undefined,
      tags: Array.isArray(book.tags) ? book.tags.map((t) => t?.title).filter(Boolean) : undefined,
      series: this.#mapSeries(book.series)
    }
  }

  /** Return the UTC calendar date of the release, if valid. */
  #publishedDate(releaseDate) {
    if (!releaseDate) return undefined
    const date = new Date(releaseDate)
    return date.getUTCFullYear() > 0 ? date.toISOString().slice(0, 10) : undefined
  }

  /** Convert a duration string (HH:MM:SS / MM:SS) to whole minutes. */
  parseDurationToMinutes(duration) {
    if (typeof duration !== 'string' || !duration.trim()) return undefined
    const seconds = timestampToSeconds(duration)
    if (seconds == null) return undefined
    return Math.round(seconds / 60)
  }

  /** Release-scoped candidate fields, mapped from a BookReleaseRef. */
  #mapRelease(bookBase, release) {
    const publishedDate = this.#publishedDate(release.releaseDate)
    return {
      ...bookBase,
      releaseId: release.id,
      asin: this.#externalItemId(release.external, 'Audible'),
      isbn: release.isbn,
      narrator: this.#peopleNames(release.people, 'Narrator'),
      publisher: release.publishers?.map((credit) => credit.creditedName || credit.name).join(', '),
      publishedYear: publishedDate?.slice(0, 4),
      publishedDate,
      language: release.language?.name,
      duration: this.parseDurationToMinutes(release.duration),
      // The catalog's book cover can come from a different release.
      cover: this.#imageCover(release.images?.[0])
    }
  }

  /** Build one candidate per release for a book. */
  buildCandidates(book) {
    if (!book || !book.id) return []
    const base = this.#bookBase(book)
    const releases = Array.isArray(book.releases) ? book.releases : []
    const candidates = releases.filter((r) => r?.id).map((ref) => this.#mapRelease(base, ref))
    if (!candidates.length) candidates.push({ ...base, cover: this.#imageCover(book.coverImage) || this.#imageCover(book.image) || this.#imageCover(book.images?.[0]) })
    for (const candidate of candidates) {
      for (const key of Object.keys(candidate)) {
        const value = candidate[key]
        if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) delete candidate[key]
      }
    }
    return candidates
  }

  /**
   * Resolve an ASIN to its exact recording. Returns [] when the API does not
   * name the matched release: the other releases must not be substituted.
   */
  async resolveByASIN(asin, deadline) {
    // A 404 on the exact-ASIN endpoint is a normal identifier miss (unknown ASIN).
    const data = (await this._request(`/audiobooks/external/audible/${encodeURIComponent(asin)}`, 'GET', null, deadline, { expectedMiss404: true }))?.data
    if (!data?.id || !data.matchedReleaseId) return []
    const candidate = this.buildCandidates(data).find((c) => c.releaseId === data.matchedReleaseId)
    if (!candidate) return []
    candidate.asin = asin
    return [candidate]
  }

  /**
   * Search for books and return hydrated book/release candidates in native
   * shape. A supplied ASIN is resolved exactly and nothing else; a miss
   * returns no candidates. An ASIN-shaped title is probed opportunistically,
   * then falls through to the title search (a bounded variant list: short
   * titles combine with the author to meet the API's three-character
   * minimum). Hits are ranked with author-matching books ahead, but a
   * mismatched manual author choice is kept, since the stored name may be
   * inaccurate. Hydration attempts are capped by #maxBooksPerSearch, and the
   * shared deadline rejecting with the typed timeout bounds the whole chain.
   */
  async search(title, author, asin, timeout = this.#responseTimeout) {
    title = (title || '').trim()
    author = (author || '').trim()
    const deadline = Date.now() + timeout

    const supplied = (asin || '').trim().toUpperCase()
    if (supplied) {
      // Exact-only identifier lookup: no title search is ever attempted.
      if (!isValidASIN(supplied)) {
        Logger.debug(`[AudiobookDB] search: skipping invalid explicit ASIN "${supplied}"`)
        return []
      }
      return this.resolveByASIN(supplied, deadline)
    }

    if (!title) return []

    // An ASIN-shaped title may be an identifier; a probe miss is a miss.
    if (isValidASIN(title.toUpperCase())) {
      const resolved = await this.resolveByASIN(title.toUpperCase(), deadline)
      if (resolved.length) return resolved
    }

    // The catalog requires three characters. A short title can include the author.
    const query = title.length < 3 ? `${title} ${author}`.trim() : title
    if (query.length < 3) return []
    let { data: hits } = await this._request('/search', 'POST', { q: query, type: 'books' }, deadline)
    const mainTitle = title.replace(/[:：].*$|\s+-\s+.*$|\s+\([^)]*\)\s*$/g, '').trim()
    if (Array.isArray(hits) && !hits.length && mainTitle.length >= 3 && mainTitle !== query) {
      hits = (await this._request('/search', 'POST', { q: mainTitle, type: 'books' }, deadline)).data
    }
    if (!Array.isArray(hits)) throw new AudiobookDBError('audiobookdb_unavailable')
    if (!hits.length) return []

    const authorNames = author.split(',').map((name) => name.trim()).filter(Boolean)
    const sorted = authorNames.length
      ? [...hits].sort((a, b) => Number(this.bookAuthorsContain(b, authorNames)) - Number(this.bookAuthorsContain(a, authorNames)))
      : hits

    const books = []
    let attempts = 0
    for (const hit of sorted) {
      if (!hit?.id || attempts >= this.#maxBooksPerSearch) break
      if (books.some((book) => book.id === hit.id)) continue
      attempts += 1
      const book = await this.#getBook(hit.id, deadline)
      if (!book?.id || books.some((existing) => existing.id === book.id)) continue
      books.push(book.id === hit.id ? { ...hit, ...book, series: book.series } : book)
    }
    return books.flatMap((book) => this.buildCandidates(book))
  }

  /** Normalize an author name: strip diacritics, lowercase, collapse non-alphanumerics to single spaces. */
  normalizeAuthorName(name) {
    if (!name || typeof name !== 'string') return ''
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
  }

  /**
   * True when every requested author name matches one of the book's author
   * credits under a tolerant token rule: LATIN single-letter initials are
   * ignored, and every remaining requested token must appear in the credit
   * (containment in either direction, e.g. abbreviated names, or a Levenshtein
   * similarity of at least 0.95, e.g. diacritic/stress variants). A
   * one-character token in a non-Latin script is a meaningful name, never a
   * Latin initial, so it is kept. "Smith" matches "Smith, John" and a
   * reordered "Patrick O'Brien" matches "O'Brien, Patrick"; a one-letter
   * mutation ("Kate Reeding" vs "Kate Reading") does not.
   */
  #authorTokens(name) {
    const normalized = this.normalizeAuthorName(name)
    // A single Latin letter may be an ignorable initial; a single non-Latin
    // letter (CJK, Cyrillic, Greek, ...) is a meaningful name token.
    return normalized.split(' ').filter((token) => token.length > 1 || !/^[a-z]$/.test(token))
  }

  #tokenMatch(a, b) {
    return a.includes(b) || b.includes(a) || levenshteinSimilarity(a, b) >= 0.95
  }

  bookAuthorsContain(book, authorNames) {
    const authors = (Array.isArray(book.people) ? book.people : [])
      .filter((p) => p?.role?.name === 'Author' && p?.person?.name)
      .map((p) => this.#authorTokens(p.person.name))
      .filter((tokens) => tokens.length)
    if (!authors.length) return false
    return authorNames.every((name) => {
      const requestedTokens = this.#authorTokens(name)
      if (!requestedTokens.length) return true
      return authors.some((tokens) => requestedTokens.every((requested) => tokens.some((token) => this.#tokenMatch(token, requested))))
    })
  }
}

module.exports = new AudiobookDB()
module.exports.Error = AudiobookDBError
