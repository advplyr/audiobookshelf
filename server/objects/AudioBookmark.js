class AudioBookmark {
  constructor(bookmark) {
    this.title = null
    this.time = null
    this.createdAt = null

    if (bookmark) {
      this.construct(bookmark)
    }
  }

  toJSON() {
    return {
      title: this.title || '',
      time: this.time,
      createdAt: this.createdAt
    }
  }

  construct(bookmark) {
    this.title = bookmark.title || ''
    this.time = bookmark.time || 0
    this.createdAt = bookmark.createdAt
  }

  setData(time, title) {
    this.title = title
    this.time = time
    this.createdAt = Date.now()
  }
}
module.exports = AudioBookmark