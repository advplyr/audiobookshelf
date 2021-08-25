const Path = require('path')
const { bytesPretty, elapsedPretty } = require('./utils/fileUtils')
const { comparePaths } = require('./utils/index')
const Logger = require('./Logger')
const Book = require('./Book')
const AudioTrack = require('./AudioTrack')

class Audiobook {
  constructor(audiobook = null) {
    this.id = null
    this.path = null
    this.fullPath = null
    this.addedAt = null
    this.lastUpdate = null

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
    this.lastUpdate = audiobook.lastUpdate || this.addedAt

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

  get authorLF() {
    return this.book ? this.book.authorLF : null
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
      lastUpdate: this.lastUpdate,
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
      lastUpdate: this.lastUpdate,
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
      // title: this.title,
      // author: this.author,
      // cover: this.cover,
      path: this.path,
      fullPath: this.fullPath,
      addedAt: this.addedAt,
      lastUpdate: this.lastUpdate,
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

  // Scanner had a bug that was saving a file path as the audiobook path.
  // audiobook path should be a directory.
  // fixing this before a scan prevents audiobooks being removed and re-added
  fixRelativePath(abRootPath) {
    var pathExt = Path.extname(this.path)
    if (pathExt) {
      this.path = Path.dirname(this.path)
      this.fullPath = Path.join(abRootPath, this.path)
      Logger.warn('Audiobook path has extname', pathExt, 'fixed path:', this.path)
      return true
    }
    return false
  }

  setData(data) {
    this.id = (Math.trunc(Math.random() * 1000) + Date.now()).toString(36)
    this.path = data.path
    this.fullPath = data.fullPath
    this.addedAt = Date.now()
    this.lastUpdate = this.addedAt

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

    if (hasUpdates) {
      this.lastUpdate = Date.now()
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
    this.lastUpdate = Date.now()
  }

  removeAudioFile(audioFile) {
    this.tracks = this.tracks.filter(t => t.path !== audioFile.path)
    this.audioFiles = this.audioFiles.filter(f => f.path !== audioFile.path)
  }

  audioPartExists(part) {
    var path = Path.join(this.path, part)
    return this.audioFiles.find(file => file.path === path)
  }

  checkUpdateMissingParts() {
    var currMissingParts = this.missingParts.join(',')

    var current_index = 1
    var missingParts = []
    for (let i = 0; i < this.tracks.length; i++) {
      var _track = this.tracks[i]
      if (_track.index > current_index) {
        var num_parts_missing = _track.index - current_index
        for (let x = 0; x < num_parts_missing; x++) {
          missingParts.push(current_index + x)
        }
      }
      current_index = _track.index + 1
    }

    this.missingParts = missingParts

    var wasUpdated = this.missingParts.join(',') !== currMissingParts
    if (wasUpdated && this.missingParts.length) {
      Logger.info(`[Audiobook] "${this.title}" has ${missingParts.length} missing parts`)
    }

    return wasUpdated
  }

  // On scan check other files found with other files saved
  syncOtherFiles(newOtherFiles) {
    var currOtherFileNum = this.otherFiles.length

    var newOtherFilePaths = newOtherFiles.map(f => f.path)
    this.otherFiles = this.otherFiles.filter(f => newOtherFilePaths.includes(f.path))
    newOtherFiles.forEach((file) => {
      var existingOtherFile = this.otherFiles.find(f => f.path === file.path)
      if (!existingOtherFile) {
        Logger.info(`[Audiobook] New other file found on sync ${file.filename}/${file.filetype} | "${this.title}"`)
        this.otherFiles.push(file)
      }
    })

    var hasUpdates = currOtherFileNum !== this.otherFiles.length

    var imageFiles = this.otherFiles.filter(f => f.filetype === 'image')
    if (this.book.cover && this.book.cover.substr(1).startsWith('local')) {
      var coverStillExists = imageFiles.find(f => comparePaths(f.path, this.book.cover.substr('/local/'.length)))
      if (!coverStillExists) {
        Logger.info(`[Audiobook] Local cover was removed | "${this.title}"`)
        this.book.cover = null
        hasUpdates = true
      }
    }

    if (!this.book.cover && imageFiles.length) {
      this.book.cover = Path.join('/local', imageFiles[0].path)
      Logger.info(`[Audiobook] Local cover was set | "${this.title}"`)
      hasUpdates = true
    }
    return hasUpdates
  }

  syncAuthorNames(audiobookData) {
    return this.book.syncAuthorNames(audiobookData.authorFL, audiobookData.authorLF)
  }

  isSearchMatch(search) {
    return this.book.isSearchMatch(search.toLowerCase().trim())
  }
}
module.exports = Audiobook