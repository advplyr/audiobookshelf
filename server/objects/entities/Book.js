const Logger = require('../../Logger')
const BookMetadata = require('../metadata/BookMetadata')
const AudioFile = require('../files/AudioFile')
const EBookFile = require('../files/EBookFile')
const { areEquivalent, copyValue } = require('../../utils/index')

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

  update(payload) {
    var json = this.toJSON()
    var hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined) {
        if (key === 'metadata') {
          if (this.metadata.update(payload.metadata)) {
            hasUpdates = true
          }
        } else if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          Logger.debug('[Book] Key updated', key, this[key])
          hasUpdates = true
        }
      }
    }
    return hasUpdates
  }
}
module.exports = Book