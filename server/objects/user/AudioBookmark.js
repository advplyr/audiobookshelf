class AudioBookmark {
  constructor(bookmark) {
    this.libraryItemId = null
    this.title = null
    this.time = null
    this.createdAt = null

    if (bookmark) {
      this.construct(bookmark)
    }
  }

  toJSON() {
    return {
      libraryItemId: this.libraryItemId,
      title: this.title || '',
      time: this.time,
      createdAt: this.createdAt
    }
  }

  construct(bookmark) {
    this.libraryItemId = bookmark.libraryItemId
    this.title = bookmark.title || ''
    this.time = bookmark.time || 0
    this.createdAt = bookmark.createdAt
  }

  setData(libraryItemId, time, title) {
    this.libraryItemId = libraryItemId
    this.title = title
    this.time = time
    this.createdAt = Date.now()
  }
}
module.exports = AudioBookmark