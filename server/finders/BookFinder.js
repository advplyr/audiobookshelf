const OpenLibrary = require('../providers/OpenLibrary')
const GoogleBooks = require('../providers/GoogleBooks')
const Audible = require('../providers/Audible')
const iTunes = require('../providers/iTunes')
const Audnexus = require('../providers/Audnexus')
const AudiobookDB = require('../providers/AudiobookDB')
const AudiobookDBError = require('../providers/AudiobookDBError')
const FantLab = require('../providers/FantLab')
const AudiobookCovers = require('../providers/AudiobookCovers')
const CustomProviderAdapter = require('../providers/CustomProviderAdapter')
const Logger = require('../Logger')
const { levenshteinDistance, levenshteinSimilarity, escapeRegExp, isValidASIN } = require('../utils/index')
const htmlSanitizer = require('../utils/htmlSanitizer')

class BookFinder {
  #providerResponseTimeout = 10000

  constructor() {
    this.openLibrary = new OpenLibrary()
    this.googleBooks = new GoogleBooks()
    this.audible = new Audible()
    this.iTunesApi = new iTunes()
    this.audnexus = new Audnexus()
    this.audiobookdb = new AudiobookDB()
    this.fantLab = new FantLab()
    this.audiobookCovers = new AudiobookCovers()
    this.customProviderAdapter = new CustomProviderAdapter()

    this.providers = ['google', 'itunes', 'openlibrary', 'fantlab', 'audiobookcovers', 'audible', 'audible.ca', 'audible.uk', 'audible.au', 'audible.fr', 'audible.de', 'audible.jp', 'audible.it', 'audible.in', 'audible.es', 'audiobookdb']

    this.verbose = false
  }

  async findByISBN(isbn) {
    var book = await this.openLibrary.isbnLookup(isbn)
    if (book.errorCode) {
      Logger.error('Book not found')
    }
    return book
  }

  filterSearchResults(books, title, author, maxTitleDistance, maxAuthorDistance) {
    var searchTitle = cleanTitleForCompares(title)
    var searchAuthor = cleanAuthorForCompares(author)
    return books
      .map((b) => {
        b.cleanedTitle = cleanTitleForCompares(b.title)
        b.titleDistance = levenshteinDistance(b.cleanedTitle, title)

        // Total length of search (title or both title & author)
        b.totalPossibleDistance = b.title.length

        if (author) {
          if (!b.author) {
            b.authorDistance = author.length
          } else {
            b.totalPossibleDistance += b.author.length
            b.cleanedAuthor = cleanAuthorForCompares(b.author)

            var cleanedAuthorDistance = levenshteinDistance(b.cleanedAuthor, searchAuthor)
            var authorDistance = levenshteinDistance(b.author || '', author)

            // Use best distance
            b.authorDistance = Math.min(cleanedAuthorDistance, authorDistance)

            // Check book author contains searchAuthor
            if (searchAuthor.length > 4 && b.cleanedAuthor.includes(searchAuthor)) b.includesAuthor = searchAuthor
            else if (author.length > 4 && b.author.includes(author)) b.includesAuthor = author
          }
        }
        b.totalDistance = b.titleDistance + (b.authorDistance || 0)

        // Check book title contains the searchTitle
        if (searchTitle.length > 4 && b.cleanedTitle.includes(searchTitle)) b.includesTitle = searchTitle
        else if (title.length > 4 && b.title.includes(title)) b.includesTitle = title

        return b
      })
      .filter((b) => {
        if (b.includesTitle) {
          // If search title was found in result title then skip over leven distance check
          if (this.verbose) Logger.debug(`Exact title was included in "${b.title}", Search: "${b.includesTitle}"`)
        } else if (b.titleDistance > maxTitleDistance) {
          if (this.verbose) Logger.debug(`Filtering out search result title distance = ${b.titleDistance}: "${b.cleanedTitle}"/"${searchTitle}"`)
          return false
        }

        if (author) {
          if (b.includesAuthor) {
            // If search author was found in result author then skip over leven distance check
            if (this.verbose) Logger.debug(`Exact author was included in "${b.author}", Search: "${b.includesAuthor}"`)
          } else if (b.authorDistance > maxAuthorDistance) {
            if (this.verbose) Logger.debug(`Filtering out search result "${b.author}", author distance = ${b.authorDistance}: "${b.author}"/"${author}"`)
            return false
          }
        }

        // If book total search length < 5 and was not exact match, then filter out
        if (b.totalPossibleDistance < 5 && b.totalDistance > 0) return false
        return true
      })
  }

  /**
   *
   * @param {string} title
   * @param {string} author
   * @param {number} maxTitleDistance
   * @param {number} maxAuthorDistance
   * @returns {Promise<Object[]>}
   */
  async getOpenLibResults(title, author, maxTitleDistance, maxAuthorDistance) {
    var books = await this.openLibrary.searchTitle(title, this.#providerResponseTimeout)
    if (this.verbose) Logger.debug(`OpenLib Book Search Results: ${books.length || 0}`)
    if (books.errorCode) {
      Logger.error(`OpenLib Search Error ${books.errorCode}`)
      return []
    }
    var booksFiltered = this.filterSearchResults(books, title, author, maxTitleDistance, maxAuthorDistance)
    if (!booksFiltered.length && books.length) {
      if (this.verbose) Logger.debug(`Search has ${books.length} matches, but no close title matches`)
    }
    booksFiltered.sort((a, b) => {
      return a.totalDistance - b.totalDistance
    })

    return booksFiltered
  }

  /**
   *
   * @param {string} title
   * @param {string} author
   * @returns {Promise<Object[]>}
   */
  async getGoogleBooksResults(title, author) {
    var books = await this.googleBooks.search(title, author, this.#providerResponseTimeout)
    if (this.verbose) Logger.debug(`GoogleBooks Book Search Results: ${books.length || 0}`)
    if (books.errorCode) {
      Logger.error(`GoogleBooks Search Error ${books.errorCode}`)
      return []
    }
    // Google has good sort
    return books
  }

  /**
   *
   * @param {string} title
   * @param {string} author
   * @returns {Promise<Object[]>}
   */
  async getFantLabResults(title, author) {
    var books = await this.fantLab.search(title, author, this.#providerResponseTimeout)
    if (this.verbose) Logger.debug(`FantLab Book Search Results: ${books.length || 0}`)
    if (books.errorCode) {
      Logger.error(`FantLab Search Error ${books.errorCode}`)
      return []
    }

    return books
  }

  /**
   *
   * @param {string} search
   * @returns {Promise<Object[]>}
   */
  async getAudiobookCoversResults(search) {
    const covers = await this.audiobookCovers.search(search, this.#providerResponseTimeout)
    if (this.verbose) Logger.debug(`AudiobookCovers Search Results: ${covers.length || 0}`)
    return covers || []
  }

  /**
   *
   * @param {string} title
   * @param {string} author
   * @param {string} asin
   * @param {boolean} coversOnly
   * @param {number|null} deadline
   * @returns {Promise<Object[]>}
   */
  async getAudiobookDBResults(title, author, asin, coversOnly = false, deadline = null) {
    // Share the caller's operation-wide deadline: only the remaining time
    // is left for this call.
    const timeout = deadline ? Math.max(0, deadline - Date.now()) : this.#providerResponseTimeout
    const books = await this.audiobookdb.search(title, author, asin, timeout, { coversOnly })
    if (this.verbose) Logger.debug(`AudiobookDB Search Results: ${books.length || 0}`)
    return books || []
  }

  /**
   *
   * @param {string} title
   * @returns {Promise<Object[]>}
   */
  async getiTunesAudiobooksResults(title) {
    return this.iTunesApi.searchAudiobooks(title, this.#providerResponseTimeout)
  }

  /**
   *
   * @param {string} title
   * @param {string} author
   * @param {string} asin
   * @param {string} provider
   * @returns {Promise<Object[]>}
   */
  async getAudibleResults(title, author, asin, provider) {
    const region = provider.includes('.') ? provider.split('.').pop() : ''
    const books = await this.audible.search(title, author, asin, region, this.#providerResponseTimeout)
    if (this.verbose) Logger.debug(`Audible Book Search Results: ${books.length || 0}`)
    if (!books) return []
    return books
  }

  /**
   *
   * @param {string} title
   * @param {string} author
   * @param {string} isbn
   * @param {string} providerSlug
   * @returns {Promise<Object[]>}
   */
  async getCustomProviderResults(title, author, isbn, providerSlug) {
    try {
      const books = await this.customProviderAdapter.search(title, author, isbn, providerSlug, 'book', this.#providerResponseTimeout)
      if (this.verbose) Logger.debug(`Custom provider '${providerSlug}' Search Results: ${books.length || 0}`)
      return books
    } catch (error) {
      Logger.error(`Error searching Custom provider '${providerSlug}':`, error)
      return []
    }
  }

  static TitleCandidates = class {
    constructor(cleanAuthor) {
      this.candidates = new Set()
      this.cleanAuthor = cleanAuthor
      this.priorities = {}
      this.positions = {}
      this.currentPosition = 0
    }

    add(title) {
      // if title contains the author, remove it
      title = this.#removeAuthorFromTitle(title)

      const titleTransformers = [
        [/(: |[,;_]| by ).*/g, ''], // Remove subtitle
        [/(^| )\d+k(bps)?( |$)/, ' '], // Remove bitrate
        [/ (2nd|3rd|\d+th)\s+ed(\.|ition)?/g, ''], // Remove edition
        [/(^| |\.)(m4b|m4a|mp3)( |$)/g, ''], // Remove file-type
        [/ a novel.*$/g, ''], // Remove "a novel"
        [/(^| )(un)?abridged( |$)/g, ' '], // Remove "unabridged/abridged"
        [/^\d+ | \d+$/g, ''] // Remove preceding/trailing numbers
      ]

      // Main variant
      const cleanTitle = cleanTitleForCompares(title).trim()
      if (!cleanTitle) return
      this.candidates.add(cleanTitle)
      this.priorities[cleanTitle] = 0
      this.positions[cleanTitle] = this.currentPosition

      let candidate = cleanTitle

      for (const transformer of titleTransformers) candidate = candidate.replace(transformer[0], transformer[1]).trim()

      if (candidate != cleanTitle) {
        if (candidate) {
          this.candidates.add(candidate)
          this.priorities[candidate] = 0
          this.positions[candidate] = this.currentPosition
        }
        this.priorities[cleanTitle] = 1
      }
      this.currentPosition++
    }

    get size() {
      return this.candidates.size
    }

    getCandidates() {
      var candidates = [...this.candidates]
      candidates.sort((a, b) => {
        // Candidates that include only digits are also likely low quality
        const onlyDigits = /^\d+$/
        const includesOnlyDigitsDiff = onlyDigits.test(a) - onlyDigits.test(b)
        if (includesOnlyDigitsDiff) return includesOnlyDigitsDiff
        // transformed candidates receive higher priority
        const priorityDiff = this.priorities[a] - this.priorities[b]
        if (priorityDiff) return priorityDiff
        // if same priorirty, prefer candidates that are closer to the beginning (e.g. titles before subtitles)
        const positionDiff = this.positions[a] - this.positions[b]
        return positionDiff // candidates with same priority always have different positions
      })
      Logger.debug(`[${this.constructor.name}] Found ${candidates.length} fuzzy title candidates`)
      Logger.debug(candidates)
      return candidates
    }

    delete(title) {
      return this.candidates.delete(title)
    }

    #removeAuthorFromTitle(title) {
      if (!this.cleanAuthor) return title
      const authorRe = new RegExp(`(^| | by |)${escapeRegExp(this.cleanAuthor)}(?= |$)`, 'g')
      const authorCleanedTitle = cleanAuthorForCompares(title)
      const authorCleanedTitleWithoutAuthor = authorCleanedTitle.replace(authorRe, '')
      if (authorCleanedTitleWithoutAuthor !== authorCleanedTitle) {
        return authorCleanedTitleWithoutAuthor.trim()
      }
      return title
    }
  }

  static AuthorCandidates = class {
    constructor(cleanAuthor, audnexus) {
      this.audnexus = audnexus
      this.candidates = new Set()
      this.cleanAuthor = cleanAuthor
      if (cleanAuthor) this.candidates.add(cleanAuthor)
    }

    validateAuthor(name, region = '', maxLevenshtein = 2) {
      return this.audnexus.authorASINsRequest(name, region).then((asins) => {
        for (const [i, asin] of asins.entries()) {
          if (i > 10) break
          let cleanName = cleanAuthorForCompares(asin.name)
          if (!cleanName) continue
          if (cleanName.includes(name)) return name
          if (name.includes(cleanName)) return cleanName
          if (levenshteinDistance(cleanName, name) <= maxLevenshtein) return cleanName
        }
        return ''
      })
    }

    add(author) {
      const cleanAuthor = cleanAuthorForCompares(author).trim()
      if (!cleanAuthor) return
      this.candidates.add(cleanAuthor)
    }

    get size() {
      return this.candidates.size
    }

    get agressivelyCleanAuthor() {
      if (this.cleanAuthor) {
        const agressivelyCleanAuthor = this.cleanAuthor.replace(/[,/-].*$/, '').trim()
        return agressivelyCleanAuthor ? agressivelyCleanAuthor : this.cleanAuthor
      }
      return ''
    }

    async getCandidates() {
      var filteredCandidates = []
      var promises = []
      for (const candidate of this.candidates) {
        promises.push(this.validateAuthor(candidate))
      }
      const results = [...new Set(await Promise.all(promises))]
      filteredCandidates = results.filter((author) => author)
      // If no valid candidates were found, add back an aggresively cleaned author version
      if (!filteredCandidates.length && this.cleanAuthor) filteredCandidates.push(this.agressivelyCleanAuthor)
      // Always add an empty author candidate
      filteredCandidates.push('')
      Logger.debug(`[${this.constructor.name}] Found ${filteredCandidates.length} fuzzy author candidates`)
      Logger.debug(filteredCandidates)
      return filteredCandidates
    }

    delete(author) {
      return this.candidates.delete(author)
    }
  }

  /**
   * Search for books including fuzzy searches
   *
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {string} provider
   * @param {string} title
   * @param {string} author
   * @param {string} isbn
   * @param {string} asin
   * @param {{titleDistance:number, authorDistance:number, maxFuzzySearches:number, coversOnly?:boolean, quickMatch?:boolean}} options
   * @returns {Promise<Object[]>}
   */
  async search(libraryItem, provider, title, author, isbn, asin, options = {}) {
    let books = []
    const maxTitleDistance = !isNaN(options.titleDistance) ? Number(options.titleDistance) : 4
    const maxAuthorDistance = !isNaN(options.authorDistance) ? Number(options.authorDistance) : 4
    const maxFuzzySearches = !isNaN(options.maxFuzzySearches) ? Number(options.maxFuzzySearches) : 5
    let numFuzzySearches = 0

    // Cover lookups need only the cover image: AudiobookDB serves them
    // straight from /search hits without any detail fanout.
    const coversOnly = provider === 'audiobookdb' && !!options.coversOnly
    // One deadline for the whole AudiobookDB operation (throttle waits and
    // fallback attempts share it).
    const audiobookdbDeadline = provider === 'audiobookdb' ? Date.now() + this.#providerResponseTimeout : null
    // The library item's runtime, used to rank multi-recording results by
    // length.
    const libraryItemDurationMinutes = libraryItem?.media?.duration ? libraryItem.media.duration / 60 : null

    // Custom providers are assumed to be correct
    if (provider.startsWith('custom-')) {
      return this.getCustomProviderResults(title, author, isbn, provider)
    }

    // An explicit ASIN is enough to resolve a recording on the identifier
    // providers; an ASIN-shaped title alone is not an identifier signal.
    const explicitAsin = typeof asin === 'string' ? asin.trim() : ''
    const canResolveWithoutTitle = !!(explicitAsin && (provider.startsWith('audible') || provider === 'audiobookdb'))
    if (!title && !canResolveWithoutTitle) return books

    // Truncate excessively long inputs to prevent ReDoS attacks
    const MAX_INPUT_LENGTH = 500
    title = title ? title.substring(0, MAX_INPUT_LENGTH) : ''
    author = author?.substring(0, MAX_INPUT_LENGTH) || author

    const isTitleAsin = isValidASIN(title.toUpperCase())

    let actualTitleQuery = title
    let actualAuthorQuery = author
    books = await this.runSearch(actualTitleQuery, actualAuthorQuery, provider, asin, maxTitleDistance, maxAuthorDistance, coversOnly, audiobookdbDeadline)

    // Audnexus fuzzy-author re-searches are only useful for providers whose
    // backend search does not handle matching; AudiobookDB search already does.
    if (!books.length && maxFuzzySearches > 0 && provider !== 'audiobookdb') {
      // Normalize title and author
      title = title.trim().toLowerCase()
      author = author?.trim().toLowerCase() || ''

      const cleanAuthor = cleanAuthorForCompares(author)

      // Now run up to maxFuzzySearches fuzzy searches
      let authorCandidates = new BookFinder.AuthorCandidates(cleanAuthor, this.audnexus)

      // Remove underscores and parentheses with their contents, and replace with a separator
      // Use negated character classes to prevent ReDoS vulnerability (input length validated at entry point)
      const cleanTitle = title.replace(/\[[^\]]*\]|\([^)]*\)|{[^}]*}|_/g, ' - ')
      // Split title into hypen-separated parts
      const titleParts = cleanTitle.split(/ - | -|- /)
      for (const titlePart of titleParts) authorCandidates.add(titlePart)
      authorCandidates = await authorCandidates.getCandidates()
      loop_author: for (const authorCandidate of authorCandidates) {
        let titleCandidates = new BookFinder.TitleCandidates(authorCandidate)
        for (const titlePart of titleParts) titleCandidates.add(titlePart)
        titleCandidates = titleCandidates.getCandidates()
        for (const titleCandidate of titleCandidates) {
          if (titleCandidate == actualTitleQuery && authorCandidate == actualAuthorQuery) continue // We already tried this
          if (++numFuzzySearches > maxFuzzySearches) break loop_author
          actualTitleQuery = titleCandidate
          actualAuthorQuery = authorCandidate
          books = await this.runSearch(actualTitleQuery, actualAuthorQuery, provider, asin, maxTitleDistance, maxAuthorDistance, coversOnly, audiobookdbDeadline)
          if (books.length) break loop_author
        }
      }
    } else if (!books.length && maxFuzzySearches > 0 && provider === 'audiobookdb') {
      // Bounded local fallback for AudiobookDB: the backend matching is
      // lenient, so the fallback only relaxes the query — never substituting
      // a different author for the one the item carries. Order: the main
      // title with the item's cleaned author, immediately followed by the
      // main title with no author; only then does the remaining budget
      // spend on title variants and the aggressively cleaned author level —
      // so a two-search quick-match budget reaches the no-author main-title
      // recovery even for multi-part/annotated titles, while the manual
      // default budget keeps the author-relaxed attempts first. All
      // attempts share the maxFuzzySearches budget and deadline.
      if (!coversOnly && !canResolveWithoutTitle) {
        title = title.trim().toLowerCase()
        author = author?.trim().toLowerCase() || ''

        const cleanAuthor = cleanAuthorForCompares(author)
        const aggressiveAuthor = cleanAuthor.replace(/[,/-].*$/, '').trim()
        // Only relaxations of the author the item carries (or none): the
        // full normalized author and its aggressively cleaned form are
        // derived from it, so no other author is ever substituted.
        const authorCandidates = []
        for (const candidate of [cleanAuthor, '', aggressiveAuthor]) {
          if (!authorCandidates.includes(candidate)) authorCandidates.push(candidate)
        }

        // Remove underscores and parentheses with their contents, and replace with a separator
        // Use negated character classes to prevent ReDoS vulnerability (input length validated at entry point)
        const cleanTitle = title.replace(/\[[^\]]*\]|\([^)]*\)|{[^}]*}|_/g, ' - ')
        // Split title into hypen-separated parts
        const titleParts = cleanTitle.split(/ - | -|- /)
        const mainTitle = cleanTitleForCompares(title)

        const titleCandidates = new BookFinder.TitleCandidates('')
        for (const titlePart of titleParts) titleCandidates.add(titlePart)
        const titleVariants = titleCandidates.getCandidates()

        // Title variants exclude the main title, which always leads.
        const variantTail = titleVariants.filter((v) => v !== mainTitle)

        // Query order: the main title with the item's cleaned author is
        // immediately followed by the main title with no author, so the
        // two-search quick-match budget reaches the no-author recovery
        // before any title variant can spend it. The remaining budget then
        // spends on title variants and the aggressively cleaned author
        // level, with each variant leading its author level.
        const tried = new Set([`${actualTitleQuery.toLowerCase()}|${(actualAuthorQuery || '').toLowerCase()}`])
        const fallbackQueries = []
        for (const [titleQuery, authorQuery] of [
          [mainTitle, cleanAuthor],
          [mainTitle, ''],
          ...variantTail.flatMap((titleQuery) => authorCandidates.map((authorQuery) => [titleQuery, authorQuery]))
        ]) {
          if (!titleQuery) continue
          const key = `${titleQuery}|${authorQuery}`
          if (tried.has(key)) continue // We already tried this
          tried.add(key)
          fallbackQueries.push([titleQuery, authorQuery])
        }

        loop_fallback: for (const [titleCandidate, authorCandidate] of fallbackQueries) {
          if (audiobookdbDeadline && Date.now() >= audiobookdbDeadline) break loop_fallback
          if (++numFuzzySearches > maxFuzzySearches) break loop_fallback
          actualTitleQuery = titleCandidate
          actualAuthorQuery = authorCandidate
          books = await this.runSearch(actualTitleQuery, actualAuthorQuery, provider, asin, maxTitleDistance, maxAuthorDistance, coversOnly, audiobookdbDeadline)
          if (books.length) break loop_fallback
        }
      }
    }

    // Main-title fallback can intentionally remove a subtitle from the
    // submitted query. Compare against that effective query while retaining
    // subtitles on candidates, so unrelated same-prefix works stay rejected.
    // Manual matching returns the candidates for user selection and is left
    // untouched. An explicit ASIN already pins a matched release, so its
    // exact candidate is not rejected by a stale local title. A successful
    // ASIN-shaped title probe does the same: the provider resolved the
    // identifier exactly, and the resolved candidate's ASIN proves the
    // identity a stale local title cannot.
    if (provider === 'audiobookdb' && options.quickMatch && !explicitAsin && books.length) {
      const titleAsin = isTitleAsin ? title.toUpperCase() : ''
      const normMainTitle = cleanTitleForCompares(actualTitleQuery, true)
      books = books.filter(
        (book) =>
          cleanTitleForCompares(book.title, true) === normMainTitle ||
          (titleAsin && (book.asin || '').toUpperCase() === titleAsin)
      )
      if (!books.length) {
        Logger.debug(`[BookFinder] quickMatch title identity gate rejected all AudiobookDB results for "${title}"`)
        return []
      }
      // An exact title can still belong to several distinct works (e.g. two
      // unrelated "Andorra" audiobooks): multiple release candidates of one
      // work share its book id, so more than one distinct id — or any
      // candidate without one — is ambiguous and must abstain rather than
      // fall back to runtime ranking to break the tie.
      const workIds = [...new Set(books.map((book) => book.id))]
      if (workIds.length !== 1 || !workIds[0]) {
        Logger.debug(`[BookFinder] quickMatch work identity gate abstained: ${workIds.length} distinct work id(s) for exact title "${title}"`)
        return []
      }
    }

    if (books.length && libraryItem) {
      const isAudibleProvider = provider.startsWith('audible')
      const isAudiobookDBProvider = provider === 'audiobookdb'

      books.forEach((book) => {
        if (typeof book !== 'object' || !isAudibleProvider) return
        book.matchConfidence = this.calculateMatchConfidence(book, libraryItemDurationMinutes, actualTitleQuery, actualAuthorQuery, isTitleAsin)
      })

      // For multi-recording results prefer the recording closest in runtime to
      // the library item (e.g. different narrated editions of the same book).
      if ((isAudibleProvider || isAudiobookDBProvider) && libraryItemDurationMinutes) {
        books.sort((a, b) => {
          const aDuration = a.duration || Number.POSITIVE_INFINITY
          const bDuration = b.duration || Number.POSITIVE_INFINITY
          const aDurationDiff = Math.abs(aDuration - libraryItemDurationMinutes)
          const bDurationDiff = Math.abs(bDuration - libraryItemDurationMinutes)
          return aDurationDiff - bDurationDiff
        })
      }
    }
    return books
  }

  /**
   * Calculate match confidence score for a book
   * @param {Object} book - The book object to calculate confidence for
   * @param {number|null} libraryItemDurationMinutes - Duration of library item in minutes
   * @param {string} actualTitleQuery - Actual title query
   * @param {string} actualAuthorQuery - Actual author query
   * @param {boolean} isTitleAsin - Whether the title is an ASIN
   * @returns {number|null} - Match confidence score or null if not applicable
   */
  calculateMatchConfidence(book, libraryItemDurationMinutes, actualTitleQuery, actualAuthorQuery, isTitleAsin) {
    // ASIN results are always a match
    if (isTitleAsin) return 1.0

    let durationScore
    if (libraryItemDurationMinutes && typeof book.duration === 'number') {
      const durationDiff = Math.abs(book.duration - libraryItemDurationMinutes)
      // Duration scores:
      // diff | score
      // 0    | 1.0
      // 1    | 1.0
      // 2    | 0.9
      // 3    | 0.8
      // 4    | 0.7
      // 5    | 0.6
      // 6    | 0.48
      // 7    | 0.36
      // 8    | 0.24
      // 9    | 0.12
      // 10   | 0.0
      if (durationDiff <= 1) {
        // Covers durationDiff = 0 for score 1.0
        durationScore = 1.0
      } else if (durationDiff <= 5) {
        // (1, 5] - Score from 1.0 down to 0.6
        // Linearly interpolates between (1, 1.0) and (5, 0.6)
        // Equation: y = 1.0 - 0.08 * x
        durationScore = 1.1 - 0.1 * durationDiff
      } else if (durationDiff <= 10) {
        // (5, 10] - Score from 0.6 down to 0.0
        // Linearly interpolates between (5, 0.6) and (10, 0.0)
        // Equation: y = 1.2 - 0.12 * x
        durationScore = 1.2 - 0.12 * durationDiff
      } else {
        // durationDiff > 10 - Score is 0.0
        durationScore = 0.0
      }
      Logger.debug(`[BookFinder] Duration diff: ${durationDiff}, durationScore: ${durationScore}`)
    } else {
      // Default score if library item duration or book duration is not available
      durationScore = 0.1
    }

    const calculateTitleScore = (titleQuery, book, keepSubtitle = false) => {
      const cleanTitle = cleanTitleForCompares(book.title || '', keepSubtitle)
      const cleanSubtitle = keepSubtitle && book.subtitle ? `: ${book.subtitle}` : ''
      const normBookTitle = `${cleanTitle}${cleanSubtitle}`
      const normTitleQuery = cleanTitleForCompares(titleQuery, keepSubtitle)
      const titleSimilarity = levenshteinSimilarity(normTitleQuery, normBookTitle)
      Logger.debug(`[BookFinder] keepSubtitle: ${keepSubtitle}, normBookTitle: ${normBookTitle}, normTitleQuery: ${normTitleQuery}, titleSimilarity: ${titleSimilarity}`)
      return titleSimilarity
    }
    const titleQueryHasSubtitle = hasSubtitle(actualTitleQuery)
    const titleScore = calculateTitleScore(actualTitleQuery, book, titleQueryHasSubtitle)

    let authorScore
    const normAuthorQuery = cleanAuthorForCompares(actualAuthorQuery)
    const normBookAuthor = cleanAuthorForCompares(book.author || '')
    if (!normAuthorQuery) {
      // Original query had no author
      authorScore = 1.0 // Neutral score
    } else {
      // Original query HAS an author (cleanedQueryAuthorForScore is not empty)
      if (normBookAuthor) {
        const bookAuthorParts = normBookAuthor.split(',').map((name) => name.trim().toLowerCase())
        // Filter out empty parts that might result from ", ," or trailing/leading commas
        const validBookAuthorParts = bookAuthorParts.filter((p) => p.length > 0)

        if (validBookAuthorParts.length === 0) {
          // Book author string was present but effectively empty (e.g. ",,")
          // Since cleanedQueryAuthorForScore is non-empty here, this is a mismatch.
          authorScore = 0.0
        } else {
          let maxPartScore = levenshteinSimilarity(normAuthorQuery, normBookAuthor)
          Logger.debug(`[BookFinder] normAuthorQuery: ${normAuthorQuery}, normBookAuthor: ${normBookAuthor}, similarity: ${maxPartScore}`)
          if (validBookAuthorParts.length > 1 || normBookAuthor.includes(',')) {
            validBookAuthorParts.forEach((part) => {
              // part is guaranteed to be non-empty here
              // cleanedQueryAuthorForScore is also guaranteed non-empty here.
              // levenshteinDistance lowercases by default, but part is already lowercased.
              const similarity = levenshteinSimilarity(normAuthorQuery, part)
              Logger.debug(`[BookFinder] normAuthorQuery: ${normAuthorQuery}, bookAuthorPart: ${part}, similarity: ${similarity}`)
              const currentPartScore = similarity
              maxPartScore = Math.max(maxPartScore, currentPartScore)
            })
          }
          authorScore = maxPartScore
        }
      } else {
        // Book has NO author (or not a string, or empty string)
        // Query has an author (cleanedQueryAuthorForScore is non-empty), book does not.
        authorScore = 0.0
      }
    }

    const W_DURATION = 0.7
    const W_TITLE = 0.2
    const W_AUTHOR = 0.1

    Logger.debug(`[BookFinder] Duration score: ${durationScore}, Title score: ${titleScore}, Author score: ${authorScore}`)
    const confidence = W_DURATION * durationScore + W_TITLE * titleScore + W_AUTHOR * authorScore
    Logger.debug(`[BookFinder] Confidence: ${confidence}`)
    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Search for books
   *
   * @param {string} title
   * @param {string} author
   * @param {string} provider
   * @param {string} asin only used for audible and audiobookdb providers
   * @param {number} maxTitleDistance only used for openlibrary provider
   * @param {number} maxAuthorDistance only used for openlibrary provider
   * @param {boolean} coversOnly only used for the audiobookdb provider
   * @param {number|null} deadline operation-wide deadline for the audiobookdb provider
   * @returns {Promise<Object[]>}
   */
  async runSearch(title, author, provider, asin, maxTitleDistance, maxAuthorDistance, coversOnly = false, deadline = null) {
    Logger.debug(`Book Search: title: "${title}", author: "${author || ''}", provider: ${provider}`)

    let books = []

    if (provider === 'google') {
      books = await this.getGoogleBooksResults(title, author)
    } else if (provider.startsWith('audible')) {
      books = await this.getAudibleResults(title, author, asin, provider)
    } else if (provider === 'itunes') {
      books = await this.getiTunesAudiobooksResults(title)
    } else if (provider === 'openlibrary') {
      books = await this.getOpenLibResults(title, author, maxTitleDistance, maxAuthorDistance)
    } else if (provider === 'fantlab') {
      books = await this.getFantLabResults(title, author)
    } else if (provider === 'audiobookcovers') {
      books = await this.getAudiobookCoversResults(title)
    } else if (provider === 'audiobookdb') {
      books = await this.getAudiobookDBResults(title, author, asin, coversOnly, deadline)
    } else {
      books = await this.getGoogleBooksResults(title, author)
    }

    books.forEach((book) => {
      if (book.description) {
        book.description = htmlSanitizer.sanitize(book.description)
        book.descriptionPlain = htmlSanitizer.stripAllTags(book.description)
      }
    })
    return books
  }

  async findCovers(provider, title, author, options = {}) {
    let searchResults = []
    // Cover lookups skip detail fanout where the provider supports it.
    const searchOptions = { ...options, coversOnly: true }

    if (provider === 'all') {
      for (const providerString of this.providers) {
        let providerResults
        try {
          providerResults = await this.search(null, providerString, title, author, undefined, undefined, searchOptions)
        } catch (error) {
          if (providerString !== 'audiobookdb' || !(error instanceof AudiobookDBError)) throw error
          Logger.warn(`[BookFinder] AudiobookDB cover search failed: ${error.code}`)
          continue
        }
        Logger.debug(`[BookFinder] Found ${providerResults.length} covers from ${providerString}`)
        searchResults.push(...providerResults)
      }
    } else if (provider === 'best') {
      // Best providers: google, fantlab, and audible.com
      const bestProviders = ['google', 'fantlab', 'audible']
      for (const providerString of bestProviders) {
        const providerResults = await this.search(null, providerString, title, author, undefined, undefined, searchOptions)
        Logger.debug(`[BookFinder] Found ${providerResults.length} covers from ${providerString}`)
        searchResults.push(...providerResults)
      }
    } else {
      searchResults = await this.search(null, provider, title, author, undefined, undefined, searchOptions)
    }
    Logger.debug(`[BookFinder] FindCovers search results: ${searchResults.length}`)

    const covers = []
    searchResults.forEach((result) => {
      if (result.covers && result.covers.length) {
        covers.push(...result.covers)
      }
      if (result.cover) {
        covers.push(result.cover)
      }
    })
    return [...new Set(covers)]
  }

  findChapters(asin, region) {
    return this.audnexus.getChaptersByASIN(asin, region)
  }
}
module.exports = new BookFinder()

function hasSubtitle(title) {
  return title.includes(': ') || title.includes(' - ')
}
function stripSubtitle(title) {
  if (title.includes(': ')) {
    return title.split(': ')[0].trim()
  } else if (title.includes(' - ')) {
    return title.split(' - ')[0].trim()
  }
  return title
}

function replaceAccentedChars(str) {
  try {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  } catch (error) {
    Logger.error('[BookFinder] str normalize error', error)
    return str
  }
}

function cleanTitleForCompares(title, keepSubtitle = false) {
  if (!title) return ''
  title = stripRedundantSpaces(title)

  // Remove subtitle if there (i.e. "Cool Book: Coolest Ever" becomes "Cool Book")
  let stripped = keepSubtitle ? title : stripSubtitle(title)

  // Remove text in paranthesis (i.e. "Ender's Game (Ender's Saga)" becomes "Ender's Game")
  // Use negated character class to prevent ReDoS vulnerability (input length validated at entry point)
  let cleaned = stripped.replace(/\([^)]*\)/g, '') // Remove parenthetical content
  cleaned = cleaned.replace(/\s+/g, ' ').trim() // Clean up any resulting multiple spaces

  // Remove single quotes (i.e. "Ender's Game" becomes "Enders Game")
  cleaned = cleaned.replace(/'/g, '')
  return replaceAccentedChars(cleaned).toLowerCase()
}

function cleanAuthorForCompares(author) {
  if (!author) return ''
  author = stripRedundantSpaces(author)

  let cleanAuthor = replaceAccentedChars(author).toLowerCase()
  // separate initials
  cleanAuthor = cleanAuthor.replace(/([a-z])\.([a-z])/g, '$1. $2')
  // remove middle initials
  cleanAuthor = cleanAuthor.replace(/(?<=\w\w)(\s+[a-z]\.?)+(?=\s+\w\w)/g, '')
  // remove et al.
  cleanAuthor = cleanAuthor.replace(/ et al\.?(?= |$)/g, '')
  return cleanAuthor
}

function stripRedundantSpaces(str) {
  return str.replace(/\s+/g, ' ').trim()
}
