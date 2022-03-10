const BookMetadata = require('../metadata/BookMetadata')
const AudioFile = require('../files/AudioFile')
const EBookFile = require('../files/EBookFile')

class Book {
  constructor(book) {
    this.metadata = null

    this.coverPath = null
    this.relCoverPath = null
    this.tags = []
    this.audioFiles = []
    this.ebookFiles = []
    this.chapters = []

    if (book) {
      this.construct(book)
    }
  }

  construct(book) {
    this.metadata = new BookMetadata(book.metadata)
    this.coverPath = book.coverPath
    this.relCoverPath = book.relCoverPath
    this.tags = [...book.tags]
    this.audioFiles = book.audioFiles.map(f => new AudioFile(f))
    this.ebookFiles = book.ebookFiles.map(f => new EBookFile(f))
    this.chapters = book.chapters.map(c => ({ ...c }))
  }

  toJSON() {
    return {
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      relCoverPath: this.relCoverPath,
      tags: [...this.tags],
      audioFiles: this.audioFiles.map(f => f.toJSON()),
      ebookFiles: this.ebookFiles.map(f => f.toJSON()),
      chapters: this.chapters.map(c => ({ ...c }))
    }
  }
}
module.exports = Book