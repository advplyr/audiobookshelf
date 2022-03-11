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
    this.explicit = metadata.explicit
  }

  toJSON() {
    return {
      title: this.title,
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
      explicit: this.explicit
    }
  }

  toJSONExpanded() {
    return {
      title: this.title,
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
      narratorName: this.narratorName
    }
  }

  get titleIgnorePrefix() {
    if (!this.title) return ''
    if (this.title.toLowerCase().startsWith('the ')) {
      return this.title.substr(4) + ', The'
    }
    return this.title
  }
  get authorName() {
    return this.authors.map(au => au.name).join(', ')
  }
  get narratorName() {
    return this.narrators.join(', ')
  }

  hasAuthor(authorName) {
    return !!this.authors.find(au => au.name == authorName)
  }
  hasSeries(seriesName) {
    return !!this.series.find(se => se.name == seriesName)
  }
  hasNarrator(narratorName) {
    return this.narrators.includes(narratorName)
  }
}
module.exports = BookMetadata