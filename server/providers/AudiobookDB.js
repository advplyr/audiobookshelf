const axios = require('axios').default
const Throttle = require('p-throttle')
const packageJson = require('../../package.json')
const Logger = require('../Logger')
const AudiobookDBError = require('./AudiobookDBError')
const { isValidASIN, timestampToSeconds, levenshteinSimilarity } = require('../utils/index')

/**
 * Native AudiobookDB provider.
 *
 * One candidate per AudiobookDB release (recording). Book-scoped fields
 * (title, description, authors, genres, tags, series, cover) come from the
 * book; release-scoped fields (narrator, publisher, publishedYear, language,
 * duration, ASIN, ISBN, cover) come from the release summary ref returned by
 * book detail / external lookup; no per-release detail request is made. An
 * explicitly supplied ASIN resolves only its matchedReleaseId; a miss
 * returns no candidates. ASIN-shaped title text is only an opportunistic
 * probe, and a miss falls through to the normal title (+author) search.
 *
 * API: https://audiobookdb.org/api - an account API key is required via
 * the server-side AUDIOBOOKDB_API_KEY environment variable.
 */
class AudiobookDB {
  #responseTimeout = 10000

  // Bounded, sequential fanout: cap hydrated books per search to conserve quota.
  #maxBooksPerSearch = 5

  // Relations hydrated per search hit: release external items carry each
  // recording's Audible ASIN and other release-scoped identifiers.
  #hydrationInclude = 'releasesExternal,people,series,genres,tags,externalItems,images'

  constructor() {
    this.baseUrl = 'https://audiobookdb.org/api'
    // Keep requests sequential and conservatively spaced.
    this.limiter = Throttle({
      limit: 1,
      strict: true,
      interval: 300
    })
  }

  get userAgentString() {
    return `audiobookshelf/${packageJson.version} (https://audiobookshelf.org)`
  }

  get apiKey() {
    return process.env.AUDIOBOOKDB_API_KEY?.trim() || ''
  }

  /**
   * Make a rate-limited request to the AudiobookDB API.
   *
   * The deadline bounds the whole call, including time spent waiting in the
   * throttle queue: inside the limiter closure the remaining time is checked
   * and set as the axios timeout, so a queued closure that finally runs past
   * the deadline never issues a request.
   *
   * Shared-queue constraint (p-throttle v4): `throttledFn.abort()` rejects
   * EVERY unresolved call queued on the limiter, not the single expired one,
   * so an expired operation cannot be cancelled without also killing
   * concurrent searches. The real shared limiter is therefore kept and the
   * deadline is enforced per request instead: a dedicated AbortController is
   * aborted at the deadline, which cancels only this request's in-flight
   * axios work (settling it as a CanceledError) while the closure's
   * remaining-time guard keeps expired queue callbacks from spending quota.
   * A deadline failure (transport error caused by the abort, or the timer
   * winning the race) resolves null without logging an API error, so a
   * budget exhaustion is distinguishable from a server failure.
   *
   * @param {string} path
   * @param {string} method
   * @param {Object|null} body
   * @param {number} deadline - absolute Date.now() millisecond deadline
   * @param {boolean} [expectedMiss404] - a 404 is a normal identifier miss
   *   (debug-logged) rather than a transport/quota/server failure
   * @returns {Promise<Object|null>}
   */
  async _request(path, method = 'GET', body = null, deadline, expectedMiss404 = false) {
    const apiKey = this.apiKey
    if (!apiKey || apiKey === 'anonymous') throw new AudiobookDBError('audiobookdb_key_required')
    if (!deadline || isNaN(deadline)) deadline = Date.now() + this.#responseTimeout
    const config = {
      method,
      url: `${this.baseUrl}${path}`,
      headers: {
        'User-Agent': this.userAgentString,
        'X-API-Key': apiKey
      }
    }
    if (method === 'POST') {
      config.data = body
      config.headers['Content-Type'] = 'application/json'
    }
    const controller = new AbortController()
    let deadlineFired = false
    const request = this.limiter(() => {
      // Throttle waiting is outside axios, so the deadline must be
      // re-checked here: an expired deadline must never issue a request.
      const remaining = deadline - Date.now()
      if (remaining <= 0) return Promise.resolve(null)
      return axios({ ...config, timeout: remaining, signal: controller.signal })
        .then((res) => res.data)
        .catch((error) => {
          if (deadlineFired) return null
          // A missing exact identifier or a book removed after search is
          // a normal candidate miss, not a provider outage.
          if (expectedMiss404 && error?.response?.status === 404) {
            Logger.debug(`[AudiobookDB] ${method} ${path} not found (expected identifier miss)`)
            return null
          }
          const providerError = AudiobookDBError.fromResponse(error.response)
          Logger.error(`[AudiobookDB] request failed: ${providerError.code}`)
          throw providerError
        })
    })()
    // p-throttle may not invoke the closure until the deadline passes; the
    // timer guarantees this promise settles by the deadline either way. When
    // it fires it aborts the in-flight axios work so it cannot outlive the
    // deadline and cannot be reported as a server failure.
    let timer
    const deadlineTimer = new Promise((resolve) => {
      timer = setTimeout(() => {
        deadlineFired = true
        controller.abort('deadline-expired')
        resolve(null)
      }, Math.max(0, deadline - Date.now()))
    })
    try {
      return await Promise.race([request, deadlineTimer])
    } finally {
      clearTimeout(timer)
      if (!deadlineFired) controller.abort('request-settled')
    }
  }

  /**
   * Convert a duration string (HH:MM:SS / MM:SS) to whole minutes. The API
   * only emits HH:MM:SS; MM:SS is tolerated for robustness.
   *
   * @param {string|undefined} duration
   * @returns {number|undefined}
   */
  parseDurationToMinutes(duration) {
    if (typeof duration !== 'string' || !duration.trim()) return undefined
    const seconds = timestampToSeconds(duration)
    if (seconds == null) return undefined
    return Math.round(seconds / 60)
  }

  /**
   * AudiobookDB image URLs are storage keys that 404 bare; a derivative
   * name must be appended. `detail.jpg` (1200px) is the largest documented
   * derivative (small 192, medium 384, large 768), so it is the fallback
   * when an image carries no usable full-resolution `sourceUrl`.
   *
   * @param {string|undefined} url
   * @returns {string|undefined}
   */
  buildCoverUrl(url) {
    if (!url || typeof url !== 'string') return undefined
    if (/\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url)) return url
    return `${url}/detail.jpg`
  }

  /**
   * Audiobookshelf stores a downloaded cover verbatim, so the
   * full-resolution `sourceUrl` original is preferred over any CDN
   * derivative; a non-absolute sourceUrl is not fetchable and is ignored.
   *
   * @param {Object|undefined} image - AudiobookDB image object
   * @returns {string|undefined}
   */
  #imageCover(image) {
    if (!image || typeof image !== 'object') return undefined
    const sourceUrl = image.sourceUrl
    if (typeof sourceUrl === 'string' && /^https?:\/\//i.test(sourceUrl)) return sourceUrl
    return this.buildCoverUrl(image.url)
  }

  /**
   * Comma-join names of people with a given role.
   *
   * @param {Array|undefined} people
   * @param {string} role
   * @returns {string|undefined}
   */
  #peopleNames(people, role) {
    const names = (Array.isArray(people) ? people : [])
      .filter((p) => p?.role?.name === role && p?.person?.name)
      .map((p) => p.person.name)
    return names.length ? names.join(', ') : undefined
  }

  /**
   * Map AudiobookDB book series entries to {series, sequence} objects,
   * omitting sequence when absent.
   *
   * @param {Array|undefined} series
   * @returns {Array<{series: string, sequence?: string}>|undefined}
   */
  #mapSeries(series) {
    if (!Array.isArray(series) || !series.length) return undefined
    const mapped = series
      .filter((s) => s?.series?.title)
      .map((s) => {
        const item = { series: s.series.title }
        const sequence = s.position?.label || s.position?.value || s.ordinal
        if (sequence) item.sequence = String(sequence)
        return item
      })
    return mapped.length ? mapped : undefined
  }

  /**
   * Find the itemId of an external item by category title (case-insensitive).
   *
   * @param {Array|undefined} external - BookDTO.external / BookReleaseRefDTO.external
   * @param {string} categoryTitle
   * @returns {string|undefined}
   */
  #externalItemId(external, categoryTitle) {
    if (!Array.isArray(external)) return undefined
    return (
      external.find((e) => e?.itemId && e?.category?.title?.toLowerCase() === categoryTitle.toLowerCase())?.itemId ||
      undefined
    )
  }

  /**
   * Book-scoped candidate fields shared by every recording of a book.
   *
   * @param {Object} book - AudiobookDB book object
   * @returns {Object}
   */
  #bookBase(book) {
    return {
      id: book.id,
      title: book.title,
      subtitle: book.subtitle,
      description: book.description,
      author: this.#peopleNames(book.people, 'Author'),
      // The DTO's isAdult is a nullable boolean: null or absent means
      // unknown, so only a real boolean maps to the ABS explicit flag.
      explicit: typeof book.isAdult === 'boolean' ? book.isAdult : undefined,
      genres: Array.isArray(book.genres) ? book.genres.map((g) => g?.title).filter(Boolean) : undefined,
      tags: Array.isArray(book.tags) ? book.tags.map((t) => t?.title).filter(Boolean) : undefined,
      series: this.#mapSeries(book.series),
      cover: this.#imageCover(book.coverImage) || this.#imageCover(book.image) || this.#imageCover(book.images?.[0])
    }
  }

  /**
   * Extract a positive UTC year from a release date string; anything that
   * does not parse to a finite year is omitted (never a "NaN" year).
   *
   * @param {string|undefined} releaseDate
   * @returns {string|undefined}
   */
  #publishedYear(releaseDate) {
    if (!releaseDate) return undefined
    const year = new Date(releaseDate).getUTCFullYear()
    if (!Number.isFinite(year) || year <= 0) return undefined
    return String(year)
  }

  /**
   * Release-scoped candidate fields, mapped from a BookReleaseRef whose
   * isbn is optional and absent when blank.
   *
   * @param {Object} bookBase
   * @param {Object} release - BookReleaseRef from book detail / external lookup
   * @returns {Object}
   */
  #mapRelease(bookBase, release) {
    return {
      ...bookBase,
      releaseId: release.id,
      asin: this.#externalItemId(release.external, 'Audible'),
      isbn: release.isbn,
      narrator: this.#peopleNames(release.people, 'Narrator'),
      publisher: release.publisher?.name,
      publishedYear: this.#publishedYear(release.releaseDate),
      language: release.language?.name,
      duration: this.parseDurationToMinutes(release.duration),
      cover: this.#imageCover(release.images?.[0]) || bookBase.cover
    }
  }

  /**
   * Build one normalized candidate per release for a book, mapping each
   * release ref directly from the book detail / external lookup response.
   *
   * @param {Object} book - AudiobookDB book object (with optional releases[])
   * @returns {Object[]}
   */
  buildCandidates(book) {
    if (!book || !book.id) return []
    const base = this.#bookBase(book)
    const releases = Array.isArray(book.releases) ? book.releases : []
    const candidates = releases.filter((r) => r?.id).map((ref) => this.#mapRelease(base, ref))
    if (!candidates.length) candidates.push(base)
    return candidates.map((candidate) => {
      for (const key of Object.keys(candidate)) {
        const value = candidate[key]
        if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) delete candidate[key]
      }
      return candidate
    })
  }

  /**
   * Resolve an ASIN to its exact recording.
   *
   * Returns [] when the API does not name the matched release: the other
   * releases of the book are not the queried recording and must not be
   * substituted. When it does, the matched recording is built from its
   * release ref, which carries the ISBN; the external lookup is the only
   * request.
   *
   * @param {string} asin
   * @param {number} deadline - absolute Date.now() millisecond deadline
   * @returns {Promise<Object[]>}
   */
  async resolveByASIN(asin, deadline) {
    // A 404 on the exact-ASIN endpoint is a normal identifier miss (unknown
    // ASIN), not a transport/quota/server failure: it is logged separately
    // and must not surface as an API error.
    const data = await this._request(`/audiobooks/external/audible/${encodeURIComponent(asin)}`, 'GET', null, deadline, true)
    if (!data || !data.id) return []
    const matchedReleaseId = data.matchedReleaseId
    if (!matchedReleaseId) return []
    const candidate = this.buildCandidates(data).find((c) => c.releaseId === matchedReleaseId)
    if (!candidate) return []
    candidate.asin = asin
    return [candidate]
  }

  /**
   * Search for books.
   *
   * A separately supplied ASIN is an explicit identifier signal: it is
   * resolved exactly and nothing else. An invalid explicit ASIN is rejected
   * immediately, and a valid ASIN that does not resolve (miss, hidden
   * release, request failure) returns no candidates — falling back to a
   * title search would substitute a different recording. A title that is
   * ASIN-shaped (with no ASIN supplied) is only probed opportunistically;
   * a miss falls through to the normal title search.
   *
   * Requested authors are matched against the search hits before the
   * hydration cap is applied, because the API returns up to 10 hits and the
   * author string (comma-joined) cannot be a server filter; a second check
   * on the hydrated people is kept as a guard.
   *
   * The whole chain (throttle waiting plus one book-detail request per hit)
   * is bounded by the aggregate deadline: fulfilled candidates are kept
   * when the deadline exhausts.
   *
   * @param {string} title
   * @param {string} author
   * @param {string} asin
   * @param {number} timeout
   * @param {{coversOnly?: boolean}} options
   * @returns {Promise<Object[]>}
   */
  async search(title, author, asin, timeout = this.#responseTimeout, options = {}) {
    title = (title || '').trim()
    author = (author || '').trim()
    const deadline = Date.now() + timeout
    const coversOnly = !!options.coversOnly

    const supplied = (asin || '').trim().toUpperCase()
    if (supplied) {
      // Exact-only identifier lookup: no title search is ever attempted.
      if (!isValidASIN(supplied)) {
        Logger.debug(`[AudiobookDB] search: skipping invalid explicit ASIN "${supplied}"`)
        return []
      }
      if (Date.now() >= deadline) return []
      return this.resolveByASIN(supplied, deadline)
    }

    if (!title) return []

    // An ASIN-shaped title may be an identifier; a probe miss is a miss.
    if (isValidASIN(title.toUpperCase())) {
      if (Date.now() >= deadline) return []
      const resolved = await this.resolveByASIN(title.toUpperCase(), deadline)
      if (resolved.length) return resolved
    }

    if (title.length < 3 && !author) {
      Logger.debug('[AudiobookDB] search: title too short and no author')
      return []
    }

    // No request may start once the deadline is exhausted: the call cannot
    // complete and would only burn anonymous quota in the throttle queue.
    if (Date.now() >= deadline) return []

    // Book search indexes both title and author credits. Include the author
    // for short titles so the query satisfies the API's three-character
    // minimum without discarding valid books such as "It".
    const query = title.length < 3 ? `${title} ${author}` : title
    const hits = await this._request('/search', 'POST', { q: query, type: 'books' }, deadline)
    if (!Array.isArray(hits) || !hits.length) return []

    const authorNames = author.split(',').map((name) => name.trim()).filter(Boolean)
    // Cover-only lookups fetch images, not metadata: a hit whose stored
    // author is wrong (or missing) is exactly what we want to image, so
    // author filtering is disabled in that mode. Normal matching keeps it.
    const filterByAuthor = authorNames.length && !coversOnly
    // Pre-filter hits by their indexed people before capping: the target
    // book can rank below the first #maxBooksPerSearch hits.
    const prefiltered = filterByAuthor ? hits.filter((hit) => this.bookAuthorsContain(hit, authorNames)) : hits
    const books = []
    for (const hit of prefiltered.slice(0, this.#maxBooksPerSearch)) {
      if (!hit?.id || Date.now() >= deadline) break
      if (coversOnly) {
        // Cover lookups only need the hit's cover image; skip the /books/
        // fanout entirely. A hit without a usable cover source contributes
        // nothing, and its release refs are dropped so the hit maps to a
        // single work-level candidate.
        const covered = this.#imageCover(hit.coverImage) || this.#imageCover(hit.image) || this.#imageCover(hit.images?.[0])
        if (!covered) continue
        books.push({ ...hit, releases: [] })
        continue
      }
      const book = await this._request(`/books/${hit.id}?include=${this.#hydrationInclude}`, 'GET', null, deadline, true)
      if (!book?.id) continue
      const merged = { ...hit, ...book }
      if (filterByAuthor && !this.bookAuthorsContain(merged, authorNames)) continue
      books.push(merged)
    }
    return books.flatMap((book) => this.buildCandidates(book))
  }

  /**
   * Normalize an author name for comparison: strip diacritics, lowercase,
   * and collapse runs of non-alphanumerics to single spaces, so "Devon C.
   * Ford" compares as "devon c ford".
   *
   * @param {string} name
   * @returns {string}
   */
  normalizeAuthorName(name) {
    if (!name || typeof name !== 'string') return ''
    try {
      return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
    } catch (error) {
      return name.toLowerCase().trim()
    }
  }

  /**
   * True when every requested author name matches one of the book's author
   * credits under a tolerant token rule: single-letter initials are ignored
   * ("Devon C. Ford" compares as "devon ford"), and every remaining
   * requested token must appear in the credit (containment in either
   * direction, e.g. abbreviated names, or a Levenshtein similarity of at
   * least 0.95, e.g. diacritic/stress variants). The requested name is a
   * subset of the credit, so "Smith" matches "Smith, John" and a reordered
   * "Patrick O'Brien" matches "O'Brien, Patrick", while a one-letter
   * mutation ("Kate Reeding" vs "Kate Reading") does not.
   *
   * @param {Object} book - hydrated BookDTO (or raw search hit)
   * @param {string[]} authorNames - trimmed (lowercased) author names
   * @returns {boolean}
   */
  #authorTokens(name) {
    const normalized = this.normalizeAuthorName(name)
    return normalized.split(' ').filter((token) => token.length > 1)
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

module.exports = AudiobookDB
