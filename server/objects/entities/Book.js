const BookMetadata = require('../metadata/BookMetadata')
const AudioFile = require('../files/AudioFile')
const EBookFile = require('../files/EBookFile')

class Book {
  constructor(book) {
    this.metadata = null

    this.coverPath = null
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
    this.tags = [...book.tags]
    this.audioFiles = book.audioFiles.map(f => new AudioFile(f))
    this.ebookFiles = book.ebookFiles.map(f => new EBookFile(f))
    this.chapters = book.chapters.map(c => ({ ...c }))
  }

  toJSON() {
    return {
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      audioFiles: this.audioFiles.map(f => f.toJSON()),
      ebookFiles: this.ebookFiles.map(f => f.toJSON()),
      chapters: this.chapters.map(c => ({ ...c }))
    }
  }

  toJSONMinified() {
    return {
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      numTracks: this.tracks.length,
      numAudioFiles: this.audioFiles.length,
      numEbooks: this.ebookFiles.length,
      numChapters: this.chapters.length,
      duration: this.duration,
      size: this.size
    }
  }

  toJSONExpanded() {
    return {
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      audioFiles: this.audioFiles.map(f => f.toJSON()),
      ebookFiles: this.ebookFiles.map(f => f.toJSON()),
      chapters: this.chapters.map(c => ({ ...c })),
      duration: this.duration,
      size: this.size,
      tracks: this.tracks.map(t => t.toJSON())
    }
  }

  get tracks() {
    return this.audioFiles.filter(af => !af.exclude && !af.invalid)
  }
  get duration() {
    var total = 0
    this.tracks.forEach((track) => total += track.duration)
    return total
  }
  get size() {
    var total = 0
    this.audioFiles.forEach((af) => total += af.metadata.size)
    return total
  }
}
module.exports = Book