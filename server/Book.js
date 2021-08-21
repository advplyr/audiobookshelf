const Path = require('path')
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
    this.genres = []

    if (book) {
      this.construct(book)
    }
  }

  get _title() { return this.title || '' }
  get _author() { return this.author || '' }
  get _series() { return this.series || '' }

  construct(book) {
    this.olid = book.olid
    this.title = book.title
    this.author = book.author
    this.series = book.series
    this.publishYear = book.publishYear
    this.publisher = book.publisher
    this.description = book.description
    this.cover = book.cover
    this.genres = book.genres
  }

  toJSON() {
    return {
      olid: this.olid,
      title: this.title,
      author: this.author,
      series: this.series,
      publishYear: this.publishYear,
      publisher: this.publisher,
      description: this.description,
      cover: this.cover,
      genres: this.genres
    }
  }

  setData(data) {
    this.olid = data.olid || null
    this.title = data.title || null
    this.author = data.author || null
    this.series = data.series || null
    this.publishYear = data.publishYear || null
    this.description = data.description || null
    this.cover = data.cover || null
    this.genres = data.genres || []

    // Use first image file as cover
    if (data.otherFiles && data.otherFiles.length) {
      var imageFile = data.otherFiles.find(f => f.filetype === 'image')
      if (imageFile) {
        this.cover = Path.join('/local', imageFile.path)
      }
    }
  }

  update(payload) {
    var hasUpdates = false
    for (const key in payload) {
      if (payload[key] === undefined) continue;

      if (key === 'genres') {
        if (payload['genres'] === null && this.genres !== null) {
          this.genres = []
          hasUpdates = true
        } else if (payload['genres'].join(',') !== this.genres.join(',')) {
          this.genres = payload['genres']
          hasUpdates = true
        }
      } else if (this[key] !== undefined && payload[key] !== this[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    }
    return true
  }

  isSearchMatch(search) {
    return this._title.toLowerCase().includes(search) || this._author.toLowerCase().includes(search) || this._series.toLowerCase().includes(search)
  }
}
module.exports = Book