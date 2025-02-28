const axios = require('axios').default
const Logger = require('../Logger')
const { isValidASIN } = require('../utils/index')

class AudiMeta {
  #responseTimeout = 30000

  constructor() {
    this.regionMap = {
      us: '.com',
      ca: '.ca',
      uk: '.co.uk',
      au: '.com.au',
      fr: '.fr',
      de: '.de',
      jp: '.co.jp',
      it: '.it',
      in: '.in',
      es: '.es'
    }
  }

  /**
   * Audible will sometimes send sequences with "Book 1" or "2, Dramatized Adaptation"
   * @see https://github.com/advplyr/audiobookshelf/issues/2380
   * @see https://github.com/advplyr/audiobookshelf/issues/1339
   *
   * @param {string} seriesName
   * @param {string} sequence
   * @returns {string}
   */
  cleanSeriesSequence(seriesName, sequence) {
    if (!sequence) return ''
    // match any number with optional decimal (e.g, 1 or 1.5 or .5)
    let numberFound = sequence.match(/\.\d+|\d+(?:\.\d+)?/)
    let updatedSequence = numberFound ? numberFound[0] : sequence
    if (sequence !== updatedSequence) {
      Logger.debug(`[AudiMeta] Series "${seriesName}" sequence was cleaned from "${sequence}" to "${updatedSequence}"`)
    }
    return updatedSequence
  }

  cleanResult(item) {
    const { title, subtitle, asin, authors, narrators, publisherName, summary, releaseDate, imageUrl, genres, series, language, lengthMinutes, bookFormat	} = item

    const seriesList = []

    series.forEach((s) => {
      seriesList.push({
        series: s.name,
        sequence: this.cleanSeriesSequence(s.name, (s.position || '').toString())
      })
    });

    // Tags and Genres are flipped for AudiMeta
    const genresFiltered = genres ? genres.filter((g) => g.type == 'Tags').map((g) => g.name) : []
    const tagsFiltered = genres ? genres.filter((g) => g.type == 'Genres').map((g) => g.name) : []

    return {
      title,
      subtitle: subtitle || null,
      author: authors ? authors.map(({ name }) => name).join(', ') : null,
      narrator: narrators ? narrators.map(({ name }) => name).join(', ') : null,
      publisher: publisherName,
      publishedYear: releaseDate ? releaseDate.split('-')[0] : null,
      description: summary || null,
      cover: imageUrl,
      asin,
      genres: genresFiltered.length ? genresFiltered : null,
      tags: tagsFiltered.length ? tagsFiltered.join(', ') : null,
      series: seriesList.length ? seriesList : null,
      language: language ? language.charAt(0).toUpperCase() + language.slice(1) : null,
      duration: lengthMinutes && !isNaN(lengthMinutes) ? Number(lengthMinutes) : 0,
      region: item.region || null,
      rating: item.rating || null,
      abridged: bookFormat === 'abridged'
    }
  }

  /**
   *
   * @param {string} asin
   * @param {string} region
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object>}
   */
  asinSearch(asin, region, timeout = this.#responseTimeout) {
    if (!asin) return null
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout

    asin = encodeURIComponent(asin.toUpperCase())
    let regionQuery = region ? `?region=${region}` : ''
    let url = `https://audimeta.de/book/${asin}${regionQuery}`
    Logger.debug(`[AudiMeta] ASIN url: ${url}`)
    return axios
      .get(url, {
        timeout
      })
      .then((res) => {
        if (!res?.data?.asin) return null
        return res.data
      })
      .catch((error) => {
        Logger.error('[Audible] ASIN search error', error)
        return null
      })
  }

  /**
   *
   * @param {string} title
   * @param {string} author
   * @param {string} asin
   * @param {string} region
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object[]>}
   */
  async search(title, author, asin, region, timeout = this.#responseTimeout) {
    if (region && !this.regionMap[region]) {
      Logger.error(`[AudiMeta] search: Invalid region ${region}`)
      region = ''
    }
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout

    let items = []
    if (asin && isValidASIN(asin.toUpperCase())) {
      const item = await this.asinSearch(asin.toUpperCase(), region, timeout)
      if (item) items.push(item)
    }

    if (!items.length && isValidASIN(title.toUpperCase())) {
      const item = await this.asinSearch(title.toUpperCase(), region, timeout)
      if (item) items.push(item)
    }

    if (!items.length) {
      const queryObj = {
        title: title,
        region: region,
        limit: '10'
      }
      if (author) queryObj.author = author
      const queryString = new URLSearchParams(queryObj).toString()

      const url = `https://audimeta.de/search?${queryString}`
      Logger.debug(`[AudiMeta] Search url: ${url}`)
      items = await axios
        .get(url, {
          timeout
        }).then((res) => {
          return res.data
        })
        .catch((error) => {
          Logger.error('[AudiMeta] query search error', error)
          return []
        })
    }
    return items.filter(Boolean).map((item) => this.cleanResult(item)) || []
  }
}

module.exports = AudiMeta
