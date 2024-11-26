const Logger = require('../../Logger')
const { areEquivalent, copyValue, getTitleIgnorePrefix, getTitlePrefixAtEnd } = require('../../utils/index')
const parseNameString = require('../../utils/parsers/parseNameString')
class BookMetadata {
  constructor(metadata) {
    this.title = null
    this.subtitle = null
    this.authors = []
    this.narrators = [] // Array of strings
    this.series = []
    this.genres = [] // Array of strings
    this.publishedYear = null
    this.publishedDate = null
    this.publisher = null
    this.description = null
    this.isbn = null
    this.asin = null
    this.language = null
    this.explicit = false
    this.abridged = false

    if (metadata) {
      this.construct(metadata)
    }
  }

  construct(metadata) {
    this.title = metadata.title
    this.subtitle = metadata.subtitle
    this.authors = metadata.authors?.map ? metadata.authors.map((a) => ({ ...a })) : []
    this.narrators = metadata.narrators ? [...metadata.narrators].filter((n) => n) : []
    this.series = metadata.series?.map
      ? metadata.series.map((s) => ({
          ...s,
          name: s.name || 'No Title'
        }))
      : []
    this.genres = metadata.genres ? [...metadata.genres] : []
    this.publishedYear = metadata.publishedYear || null
    this.publishedDate = metadata.publishedDate || null
    this.publisher = metadata.publisher
    this.description = metadata.description
    this.isbn = metadata.isbn
    this.asin = metadata.asin
    this.language = metadata.language
    this.explicit = !!metadata.explicit
    this.abridged = !!metadata.abridged
  }

  toJSON() {
    return {
      title: this.title,
      subtitle: this.subtitle,
      authors: this.authors.map((a) => ({ ...a })), // Author JSONMinimal with name and id
      narrators: [...this.narrators],
      series: this.series.map((s) => ({ ...s })), // Series JSONMinimal with name, id and sequence
      genres: [...this.genres],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: this.explicit,
      abridged: this.abridged
    }
  }

  toJSONMinified() {
    return {
      title: this.title,
      titleIgnorePrefix: this.titlePrefixAtEnd,
      subtitle: this.subtitle,
      authorName: this.authorName,
      authorNameLF: this.authorNameLF,
      narratorName: this.narratorName,
      seriesName: this.seriesName,
      genres: [...this.genres],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: this.explicit,
      abridged: this.abridged
    }
  }

  toJSONExpanded() {
    return {
      title: this.title,
      titleIgnorePrefix: this.titlePrefixAtEnd,
      subtitle: this.subtitle,
      authors: this.authors.map((a) => ({ ...a })), // Author JSONMinimal with name and id
      narrators: [...this.narrators],
      series: this.series.map((s) => ({ ...s })),
      genres: [...this.genres],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: this.explicit,
      authorName: this.authorName,
      authorNameLF: this.authorNameLF,
      narratorName: this.narratorName,
      seriesName: this.seriesName,
      abridged: this.abridged
    }
  }

  toJSONForMetadataFile() {
    const json = this.toJSON()
    json.authors = json.authors.map((au) => au.name)
    json.series = json.series.map((se) => {
      if (!se.sequence) return se.name
      return `${se.name} #${se.sequence}`
    })
    return json
  }

  clone() {
    return new BookMetadata(this.toJSON())
  }

  get titleIgnorePrefix() {
    return getTitleIgnorePrefix(this.title)
  }
  get titlePrefixAtEnd() {
    return getTitlePrefixAtEnd(this.title)
  }
  get authorName() {
    if (!this.authors.length) return ''
    return this.authors.map((au) => au.name).join(', ')
  }
  get authorNameLF() {
    // Last, First
    if (!this.authors.length) return ''
    return this.authors.map((au) => parseNameString.nameToLastFirst(au.name)).join(', ')
  }
  get seriesName() {
    if (!this.series.length) return ''
    return this.series
      .map((se) => {
        if (!se.sequence) return se.name
        return `${se.name} #${se.sequence}`
      })
      .join(', ')
  }
  get narratorName() {
    return this.narrators.join(', ')
  }

  getSeries(seriesId) {
    return this.series.find((se) => se.id == seriesId)
  }
  getSeriesSequence(seriesId) {
    const series = this.series.find((se) => se.id == seriesId)
    if (!series) return null
    return series.sequence || ''
  }

  update(payload) {
    const json = this.toJSON()
    let hasUpdates = false

    for (const key in json) {
      if (payload[key] !== undefined) {
        if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          Logger.debug('[BookMetadata] Key updated', key, this[key])
          hasUpdates = true
        }
      }
    }
    return hasUpdates
  }
}
module.exports = BookMetadata
