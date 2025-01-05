const Logger = require('../../Logger')
const BookMetadata = require('../metadata/BookMetadata')
const { areEquivalent, copyValue } = require('../../utils/index')
const { filePathToPOSIX } = require('../../utils/fileUtils')
const AudioFile = require('../files/AudioFile')
const AudioTrack = require('../files/AudioTrack')
const EBookFile = require('../files/EBookFile')

class Book {
  constructor(book) {
    this.id = null
    this.libraryItemId = null
    this.metadata = null

    this.coverPath = null
    this.tags = []

    this.audioFiles = []
    this.chapters = []
    this.ebookFile = null

    this.lastCoverSearch = null
    this.lastCoverSearchQuery = null

    if (book) {
      this.construct(book)
    }
  }

  construct(book) {
    this.id = book.id
    this.libraryItemId = book.libraryItemId
    this.metadata = new BookMetadata(book.metadata)
    this.coverPath = book.coverPath
    this.tags = [...book.tags]
    this.audioFiles = book.audioFiles.map((f) => new AudioFile(f))
    this.chapters = book.chapters.map((c) => ({ ...c }))
    this.ebookFile = book.ebookFile ? new EBookFile(book.ebookFile) : null
    this.lastCoverSearch = book.lastCoverSearch || null
    this.lastCoverSearchQuery = book.lastCoverSearchQuery || null
  }

  toJSON() {
    return {
      id: this.id,
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      audioFiles: this.audioFiles.map((f) => f.toJSON()),
      chapters: this.chapters.map((c) => ({ ...c })),
      ebookFile: this.ebookFile ? this.ebookFile.toJSON() : null
    }
  }

  toJSONMinified() {
    return {
      id: this.id,
      metadata: this.metadata.toJSONMinified(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      numTracks: this.tracks.length,
      numAudioFiles: this.audioFiles.length,
      numChapters: this.chapters.length,
      duration: this.duration,
      size: this.size,
      ebookFormat: this.ebookFile?.ebookFormat
    }
  }

  toJSONForMetadataFile() {
    return {
      tags: [...this.tags],
      chapters: this.chapters.map((c) => ({ ...c })),
      ...this.metadata.toJSONForMetadataFile()
    }
  }

  get size() {
    var total = 0
    this.audioFiles.forEach((af) => (total += af.metadata.size))
    if (this.ebookFile) {
      total += this.ebookFile.metadata.size
    }
    return total
  }
  get includedAudioFiles() {
    return this.audioFiles.filter((af) => !af.exclude)
  }
  get tracks() {
    let startOffset = 0
    return this.includedAudioFiles.map((af) => {
      const audioTrack = new AudioTrack()
      audioTrack.setData(this.libraryItemId, af, startOffset)
      startOffset += audioTrack.duration
      return audioTrack
    })
  }
  get duration() {
    let total = 0
    this.tracks.forEach((track) => (total += track.duration))
    return total
  }
  get numTracks() {
    return this.tracks.length
  }
  get isEBookOnly() {
    return this.ebookFile && !this.numTracks
  }

  update(payload) {
    const json = this.toJSON()

    let hasUpdates = false
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

  updateCover(coverPath) {
    coverPath = filePathToPOSIX(coverPath)
    if (this.coverPath === coverPath) return false
    this.coverPath = coverPath
    return true
  }
}
module.exports = Book
