const Logger = require('../../Logger')
const BookMetadata = require('../metadata/BookMetadata')
const AudioFile = require('../files/AudioFile')
const EBookFile = require('../files/EBookFile')
const abmetadataGenerator = require('../../utils/abmetadataGenerator')
const { areEquivalent, copyValue } = require('../../utils/index')
const { parseOpfMetadataXML } = require('../../utils/parseOpfMetadata')
const { readTextFile } = require('../../utils/fileUtils')

class Book {
  constructor(book) {
    this.metadata = null

    this.coverPath = null
    this.tags = []
    this.audioFiles = []
    this.ebookFiles = []
    this.chapters = []
    this.missingParts = []

    this.lastCoverSearch = null
    this.lastCoverSearchQuery = null

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
    this.missingParts = book.missingParts ? [...book.missingParts] : []
    this.lastCoverSearch = book.lastCoverSearch || null
    this.lastCoverSearchQuery = book.lastCoverSearchQuery || null
  }

  toJSON() {
    return {
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      audioFiles: this.audioFiles.map(f => f.toJSON()),
      ebookFiles: this.ebookFiles.map(f => f.toJSON()),
      chapters: this.chapters.map(c => ({ ...c })),
      missingParts: [...this.missingParts]
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
      numMissingParts: this.missingParts.length,
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
      tracks: this.tracks.map(t => t.toJSON()),
      missingParts: [...this.missingParts]
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
  get hasMediaFiles() {
    return !!(this.tracks.length + this.ebookFiles.length)
  }
  get shouldSearchForCover() {
    if (this.coverPath) return false
    if (!this.lastCoverSearch || this.metadata.coverSearchQuery !== this.lastCoverSearchQuery) return true
    return (Date.now() - this.lastCoverSearch) > 1000 * 60 * 60 * 24 * 7 // 7 day
  }
  get hasEmbeddedCoverArt() {
    return this.audioFiles.some(af => af.embeddedCoverArt)
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

  updateCover(coverPath) {
    coverPath = coverPath.replace(/\\/g, '/')
    if (this.coverPath === coverPath) return false
    this.coverPath = coverPath
    return true
  }

  checkUpdateMissingTracks() {
    var currMissingParts = (this.missingParts || []).join(',') || ''

    var current_index = 1
    var missingParts = []

    for (let i = 0; i < this.tracks.length; i++) {
      var _track = this.tracks[i]
      if (_track.index > current_index) {
        var num_parts_missing = _track.index - current_index
        for (let x = 0; x < num_parts_missing && x < 9999; x++) {
          missingParts.push(current_index + x)
        }
      }
      current_index = _track.index + 1
    }

    this.missingParts = missingParts

    var newMissingParts = (this.missingParts || []).join(',') || ''
    var wasUpdated = newMissingParts !== currMissingParts
    if (wasUpdated && this.missingParts.length) {
      Logger.info(`[Book] "${this.metadata.title}" has ${missingParts.length} missing parts`)
    }

    return wasUpdated
  }

  removeFileWithInode(inode) {
    if (this.audioFiles.some(af => af.ino === inode)) {
      this.audioFiles = this.audioFiles.filter(af => af.ino !== inode)
      return true
    }
    if (this.ebookFiles.some(ef => ef.ino === inode)) {
      this.ebookFiles = this.ebookFiles.filter(ef => ef.ino !== inode)
      return true
    }
    return false
  }

  findFileWithInode(inode) {
    var audioFile = this.audioFiles.find(af => af.ino == inode)
    if (audioFile) return audioFile
    var ebookFile = this.ebookFiles.find(ef => ef.inode == inode)
    if (ebookFile) return ebookFile
    return null
  }

  updateLastCoverSearch(coverWasFound) {
    this.lastCoverSearch = coverWasFound ? null : Date.now()
    this.lastCoverSearchQuery = coverWasFound ? null : this.metadata.coverSearchQuery
  }

  // Audio file metadata tags map to book details (will not overwrite)
  setMetadataFromAudioFile(overrideExistingDetails = false) {
    if (!this.audioFiles.length) return false
    var audioFile = this.audioFiles[0]
    if (!audioFile.metaTags) return false
    return this.metadata.setDataFromAudioMetaTags(audioFile.metaTags, overrideExistingDetails)
  }

  rebuildTracks() {
    this.audioFiles.sort((a, b) => a.index - b.index)
    this.missingParts = []
    this.setChapters()
    this.checkUpdateMissingTracks()
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
            title: file.metadata.filename ? Path.basename(file.metadata.filename, Path.extname(file.metadata.filename)) : `Chapter ${currChapterId}`
          })
          currStartTime += file.duration
        }
      })
    }
  }

  setData(scanMediaMetadata) {
    this.metadata = new BookMetadata()
    this.metadata.setData(scanMediaMetadata)
  }

  // Look for desc.txt, reader.txt, metadata.abs and opf file then update details if found
  async syncMetadataFiles(textMetadataFiles, opfMetadataOverrideDetails) {
    var metadataUpdatePayload = {}

    var descTxt = textMetadataFiles.find(lf => lf.metadata.filename === 'desc.txt')
    if (descTxt) {
      var descriptionText = await readTextFile(descTxt.metadata.path)
      if (descriptionText) {
        Logger.debug(`[Book] "${this.metadata.title}" found desc.txt updating description with "${descriptionText.slice(0, 20)}..."`)
        metadataUpdatePayload.description = descriptionText
      }
    }
    var readerTxt = textMetadataFiles.find(lf => lf.metadata.filename === 'reader.txt')
    if (readerTxt) {
      var narratorText = await readTextFile(readerTxt.metadata.path)
      if (narratorText) {
        Logger.debug(`[Book] "${this.metadata.title}" found reader.txt updating narrator with "${narratorText}"`)
        metadataUpdatePayload.narrators = this.metadata.parseNarratorsTag(narratorText)
      }
    }

    // TODO: Implement metadata.abs
    var metadataAbs = textMetadataFiles.find(lf => lf.metadata.filename === 'metadata.abs')
    if (metadataAbs) {

    }

    var metadataOpf = textMetadataFiles.find(lf => lf.isOPFFile || lf.metadata.filename === 'metadata.xml')
    if (metadataOpf) {
      var xmlText = await readTextFile(metadataOpf.metadata.path)
      if (xmlText) {
        var opfMetadata = await parseOpfMetadataXML(xmlText)
        if (opfMetadata) {
          for (const key in opfMetadata) {
            // Add genres only if genres are empty
            if (key === 'genres') {
              if (opfMetadata.genres.length && (!this.metadata.genres.length || opfMetadataOverrideDetails)) {
                metadataUpdatePayload[key] = opfMetadata.genres
              }
            } else if (key === 'author') {
              if (opfMetadata.author && (!this.metadata.authors.length || opfMetadataOverrideDetails)) {
                metadataUpdatePayload.authors = this.metadata.parseAuthorsTag(opfMetadata.author)
              }
            } else if (key === 'narrator') {
              if (opfMetadata.narrator && (!this.metadata.narrators.length || opfMetadataOverrideDetails)) {
                metadataUpdatePayload.narrators = this.metadata.parseNarratorsTag(opfMetadata.narrator)
              }
            } else if (key === 'series') {
              if (opfMetadata.series && (!this.metadata.series.length || opfMetadataOverrideDetails)) {
                metadataUpdatePayload.series = this.metadata.parseSeriesTag(opfMetadata.series, opfMetadata.sequence)
              }
            } else if (opfMetadata[key] && ((!this.metadata[key] && !metadataUpdatePayload[key]) || opfMetadataOverrideDetails)) {
              metadataUpdatePayload[key] = opfMetadata[key]
            }
          }
        }
      }
    }

    if (Object.keys(metadataUpdatePayload).length) {
      return this.metadata.update(metadataUpdatePayload)
    }
    return false
  }

  searchQuery(query) {
    var payload = {
      tags: this.tags.filter(t => t.toLowerCase().includes(query)),
      series: this.metadata.searchSeries(query),
      authors: this.metadata.searchAuthors(query),
      matchKey: null,
      matchText: null
    }
    var metadataMatch = this.metadata.searchQuery(query)
    if (metadataMatch) {
      payload.matchKey = metadataMatch.matchKey
      payload.matchText = metadataMatch.matchText
    } else {
      if (payload.authors.length) {
        payload.matchKey = 'authors'
        payload.matchText = this.metadata.authorName
      } else if (payload.series.length) {
        payload.matchKey = 'series'
        payload.matchText = this.metadata.seriesName
      }
      else if (payload.tags.length) {
        payload.matchKey = 'tags'
        payload.matchText = this.tags.join(', ')
      }
    }
    return payload
  }

  addEbookFile(libraryFile) {
    var newEbook = new EBookFile()
    newEbook.setData(libraryFile)
    this.ebookFiles.push(newEbook)
  }
}
module.exports = Book