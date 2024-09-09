const OpenLibrary = require('../providers/OpenLibrary')
const GoogleBooks = require('../providers/GoogleBooks')
const Audible = require('../providers/Audible')
const iTunes = require('../providers/iTunes')
const Audnexus = require('../providers/Audnexus')
const FantLab = require('../providers/FantLab')
const AudiobookCovers = require('../providers/AudiobookCovers')
const CustomProviderAdapter = require('../providers/CustomProviderAdapter')
const Logger = require('../Logger')
const { levenshteinDistance, escapeRegExp } = require('../utils/index')

class BookFinder {
  #providerResponseTimeout = 30000

  constructor() {
    this.openLibrary = new OpenLibrary()
    this.googleBooks = new GoogleBooks()
    this.audible = new Audible()
    this.iTunesApi = new iTunes()
    this.audnexus = new Audnexus()
    this.fantLab = new FantLab()
    this.audiobookCovers = new AudiobookCovers()
    this.customProviderAdapter = new CustomProviderAdapter()

    this.providers = ['google', 'itunes', 'openlibrary', 'fantlab', 'audiobookcovers', 'audible', 'audible.ca', 'audible.uk', 'audible.au', 'audible.fr', 'audible.de', 'audible.jp', 'audible.it', 'audible.in', 'audible.es']

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
        [/([,:;_]| by ).*/g, ''], // Remove subtitle
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
   * @param {Object} libraryItem
   * @param {string} provider
   * @param {string} title
   * @param {string} author
   * @param {string} isbn
   * @param {string} asin
   * @param {{titleDistance:number, authorDistance:number, maxFuzzySearches:number}} options
   * @returns {Promise<Object[]>}
   */
  async search(libraryItem, provider, title, author, isbn, asin, options = {}) {
    let books = []
    const maxTitleDistance = !isNaN(options.titleDistance) ? Number(options.titleDistance) : 4
    const maxAuthorDistance = !isNaN(options.authorDistance) ? Number(options.authorDistance) : 4
    const maxFuzzySearches = !isNaN(options.maxFuzzySearches) ? Number(options.maxFuzzySearches) : 5
    let numFuzzySearches = 0

    // Custom providers are assumed to be correct
    if (provider.startsWith('custom-')) {
      return this.getCustomProviderResults(title, author, isbn, provider)
    }

    if (!title) return books

    books = await this.runSearch(title, author, provider, asin, maxTitleDistance, maxAuthorDistance)

    if (!books.length && maxFuzzySearches > 0) {
      // Normalize title and author
      title = title.trim().toLowerCase()
      author = author?.trim().toLowerCase() || ''

      const cleanAuthor = cleanAuthorForCompares(author)

      // Now run up to maxFuzzySearches fuzzy searches
      let authorCandidates = new BookFinder.AuthorCandidates(cleanAuthor, this.audnexus)

      // Remove underscores and parentheses with their contents, and replace with a separator
      const cleanTitle = title.replace(/\[.*?\]|\(.*?\)|{.*?}|_/g, ' - ')
      // Split title into hypen-separated parts
      const titleParts = cleanTitle.split(/ - | -|- /)
      for (const titlePart of titleParts) authorCandidates.add(titlePart)
      authorCandidates = await authorCandidates.getCandidates()
      loop_author: for (const authorCandidate of authorCandidates) {
        let titleCandidates = new BookFinder.TitleCandidates(authorCandidate)
        for (const titlePart of titleParts) titleCandidates.add(titlePart)
        titleCandidates = titleCandidates.getCandidates()
        for (const titleCandidate of titleCandidates) {
          if (titleCandidate == title && authorCandidate == author) continue // We already tried this
          if (++numFuzzySearches > maxFuzzySearches) break loop_author
          books = await this.runSearch(titleCandidate, authorCandidate, provider, asin, maxTitleDistance, maxAuthorDistance)
          if (books.length) break loop_author
        }
      }
    }

    if (books.length) {
      const resultsHaveDuration = provider.startsWith('audible')
      if (resultsHaveDuration && libraryItem?.media?.duration) {
        const libraryItemDurationMinutes = libraryItem.media.duration / 60
        // If provider results have duration, sort by ascendinge duration difference from libraryItem
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
   * Search for books
   *
   * @param {string} title
   * @param {string} author
   * @param {string} provider
   * @param {string} asin only used for audible providers
   * @param {number} maxTitleDistance only used for openlibrary provider
   * @param {number} maxAuthorDistance only used for openlibrary provider
   * @returns {Promise<Object[]>}
   */
  async runSearch(title, author, provider, asin, maxTitleDistance, maxAuthorDistance) {
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
    } else {
      books = await this.getGoogleBooksResults(title, author)
    }
    return books
  }

  async findCovers(provider, title, author, options = {}) {
    let searchResults = []

    if (provider === 'all') {
      for (const providerString of this.providers) {
        const providerResults = await this.search(null, providerString, title, author, options)
        Logger.debug(`[BookFinder] Found ${providerResults.length} covers from ${providerString}`)
        searchResults.push(...providerResults)
      }
    } else {
      searchResults = await this.search(null, provider, title, author, options)
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

function stripSubtitle(title) {
  if (title.includes(':')) {
    return title.split(':')[0].trim()
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

function cleanTitleForCompares(title) {
  if (!title) return ''
  title = stripRedundantSpaces(title)

  // Remove subtitle if there (i.e. "Cool Book: Coolest Ever" becomes "Cool Book")
  let stripped = stripSubtitle(title)

  // Remove text in paranthesis (i.e. "Ender's Game (Ender's Saga)" becomes "Ender's Game")
  let cleaned = stripped.replace(/ *\([^)]*\) */g, '')

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
