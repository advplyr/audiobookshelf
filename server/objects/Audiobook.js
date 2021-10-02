const Path = require('path')
const { bytesPretty, elapsedPretty, readTextFile } = require('../utils/fileUtils')
const { comparePaths, getIno } = require('../utils/index')
const { extractCoverArt } = require('../utils/ffmpegHelpers')
const nfoGenerator = require('../utils/nfoGenerator')
const Logger = require('../Logger')
const Book = require('./Book')
const AudioTrack = require('./AudioTrack')
const AudioFile = require('./AudioFile')
const AudiobookFile = require('./AudiobookFile')

class Audiobook {
  constructor(audiobook = null) {
    this.id = null
    this.ino = null // Inode

    this.path = null
    this.fullPath = null

    this.addedAt = null
    this.lastUpdate = null

    this.tracks = []
    this.missingParts = []

    this.audioFiles = []
    this.otherFiles = []

    this.tags = []
    this.book = null
    this.chapters = []

    // Audiobook was scanned and not found
    this.isMissing = false

    if (audiobook) {
      this.construct(audiobook)
    }
  }

  construct(audiobook) {
    this.id = audiobook.id
    this.ino = audiobook.ino || null

    this.path = audiobook.path
    this.fullPath = audiobook.fullPath
    this.addedAt = audiobook.addedAt
    this.lastUpdate = audiobook.lastUpdate || this.addedAt

    this.tracks = audiobook.tracks.map(track => new AudioTrack(track))
    this.missingParts = audiobook.missingParts

    this.audioFiles = audiobook.audioFiles.map(file => new AudioFile(file))
    this.otherFiles = audiobook.otherFiles.map(file => new AudiobookFile(file))

    this.tags = audiobook.tags
    if (audiobook.book) {
      this.book = new Book(audiobook.book)
    }
    if (audiobook.chapters) {
      this.chapters = audiobook.chapters.map(c => ({ ...c }))
    }

    this.isMissing = !!audiobook.isMissing
  }

  get title() {
    return this.book ? this.book.title : 'No Title'
  }

  get author() {
    return this.book ? this.book.author : 'Unknown'
  }

  get cover() {
    return this.book ? this.book.cover : ''
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

  get invalidParts() {
    return this._audioFiles.filter(af => af.invalid).map(af => ({ filename: af.filename, error: af.error || 'Unknown Error' }))
  }

  get _audioFiles() { return this.audioFiles || [] }
  get _otherFiles() { return this.otherFiles || [] }

  get ebooks() {
    return this.otherFiles.filter(file => file.filetype === 'ebook')
  }

  get hasEpub() {
    return this.otherFiles.find(file => file.ext === '.epub')
  }

  get hasMissingIno() {
    return !this.ino || this._audioFiles.find(abf => !abf.ino) || this._otherFiles.find(f => !f.ino) || (this.tracks || []).find(t => !t.ino)
  }

  get hasEmbeddedCoverArt() {
    return !!this._audioFiles.find(af => af.embeddedCoverArt)
  }

  get hasDescriptionTextFile() {
    return !!this._otherFiles.find(of => of.filename === 'desc.txt')
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
      ino: this.ino,
      title: this.title,
      author: this.author,
      cover: this.cover,
      path: this.path,
      fullPath: this.fullPath,
      addedAt: this.addedAt,
      lastUpdate: this.lastUpdate,
      missingParts: this.missingParts,
      tags: this.tags,
      book: this.bookToJSON(),
      tracks: this.tracksToJSON(),
      audioFiles: this._audioFiles.map(audioFile => audioFile.toJSON()),
      otherFiles: this._otherFiles.map(otherFile => otherFile.toJSON()),
      chapters: this.chapters || [],
      isMissing: !!this.isMissing
    }
  }

  toJSONMinified() {
    return {
      id: this.id,
      ino: this.ino,
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
      // numEbooks: this.ebooks.length,
      numEbooks: this.hasEpub ? 1 : 0,
      numTracks: this.tracks.length,
      chapters: this.chapters || [],
      isMissing: !!this.isMissing
    }
  }

  toJSONExpanded() {
    return {
      id: this.id,
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
      audioFiles: (this.audioFiles || []).map(audioFile => audioFile.toJSON()),
      otherFiles: (this.otherFiles || []).map(otherFile => otherFile.toJSON()),
      ebooks: (this.ebooks || []).map(ebook => ebook.toJSON()),
      tags: this.tags,
      book: this.bookToJSON(),
      tracks: this.tracksToJSON(),
      chapters: this.chapters || [],
      isMissing: !!this.isMissing
    }
  }

  // Originally files did not store the inode value
  // this function checks all files and sets the inode
  async checkUpdateInos() {
    var hasUpdates = false

    // Audiobook folder needs inode
    if (!this.ino) {
      this.ino = await getIno(this.fullPath)
      hasUpdates = true
    }

    // Check audio files have an inode
    for (let i = 0; i < this.audioFiles.length; i++) {
      var af = this.audioFiles[i]
      var at = this.tracks.find(t => t.ino === af.ino)
      if (!at) {
        at = this.tracks.find(t => comparePaths(t.path, af.path))
        if (!at && !af.exclude) {
          Logger.warn(`[Audiobook] No matching track for audio file "${af.filename}"`)
        }
      }
      if (!af.ino || af.ino === this.ino) {
        af.ino = await getIno(af.fullPath)
        if (!af.ino) {
          Logger.error('[Audiobook] checkUpdateInos: Failed to set ino for audio file', af.fullPath)
        } else {
          Logger.debug(`[Audiobook] Set INO For audio file ${af.path}`)
          if (at) at.ino = af.ino
        }
        hasUpdates = true
      } else if (at && at.ino !== af.ino) {
        at.ino = af.ino
        hasUpdates = true
      }
    }

    for (let i = 0; i < this.tracks.length; i++) {
      var at = this.tracks[i]
      if (!at.ino) {
        Logger.debug(`[Audiobook] Track ${at.filename} still does not have ino`)
        var atino = await getIno(at.fullPath)
        var af = this.audioFiles.find(_af => _af.ino === atino)
        if (!af) {
          Logger.debug(`[Audiobook] Track ${at.filename} no matching audio file with ino ${atino}`)
          af = this.audioFiles.find(_af => _af.filename === at.filename)
          if (!af) {
            Logger.debug(`[Audiobook] Track ${at.filename} no matching audio file with filename`)
          } else {
            Logger.debug(`[Audiobook] Track ${at.filename} found matching filename but mismatch ino ${atino}/${af.ino}`)
            // at.ino = af.ino
            // at.path = af.path
            // at.fullPath = af.fullPath
            // hasUpdates = true
          }
        } else {
          Logger.debug(`[Audiobook] Track ${at.filename} found audio file with matching ino ${at.path}/${af.path}`)
        }
      }
    }

    for (let i = 0; i < this.otherFiles.length; i++) {
      var file = this.otherFiles[i]
      if (!file.ino || file.ino === this.ino) {
        file.ino = await getIno(file.fullPath)
        if (!file.ino) {
          Logger.error('[Audiobook] checkUpdateInos: Failed to set ino for other file', file.fullPath)
        } else {
          Logger.debug(`[Audiobook] Set INO For other file ${file.path}`)
        }
        hasUpdates = true
      }
    }
    return hasUpdates
  }

  // Scans in v1.3.0 or lower will need to rescan audiofiles to pickup metadata and embedded cover
  checkNeedsAudioFileRescan() {
    return !!(this.audioFiles || []).find(af => af.isOldAudioFile || af.codec === null)
  }

  setData(data) {
    this.id = (Math.trunc(Math.random() * 1000) + Date.now()).toString(36)
    this.ino = data.ino || null

    this.path = data.path
    this.fullPath = data.fullPath
    this.addedAt = Date.now()
    this.lastUpdate = this.addedAt

    if (data.otherFiles) {
      data.otherFiles.forEach((file) => {
        this.addOtherFile(file)
      })
    }

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

  addAudioFile(audioFileData) {
    var audioFile = new AudioFile()
    audioFile.setData(audioFileData)
    this.audioFiles.push(audioFile)
    return audioFile
  }

  addOtherFile(fileData) {
    var file = new AudiobookFile()
    file.setData(fileData)
    this.otherFiles.push(file)
    return file
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

  // Cover Url may be the same, this ensures the lastUpdate is updated
  updateBookCover(cover) {
    if (!this.book) return false
    return this.book.updateCover(cover)
  }

  updateAudioTracks(orderedFileData) {
    var index = 1
    this.audioFiles = orderedFileData.map((fileData) => {
      var audioFile = this.audioFiles.find(af => af.ino === fileData.ino)
      audioFile.manuallyVerified = true
      audioFile.invalid = false
      audioFile.error = null
      if (fileData.exclude !== undefined) {
        audioFile.exclude = !!fileData.exclude
      }
      if (audioFile.exclude) {
        audioFile.index = -1
      } else {
        audioFile.index = index++
      }
      return audioFile
    })

    this.audioFiles.sort((a, b) => a.index - b.index)

    this.tracks = []
    this.missingParts = []
    this.audioFiles.forEach((file) => {
      if (!file.exclude) {
        this.addTrack(file)
      }
    })
    this.lastUpdate = Date.now()
  }

  removeAudioFile(audioFile) {
    this.tracks = this.tracks.filter(t => t.ino !== audioFile.ino)
    this.audioFiles = this.audioFiles.filter(f => f.ino !== audioFile.ino)
  }

  removeAudioTrack(track) {
    this.tracks = this.tracks.filter(t => t.ino !== track.ino)
    this.audioFiles = this.audioFiles.filter(f => f.ino !== track.ino)
  }

  checkUpdateMissingParts() {
    var currMissingParts = (this.missingParts || []).join(',') || ''

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

    var newMissingParts = (this.missingParts || []).join(',') || ''
    var wasUpdated = newMissingParts !== currMissingParts
    if (wasUpdated && this.missingParts.length) {
      Logger.info(`[Audiobook] "${this.title}" has ${missingParts.length} missing parts`)
    }

    return wasUpdated
  }

  // On scan check other files found with other files saved
  async syncOtherFiles(newOtherFiles, forceRescan = false) {
    var hasUpdates = false

    var currOtherFileNum = this.otherFiles.length

    var alreadyHadDescTxt = this.otherFiles.find(of => of.filename === 'desc.txt')

    var newOtherFilePaths = newOtherFiles.map(f => f.path)
    this.otherFiles = this.otherFiles.filter(f => newOtherFilePaths.includes(f.path))

    // Some files are not there anymore and filtered out
    if (currOtherFileNum !== this.otherFiles.length) {
      Logger.debug(`[Audiobook] ${currOtherFileNum - this.otherFiles.length} other files were removed for "${this.title}"`)
      hasUpdates = true
    }

    // If desc.txt is new or forcing rescan then read it and update description if empty
    var descriptionTxt = newOtherFiles.find(file => file.filename === 'desc.txt')
    if (descriptionTxt && (!alreadyHadDescTxt || forceRescan)) {
      var newDescription = await readTextFile(descriptionTxt.fullPath)
      if (newDescription) {
        Logger.debug(`[Audiobook] Sync Other File desc.txt: ${newDescription}`)
        this.update({ book: { description: newDescription } })
        hasUpdates = true
      }
    }

    // TODO: Should use inode
    newOtherFiles.forEach((file) => {
      var existingOtherFile = this.otherFiles.find(f => f.path === file.path)
      if (!existingOtherFile) {
        Logger.debug(`[Audiobook] New other file found on sync ${file.filename} | "${this.title}"`)
        this.addOtherFile(file)
        hasUpdates = true
      }
    })

    // Check if cover was a local image and that it still exists
    var imageFiles = this.otherFiles.filter(f => f.filetype === 'image')
    if (this.book.cover && this.book.cover.substr(1).startsWith('local')) {
      var coverStillExists = imageFiles.find(f => comparePaths(f.path, this.book.cover.substr('/local/'.length)))
      if (!coverStillExists) {
        Logger.info(`[Audiobook] Local cover was removed | "${this.title}"`)
        this.book.cover = null
        hasUpdates = true
      }
    }

    // If no cover set and image file exists then use it
    if (!this.book.cover && imageFiles.length) {
      this.book.cover = Path.join('/local', imageFiles[0].path)
      Logger.info(`[Audiobook] Local cover was set | "${this.title}"`)
      hasUpdates = true
    }
    return hasUpdates
  }

  syncAudioFile(audioFile, fileScanData) {
    var hasUpdates = audioFile.syncFile(fileScanData)
    var track = this.tracks.find(t => t.ino === audioFile.ino)
    if (track && track.syncFile(fileScanData)) {
      hasUpdates = true
    }
    return hasUpdates
  }

  syncPaths(audiobookData) {
    var hasUpdates = false
    var keysToSync = ['path', 'fullPath']
    keysToSync.forEach((key) => {
      if (audiobookData[key] !== undefined && audiobookData[key] !== this[key]) {
        hasUpdates = true
        this[key] = audiobookData[key]
      }
    })
    if (hasUpdates) {
      this.book.syncPathsUpdated(audiobookData)
    }
    return hasUpdates
  }

  isSearchMatch(search) {
    return this.book.isSearchMatch(search.toLowerCase().trim())
  }

  getAudioFileByIno(ino) {
    return this.audioFiles.find(af => af.ino === ino)
  }

  getAudioFileByPath(fullPath) {
    return this.audioFiles.find(af => af.fullPath === fullPath)
  }

  setChapters() {
    // If 1 audio file without chapters, then no chapters will be set
    var includedAudioFiles = this.audioFiles.filter(af => !af.exclude)
    if (includedAudioFiles.length === 1) {
      // 1 audio file with chapters
      if (includedAudioFiles[0].chapters) {
        this.chapters = includedAudioFiles[0].chapters.map(c => ({ ...c }))
      }
    } else {
      this.chapters = []
      var currChapterId = 0
      var currStartTime = 0
      includedAudioFiles.forEach((file) => {
        // If audio file has chapters use chapters
        if (file.chapters && file.chapters.length) {
          file.chapters.forEach((chapter) => {
            var chapterDuration = chapter.end - chapter.start
            if (chapterDuration > 0) {
              var title = `Chapter ${currChapterId}`
              if (chapter.title) {
                title += ` (${chapter.title})`
              }
              this.chapters.push({
                id: currChapterId++,
                start: currStartTime,
                end: currStartTime + chapterDuration,
                title
              })
              currStartTime += chapterDuration
            }
          })
        } else if (file.duration) {
          // Otherwise just use track has chapter
          this.chapters.push({
            id: currChapterId++,
            start: currStartTime,
            end: currStartTime + file.duration,
            title: file.filename ? Path.basename(file.filename, Path.extname(file.filename)) : `Chapter ${currChapterId}`
          })
          currStartTime += file.duration
        }
      })
    }
  }

  writeNfoFile(nfoFilename = 'metadata.nfo') {
    return nfoGenerator(this, nfoFilename)
  }

  // Return cover filename
  async saveEmbeddedCoverArt(coverDirFullPath, coverDirRelPath) {
    var audioFileWithCover = this.audioFiles.find(af => af.embeddedCoverArt)
    if (!audioFileWithCover) return false

    var coverFilename = audioFileWithCover.embeddedCoverArt === 'png' ? 'cover.png' : 'cover.jpg'
    var coverFilePath = Path.join(coverDirFullPath, coverFilename)

    var success = await extractCoverArt(audioFileWithCover.fullPath, coverFilePath)
    if (success) {
      var coverRelPath = Path.join(coverDirRelPath, coverFilename)
      this.update({ book: { cover: coverRelPath } })
      return coverRelPath
    }
    return false
  }

  // If desc.txt exists then use it as description
  async saveDescriptionFromTextFile() {
    var descriptionTextFile = this.otherFiles.find(file => file.filename === 'desc.txt')
    if (!descriptionTextFile) return false
    var newDescription = await readTextFile(descriptionTextFile.fullPath)
    if (!newDescription) return false
    return this.update({ book: { description: newDescription } })
  }

  // Audio file metadata tags map to EMPTY book details
  setDetailsFromFileMetadata() {
    if (!this.audioFiles.length) return false
    var audioFile = this.audioFiles[0]
    return this.book.setDetailsFromFileMetadata(audioFile.metadata)
  }
}
module.exports = Audiobook