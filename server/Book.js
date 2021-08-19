class Book {
  constructor(book = null) {
    this.olid = null
    this.title = null
    this.author = null
    this.series = null
    this.publishYear = null
    this.publisher = null
    this.description = null
    this.cover = null
    this.genre = []

    if (book) {
      this.construct(book)
    }
  }

  construct(book) {
    this.olid = book.olid
    this.title = book.title
    this.author = book.author
    this.series = book.series
    this.publishYear = book.publish_year
    this.publisher = book.publisher
    this.description = book.description
    this.cover = book.cover
    this.genre = book.genre
  }

  toJSON() {
    return {
      olid: this.olid,
      title: this.title,
      author: this.author,
      series: this.series,
      publishYear: this.publish_year,
      publisher: this.publisher,
      description: this.description,
      cover: this.cover,
      genre: this.genre
    }
  }

  setData(data) {
    this.olid = data.olid || null
    this.title = data.title || null
    this.author = data.author || null
    this.series = data.series || null
    this.publishYear = data.publish_year || null
    this.description = data.description || null
    this.cover = data.cover || null
    this.genre = data.genre || []
  }

  update(payload) {
    var hasUpdates = false
    for (const key in payload) {
      if (payload[key] === undefined) continue;

      if (key === 'genre') {
        if (payload['genre'] === null && this.genre !== null) {
          this.genre = []
          hasUpdates = true
        } else if (payload['genre'].join(',') !== this.genre.join(',')) {
          this.genre = payload['genre']
          hasUpdates = true
        }
      } else if (this[key] !== undefined && payload[key] !== this[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    }
    return true
  }
}
module.exports = Book