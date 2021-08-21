const { bytesPretty, elapsedPretty } = require('./utils/fileUtils')
const Book = require('./Book')
const AudioTrack = require('./AudioTrack')

class Audiobook {
  constructor(audiobook = null) {
    this.id = null
    this.path = null
    this.fullPath = null
    this.addedAt = null

    this.tracks = []
    this.missingParts = []
    this.invalidParts = []

    this.audioFiles = []
    this.otherFiles = []

    this.tags = []
    this.book = null

    if (audiobook) {
      this.construct(audiobook)
    }
  }

  construct(audiobook) {
    this.id = audiobook.id
    this.path = audiobook.path
    this.fullPath = audiobook.fullPath
    this.addedAt = audiobook.addedAt

    this.tracks = audiobook.tracks.map(track => {
      return new AudioTrack(track)
    })
    this.missingParts = audiobook.missingParts
    this.invalidParts = audiobook.invalidParts

    this.audioFiles = audiobook.audioFiles
    this.otherFiles = audiobook.otherFiles

    this.tags = audiobook.tags
    if (audiobook.book) {
      this.book = new Book(audiobook.book)
    }
  }

  get title() {
    return this.book ? this.book.title : 'No Title'
  }

  get cover() {
    return this.book ? this.book.cover : ''
  }

  get author() {
    return this.book ? this.book.author : 'Unknown'
  }

  get genres() {
    return this.book ? this.book.genres || [] : []
  }

  get totalDuration() {
    var total = 0
    this.tracks.forEach((track) => total += track.duration)
    return total
  }

  get totalSize() {
    var total = 0
    this.tracks.forEach((track) => total += track.size)
    return total
  }

  get sizePretty() {
    return bytesPretty(this.totalSize)
  }

  get durationPretty() {
    return elapsedPretty(this.totalDuration)
  }

  bookToJSON() {
    return this.book ? this.book.toJSON() : null
  }

  tracksToJSON() {
    if (!this.tracks || !this.tracks.length) return []
    return this.tracks.map(t => t.toJSON())
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      author: this.author,
      cover: this.cover,
      path: this.path,
      fullPath: this.fullPath,
      addedAt: this.addedAt,
      missingParts: this.missingParts,
      invalidParts: this.invalidParts,
      tags: this.tags,
      book: this.bookToJSON(),
      tracks: this.tracksToJSON(),
      audioFiles: this.audioFiles,
      otherFiles: this.otherFiles
    }
  }

  toJSONMinified() {
    return {
      id: this.id,
      book: this.bookToJSON(),
      tags: this.tags,
      path: this.path,
      fullPath: this.fullPath,
      addedAt: this.addedAt,
      duration: this.totalDuration,
      size: this.totalSize,
      hasBookMatch: !!this.book,
      hasMissingParts: this.missingParts ? this.missingParts.length : 0,
      hasInvalidParts: this.invalidParts ? this.invalidParts.length : 0,
      numTracks: this.tracks.length
    }
  }

  toJSONExpanded() {
    return {
      id: this.id,
      title: this.title,
      author: this.author,
      cover: this.cover,
      path: this.path,
      fullPath: this.fullPath,
      addedAt: this.addedAt,
      duration: this.totalDuration,
      durationPretty: this.durationPretty,
      size: this.totalSize,
      sizePretty: this.sizePretty,
      missingParts: this.missingParts,
      invalidParts: this.invalidParts,
      audioFiles: this.audioFiles,
      otherFiles: this.otherFiles,
      tags: this.tags,
      book: this.bookToJSON(),
      tracks: this.tracksToJSON()
    }
  }

  setData(data) {
    this.id = (Math.trunc(Math.random() * 1000) + Date.now()).toString(36)
    this.path = data.path
    this.fullPath = data.fullPath
    this.addedAt = Date.now()

    this.otherFiles = data.otherFiles || []
    this.setBook(data)
  }

  setBook(data) {
    this.book = new Book()
    this.book.setData(data)
  }

  addTrack(trackData) {
    var track = new AudioTrack()
    track.setData(trackData)
    this.tracks.push(track)
    return track
  }

  update(payload) {
    var hasUpdates = false

    if (payload.tags && payload.tags.join(',') !== this.tags.join(',')) {
      this.tags = payload.tags
      hasUpdates = true
    }

    if (payload.book) {
      if (!this.book) {
        this.setBook(payload.book)
        hasUpdates = true
      } else if (this.book.update(payload.book)) {
        hasUpdates = true
      }
    }

    return hasUpdates
  }

  updateAudioTracks(files) {
    var index = 1
    this.audioFiles = files.map((file) => {
      file.manuallyVerified = true
      file.invalid = false
      file.error = null
      file.index = index++
      return file
    })
    this.tracks = []
    this.invalidParts = []
    this.missingParts = []
    this.audioFiles.forEach((file) => {
      this.addTrack(file)
    })
  }

  isSearchMatch(search) {
    return this.book.isSearchMatch(search.toLowerCase().trim())
  }
}
module.exports = Audiobook