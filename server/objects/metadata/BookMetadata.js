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

    if (metadata) {
      this.construct(metadata)
    }
  }

  construct(metadata) {
    this.title = metadata.title
    this.subtitle = metadata.subtitle
    this.authors = metadata.authors.map(a => ({ ...a }))
    this.narrators = [...metadata.narrators]
    this.series = metadata.series.map(s => ({ ...s }))
    this.genres = [...metadata.genres]
    this.publishedYear = metadata.publishedYear
    this.publishedDate = metadata.publishedDate
    this.publisher = metadata.publisher
    this.description = metadata.description
    this.isbn = metadata.isbn
    this.asin = metadata.asin
    this.language = metadata.language
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
      language: this.language
    }
  }
}
module.exports = BookMetadata