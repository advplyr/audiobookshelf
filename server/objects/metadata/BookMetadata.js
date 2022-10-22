const Logger = require('../../Logger')
const { areEquivalent, copyValue, cleanStringForSearch, getTitleIgnorePrefix } = require('../../utils/index')
const parseNameString = require('../../utils/parsers/parseNameString')
class BookMetadata {
  constructor(metadata) {
    this.title = null
    this.subtitle = null
    this.authors = []
    this.narrators = []  // Array of strings
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

    if (metadata) {
      this.construct(metadata)
    }
  }

  construct(metadata) {
    this.title = metadata.title
    this.subtitle = metadata.subtitle
    this.authors = (metadata.authors && metadata.authors.map) ? metadata.authors.map(a => ({ ...a })) : []
    this.narrators = metadata.narrators ? [...metadata.narrators] : []
    this.series = (metadata.series && metadata.series.map) ? metadata.series.map(s => ({ ...s })) : []
    this.genres = metadata.genres ? [...metadata.genres] : []
    this.publishedYear = metadata.publishedYear || null
    this.publishedDate = metadata.publishedDate || null
    this.publisher = metadata.publisher
    this.description = metadata.description
    this.isbn = metadata.isbn
    this.asin = metadata.asin
    this.language = metadata.language
    this.explicit = !!metadata.explicit
  }

  toJSON() {
    return {
      title: this.title,
      subtitle: this.subtitle,
      authors: this.authors.map(a => ({ ...a })), // Author JSONMinimal with name and id
      narrators: [...this.narrators],
      series: this.series.map(s => ({ ...s })), // Series JSONMinimal with name, id and sequence
      genres: [...this.genres],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: this.explicit
    }
  }

  toJSONMinified() {
    return {
      title: this.title,
      titleIgnorePrefix: this.titleIgnorePrefix,
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
      explicit: this.explicit
    }
  }

  toJSONExpanded() {
    return {
      title: this.title,
      titleIgnorePrefix: this.titleIgnorePrefix,
      subtitle: this.subtitle,
      authors: this.authors.map(a => ({ ...a })), // Author JSONMinimal with name and id
      narrators: [...this.narrators],
      series: this.series.map(s => ({ ...s })),
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
      seriesName: this.seriesName
    }
  }

  clone() {
    return new BookMetadata(this.toJSON())
  }

  get titleIgnorePrefix() {
    return getTitleIgnorePrefix(this.title)
  }
  get authorName() {
    if (!this.authors.length) return ''
    return this.authors.map(au => au.name).join(', ')
  }
  get authorNameLF() { // Last, First
    if (!this.authors.length) return ''
    return this.authors.map(au => parseNameString.nameToLastFirst(au.name)).join(', ')
  }
  get seriesName() {
    if (!this.series.length) return ''
    return this.series.map(se => {
      if (!se.sequence) return se.name
      return `${se.name} #${se.sequence}`
    }).join(', ')
  }
  get seriesNameIgnorePrefix() {
    if (!this.series.length) return ''
    return this.series.map(se => {
      if (!se.sequence) return getTitleIgnorePrefix(se.name)
      return `${getTitleIgnorePrefix(se.name)} #${se.sequence}`
    }).join(', ')
  }
  get firstSeriesName() {
    if (!this.series.length) return ''
    return this.series[0].name
  }
  get firstSeriesSequence() {
    if (!this.series.length) return ''
    return this.series[0].sequence
  }
  get narratorName() {
    return this.narrators.join(', ')
  }
  get coverSearchQuery() {
    if (!this.authorName) return this.title
    return this.title + '&' + this.authorName
  }

  hasAuthor(id) {
    return !!this.authors.find(au => au.id == id)
  }
  hasSeries(seriesId) {
    return !!this.series.find(se => se.id == seriesId)
  }
  hasNarrator(narratorName) {
    return this.narrators.includes(narratorName)
  }
  getSeries(seriesId) {
    return this.series.find(se => se.id == seriesId)
  }
  getFirstSeries() {
    return this.series.length ? this.series[0] : null
  }
  getSeriesSequence(seriesId) {
    var series = this.series.find(se => se.id == seriesId)
    if (!series) return null
    return series.sequence || ''
  }
  getSeriesSortTitle(series) {
    if (!series) return ''
    if (!series.sequence) return series.name
    return `${series.name} #${series.sequence}`
  }

  update(payload) {
    var json = this.toJSON()
    var hasUpdates = false
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

  // Updates author name
  updateAuthor(updatedAuthor) {
    var author = this.authors.find(au => au.id === updatedAuthor.id)
    if (!author || author.name == updatedAuthor.name) return false
    author.name = updatedAuthor.name
    return true
  }

  replaceAuthor(oldAuthor, newAuthor) {
    this.authors = this.authors.filter(au => au.id !== oldAuthor.id) // Remove old author
    this.authors.push({
      id: newAuthor.id,
      name: newAuthor.name
    })
  }

  setData(scanMediaData = {}) {
    this.title = scanMediaData.title || null
    this.subtitle = scanMediaData.subtitle || null
    this.narrators = this.parseNarratorsTag(scanMediaData.narrators)
    this.publishedYear = scanMediaData.publishedYear || null
    this.description = scanMediaData.description || null
    this.isbn = scanMediaData.isbn || null
    this.asin = scanMediaData.asin || null
    this.language = scanMediaData.language || null
    this.genres = []
    this.explicit = !!scanMediaData.explicit

    if (scanMediaData.author) {
      this.authors = this.parseAuthorsTag(scanMediaData.author)
    }
    if (scanMediaData.series) {
      this.series = this.parseSeriesTag(scanMediaData.series, scanMediaData.sequence)
    }
  }

  setDataFromAudioMetaTags(audioFileMetaTags, overrideExistingDetails = false) {
    const MetadataMapArray = [
      {
        tag: 'tagComposer',
        key: 'narrators'
      },
      {
        tag: 'tagDescription',
        altTag: 'tagComment',
        key: 'description'
      },
      {
        tag: 'tagPublisher',
        key: 'publisher'
      },
      {
        tag: 'tagDate',
        key: 'publishedYear'
      },
      {
        tag: 'tagSubtitle',
        key: 'subtitle'
      },
      {
        tag: 'tagAlbum',
        altTag: 'tagTitle',
        key: 'title',
      },
      {
        tag: 'tagArtist',
        altTag: 'tagAlbumArtist',
        key: 'authors'
      },
      {
        tag: 'tagGenre',
        key: 'genres'
      },
      {
        tag: 'tagSeries',
        key: 'series'
      },
      {
        tag: 'tagIsbn',
        key: 'isbn'
      },
      {
        tag: 'tagLanguage',
        key: 'language'
      },
      {
        tag: 'tagASIN',
        key: 'asin'
      },
      {
        tag: 'tagOverdriveMediaMarker',
        key: 'overdriveMediaMarker'
      }
    ]

    var updatePayload = {}

    // Metadata is only mapped to the book if it is empty
    MetadataMapArray.forEach((mapping) => {
      var value = audioFileMetaTags[mapping.tag]
      var tagToUse = mapping.tag
      if (!value && mapping.altTag) {
        value = audioFileMetaTags[mapping.altTag]
        tagToUse = mapping.altTag
      }
      if (value) {
        if (mapping.key === 'narrators' && (!this.narrators.length || overrideExistingDetails)) {
          updatePayload.narrators = this.parseNarratorsTag(value)
        } else if (mapping.key === 'authors' && (!this.authors.length || overrideExistingDetails)) {
          updatePayload.authors = this.parseAuthorsTag(value)
        } else if (mapping.key === 'genres' && (!this.genres.length || overrideExistingDetails)) {
          updatePayload.genres = this.parseGenresTag(value)
        } else if (mapping.key === 'series' && (!this.series.length || overrideExistingDetails)) {
          var sequenceTag = audioFileMetaTags.tagSeriesPart || null
          updatePayload.series = this.parseSeriesTag(value, sequenceTag)
        } else if (!this[mapping.key] || overrideExistingDetails) {
          updatePayload[mapping.key] = value
          // Logger.debug(`[Book] Mapping metadata to key ${tagToUse} => ${mapping.key}: ${updatePayload[mapping.key]}`)
        }
      }
    })

    if (Object.keys(updatePayload).length) {
      return this.update(updatePayload)
    }
    return false
  }

  // Returns array of names in First Last format
  parseNarratorsTag(narratorsTag) {
    var parsed = parseNameString.parse(narratorsTag)
    return parsed ? parsed.names : []
  }

  // Return array of authors minified with placeholder id
  parseAuthorsTag(authorsTag) {
    var parsed = parseNameString.parse(authorsTag)
    if (!parsed) return []
    return (parsed.names || []).map((au) => {
      return {
        id: `new-${Math.floor(Math.random() * 1000000)}`,
        name: au
      }
    })
  }

  parseGenresTag(genreTag) {
    if (!genreTag || !genreTag.length) return []
    var separators = ['/', '//', ';']
    for (let i = 0; i < separators.length; i++) {
      if (genreTag.includes(separators[i])) {
        return genreTag.split(separators[i]).map(genre => genre.trim()).filter(g => !!g)
      }
    }
    return [genreTag]
  }

  // Return array with series with placeholder id
  parseSeriesTag(seriesTag, sequenceTag) {
    if (!seriesTag) return []
    return [{
      id: `new-${Math.floor(Math.random() * 1000000)}`,
      name: seriesTag,
      sequence: sequenceTag || ''
    }]
  }

  searchSeries(query) {
    return this.series.filter(se => cleanStringForSearch(se.name).includes(query))
  }
  searchAuthors(query) {
    return this.authors.filter(au => cleanStringForSearch(au.name).includes(query))
  }
  searchQuery(query) { // Returns key if match is found
    var keysToCheck = ['title', 'asin', 'isbn']
    for (var key of keysToCheck) {
      if (this[key] && cleanStringForSearch(String(this[key])).includes(query)) {
        return {
          matchKey: key,
          matchText: this[key]
        }
      }
    }
    return null
  }
}
module.exports = BookMetadata
