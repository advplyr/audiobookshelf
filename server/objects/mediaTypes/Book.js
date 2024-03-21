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
    this.audioFiles = book.audioFiles.map(f => new AudioFile(f))
    this.chapters = book.chapters.map(c => ({ ...c }))
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
      audioFiles: this.audioFiles.map(f => f.toJSON()),
      chapters: this.chapters.map(c => ({ ...c })),
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

  toJSONExpanded() {
    return {
      id: this.id,
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      audioFiles: this.audioFiles.map(f => f.toJSON()),
      chapters: this.chapters.map(c => ({ ...c })),
      duration: this.duration,
      size: this.size,
      tracks: this.tracks.map(t => t.toJSON()),
      ebookFile: this.ebookFile?.toJSON() || null
    }
  }

  toJSONForMetadataFile() {
    return {
      tags: [...this.tags],
      chapters: this.chapters.map(c => ({ ...c })),
      ...this.metadata.toJSONForMetadataFile()
    }
  }

  get size() {
    var total = 0
    this.audioFiles.forEach((af) => total += af.metadata.size)
    if (this.ebookFile) {
      total += this.ebookFile.metadata.size
    }
    return total
  }
  get hasMediaEntities() {
    return !!this.tracks.length || this.ebookFile
  }
  get includedAudioFiles() {
    return this.audioFiles.filter(af => !af.exclude)
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
    this.tracks.forEach((track) => total += track.duration)
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
    delete json.audiobooks // do not update media entities here
    delete json.ebooks

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

  updateChapters(chapters) {
    var hasUpdates = this.chapters.length !== chapters.length
    if (hasUpdates) {
      this.chapters = chapters.map(ch => ({
        id: ch.id,
        start: ch.start,
        end: ch.end,
        title: ch.title
      }))
    } else {
      for (let i = 0; i < this.chapters.length; i++) {
        const currChapter = this.chapters[i]
        const newChapter = chapters[i]
        if (!hasUpdates && (currChapter.title !== newChapter.title || currChapter.start !== newChapter.start || currChapter.end !== newChapter.end)) {
          hasUpdates = true
        }
        this.chapters[i].title = newChapter.title
        this.chapters[i].start = newChapter.start
        this.chapters[i].end = newChapter.end
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

  removeFileWithInode(inode) {
    if (this.audioFiles.some(af => af.ino === inode)) {
      this.audioFiles = this.audioFiles.filter(af => af.ino !== inode)
      return true
    }
    if (this.ebookFile && this.ebookFile.ino === inode) {
      this.ebookFile = null
      return true
    }
    return false
  }

  /**
   * Get audio file or ebook file from inode
   * @param {string} inode 
   * @returns {(AudioFile|EBookFile|null)}
   */
  findFileWithInode(inode) {
    const audioFile = this.audioFiles.find(af => af.ino === inode)
    if (audioFile) return audioFile
    if (this.ebookFile && this.ebookFile.ino === inode) return this.ebookFile
    return null
  }

  /**
   * Set the EBookFile from a LibraryFile
   * If null then ebookFile will be removed from the book
   * 
   * @param {LibraryFile} [libraryFile] 
   */
  setEbookFile(libraryFile = null) {
    if (!libraryFile) {
      this.ebookFile = null
    } else {
      const ebookFile = new EBookFile()
      ebookFile.setData(libraryFile)
      this.ebookFile = ebookFile
    }
  }

  addAudioFile(audioFile) {
    this.audioFiles.push(audioFile)
  }

  updateAudioTracks(orderedFileData) {
    let index = 1
    this.audioFiles = orderedFileData.map((fileData) => {
      const audioFile = this.audioFiles.find(af => af.ino === fileData.ino)
      audioFile.manuallyVerified = true
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

    this.rebuildTracks()
  }

  rebuildTracks() {
    Logger.debug(`[Book] Tracks being rebuilt...!`)
    this.audioFiles.sort((a, b) => a.index - b.index)
  }

  // Only checks container format
  checkCanDirectPlay(payload) {
    var supportedMimeTypes = payload.supportedMimeTypes || []
    return !this.tracks.some((t) => !supportedMimeTypes.includes(t.mimeType))
  }

  getDirectPlayTracklist() {
    return this.tracks
  }

  getPlaybackTitle() {
    return this.metadata.title
  }

  getPlaybackAuthor() {
    return this.metadata.authorName
  }

  getChapters() {
    return this.chapters?.map(ch => ({ ...ch })) || []
  }
}
module.exports = Book
