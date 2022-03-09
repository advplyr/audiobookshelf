const BookMetadata = require('../metadata/BookMetadata')
const AudioFile = require('../files/AudioFile')
const EBookFile = require('../files/EBookFile')
const AudioTrack = require('../AudioTrack')

class Book {
  constructor(book) {
    this.metadata = null

    this.tags = []
    this.audioFiles = []
    this.ebookFiles = []
    this.audioTracks = []
    this.chapters = []

    if (books) {
      this.construct(book)
    }
  }

  construct(book) {
    this.metadata = new BookMetadata(book.metadata)
    this.tags = [...book.tags]
    this.audioFiles = book.audioFiles.map(f => new AudioFile(f))
    this.ebookFiles = book.ebookFiles.map(f => new EBookFile(f))
    this.audioTracks = book.audioTracks.map(a => new AudioTrack(a))
    this.chapters = book.chapters.map(c => ({ ...c }))
  }

  toJSON() {
    return {
      metadata: this.metadata.toJSON(),
      tags: [...this.tags],
      audioFiles: this.audioFiles.map(f => f.toJSON()),
      ebookFiles: this.ebookFiles.map(f => f.toJSON()),
      audioTracks: this.audioTracks.map(a => a.toJSON()),
      chapters: this.chapters.map(c => ({ ...c }))
    }
  }
}
module.exports = Book