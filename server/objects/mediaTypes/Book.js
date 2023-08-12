const Path = require('path')
const Logger = require('../../Logger')
const BookMetadata = require('../metadata/BookMetadata')
const { areEquivalent, copyValue, cleanStringForSearch } = require('../../utils/index')
const { parseOpfMetadataXML } = require('../../utils/parsers/parseOpfMetadata')
const { parseOverdriveMediaMarkersAsChapters } = require('../../utils/parsers/parseOverdriveMediaMarkers')
const abmetadataGenerator = require('../../utils/generators/abmetadataGenerator')
const { readTextFile, filePathToPOSIX } = require('../../utils/fileUtils')
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
    this.missingParts = []
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
    this.missingParts = book.missingParts ? [...book.missingParts] : []
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
      missingParts: [...this.missingParts],
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
      numMissingParts: this.missingParts.length,
      numInvalidAudioFiles: this.invalidAudioFiles.length,
      duration: this.duration,
      size: this.size,
      ebookFormat: this.ebookFile ? this.ebookFile.ebookFormat : null
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
      missingParts: [...this.missingParts],
      ebookFile: this.ebookFile ? this.ebookFile.toJSON() : null
    }
  }

  toJSONForMetadataFile() {
    return {
      tags: [...this.tags],
      chapters: this.chapters.map(c => ({ ...c })),
      metadata: this.metadata.toJSONForMetadataFile()
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
  get shouldSearchForCover() {
    if (this.coverPath) return false
    if (!this.lastCoverSearch || this.metadata.coverSearchQuery !== this.lastCoverSearchQuery) return true
    return (Date.now() - this.lastCoverSearch) > 1000 * 60 * 60 * 24 * 7 // 7 day
  }
  get hasEmbeddedCoverArt() {
    return this.audioFiles.some(af => af.embeddedCoverArt)
  }
  get invalidAudioFiles() {
    return this.audioFiles.filter(af => af.invalid)
  }
  get includedAudioFiles() {
    return this.audioFiles.filter(af => !af.exclude && !af.invalid)
  }
  get hasIssues() {
    return this.missingParts.length || this.invalidAudioFiles.length
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

  setData(mediaPayload) {
    this.metadata = new BookMetadata()
    if (mediaPayload.metadata) {
      this.metadata.setData(mediaPayload.metadata)
    }
  }

  // Look for desc.txt, reader.txt, metadata.abs and opf file then update details if found
  async syncMetadataFiles(textMetadataFiles, opfMetadataOverrideDetails) {
    let metadataUpdatePayload = {}
    let hasUpdated = false

    const descTxt = textMetadataFiles.find(lf => lf.metadata.filename === 'desc.txt')
    if (descTxt) {
      const descriptionText = await readTextFile(descTxt.metadata.path)
      if (descriptionText) {
        Logger.debug(`[Book] "${this.metadata.title}" found desc.txt updating description with "${descriptionText.slice(0, 20)}..."`)
        metadataUpdatePayload.description = descriptionText
      }
    }
    const readerTxt = textMetadataFiles.find(lf => lf.metadata.filename === 'reader.txt')
    if (readerTxt) {
      const narratorText = await readTextFile(readerTxt.metadata.path)
      if (narratorText) {
        Logger.debug(`[Book] "${this.metadata.title}" found reader.txt updating narrator with "${narratorText}"`)
        metadataUpdatePayload.narrators = this.metadata.parseNarratorsTag(narratorText)
      }
    }

    const metadataIsJSON = global.ServerSettings.metadataFileFormat === 'json'
    const metadataAbs = textMetadataFiles.find(lf => lf.metadata.filename === 'metadata.abs')
    const metadataJson = textMetadataFiles.find(lf => lf.metadata.filename === 'metadata.json')

    const metadataFile = metadataIsJSON ? metadataJson : metadataAbs
    if (metadataFile) {
      Logger.debug(`[Book] Found ${metadataFile.metadata.filename} file for "${this.metadata.title}"`)
      const metadataText = await readTextFile(metadataFile.metadata.path)
      const abmetadataUpdates = abmetadataGenerator.parseAndCheckForUpdates(metadataText, this, 'book', metadataIsJSON)
      if (abmetadataUpdates && Object.keys(abmetadataUpdates).length) {
        Logger.debug(`[Book] "${this.metadata.title}" changes found in metadata.abs file`, abmetadataUpdates)

        if (abmetadataUpdates.tags) { // Set media tags if updated
          this.tags = abmetadataUpdates.tags
          hasUpdated = true
        }
        if (abmetadataUpdates.chapters) { // Set chapters if updated
          this.chapters = abmetadataUpdates.chapters
          hasUpdated = true
        }
        if (abmetadataUpdates.metadata) {
          metadataUpdatePayload = {
            ...metadataUpdatePayload,
            ...abmetadataUpdates.metadata
          }
        }
      }
    } else if (metadataAbs || metadataJson) { // Has different metadata file format so mark as updated
      Logger.debug(`[Book] Found different format metadata file ${(metadataAbs || metadataJson).metadata.filename}, expecting .${global.ServerSettings.metadataFileFormat} for "${this.metadata.title}"`)
      hasUpdated = true
    }

    const metadataOpf = textMetadataFiles.find(lf => lf.isOPFFile || lf.metadata.filename === 'metadata.xml')
    if (metadataOpf) {
      const xmlText = await readTextFile(metadataOpf.metadata.path)
      if (xmlText) {
        const opfMetadata = await parseOpfMetadataXML(xmlText)
        if (opfMetadata) {
          for (const key in opfMetadata) {

            if (key === 'tags') { // Add tags only if tags are empty
              if (opfMetadata.tags.length && (!this.tags.length || opfMetadataOverrideDetails)) {
                this.tags = opfMetadata.tags
                hasUpdated = true
              }
            } else if (key === 'genres') { // Add genres only if genres are empty
              if (opfMetadata.genres.length && (!this.metadata.genres.length || opfMetadataOverrideDetails)) {
                metadataUpdatePayload[key] = opfMetadata.genres
              }
            } else if (key === 'authors') {
              if (opfMetadata.authors && opfMetadata.authors.length && (!this.metadata.authors.length || opfMetadataOverrideDetails)) {
                metadataUpdatePayload.authors = opfMetadata.authors.map(authorName => {
                  return {
                    id: `new-${Math.floor(Math.random() * 1000000)}`,
                    name: authorName
                  }
                })
              }
            } else if (key === 'narrators') {
              if (opfMetadata.narrators?.length && (!this.metadata.narrators.length || opfMetadataOverrideDetails)) {
                metadataUpdatePayload.narrators = opfMetadata.narrators
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
      return this.metadata.update(metadataUpdatePayload) || hasUpdated
    }
    return hasUpdated
  }

  searchQuery(query) {
    const payload = {
      tags: this.tags.filter(t => cleanStringForSearch(t).includes(query)),
      series: this.metadata.searchSeries(query),
      authors: this.metadata.searchAuthors(query),
      narrators: this.metadata.searchNarrators(query),
      matchKey: null,
      matchText: null
    }
    const metadataMatch = this.metadata.searchQuery(query)
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
      } else if (payload.tags.length) {
        payload.matchKey = 'tags'
        payload.matchText = this.tags.join(', ')
      } else if (payload.narrators.length) {
        payload.matchKey = 'narrators'
        payload.matchText = this.metadata.narratorName
      }
    }
    return payload
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

    this.rebuildTracks()
  }

  rebuildTracks() {
    Logger.debug(`[Book] Tracks being rebuilt...!`)
    this.audioFiles.sort((a, b) => a.index - b.index)
    this.missingParts = []
    this.setChapters()
    this.checkUpdateMissingTracks()
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
      Logger.info(`[Audiobook] "${this.metadata.title}" has ${missingParts.length} missing parts`)
    }

    return wasUpdated
  }

  setChapters() {
    const preferOverdriveMediaMarker = !!global.ServerSettings.scannerPreferOverdriveMediaMarker

    // If 1 audio file without chapters, then no chapters will be set
    const includedAudioFiles = this.audioFiles.filter(af => !af.exclude)
    if (!includedAudioFiles.length) return

    // If overdrive media markers are present and preferred, use those instead
    if (preferOverdriveMediaMarker) {
      const overdriveChapters = parseOverdriveMediaMarkersAsChapters(includedAudioFiles)
      if (overdriveChapters) {
        Logger.info('[Book] Overdrive Media Markers and preference found! Using these for chapter definitions')
        this.chapters = overdriveChapters
        return
      }
    }

    // If first audio file has embedded chapters then use embedded chapters
    if (includedAudioFiles[0].chapters?.length) {
      // If all files chapters are the same, then only make chapters for the first file
      if (
        includedAudioFiles.length === 1 ||
        includedAudioFiles.length > 1 &&
        includedAudioFiles[0].chapters.length === includedAudioFiles[1].chapters?.length &&
        includedAudioFiles[0].chapters.every((c, i) => c.title === includedAudioFiles[1].chapters[i].title)
      ) {
        Logger.debug(`[Book] setChapters: Using embedded chapters in first audio file ${includedAudioFiles[0].metadata?.path}`)
        this.chapters = includedAudioFiles[0].chapters.map((c) => ({ ...c }))
      } else {
        Logger.debug(`[Book] setChapters: Using embedded chapters from all audio files ${includedAudioFiles[0].metadata?.path}`)
        this.chapters = []
        let currChapterId = 0
        let currStartTime = 0

        includedAudioFiles.forEach((file) => {
          if (file.duration) {
            const chapters = file.chapters?.map((c) => ({
              ...c,
              id: c.id + currChapterId,
              start: c.start + currStartTime,
              end: c.end + currStartTime,
            })) ?? []
            this.chapters = this.chapters.concat(chapters)

            currChapterId += file.chapters?.length ?? 0
            currStartTime += file.duration
          }
        })
      }
    } else if (includedAudioFiles.length > 1) {
      const preferAudioMetadata = !!global.ServerSettings.scannerPreferAudioMetadata

      // Build chapters from audio files
      this.chapters = []
      let currChapterId = 0
      let currStartTime = 0
      includedAudioFiles.forEach((file) => {
        if (file.duration) {
          let title = file.metadata.filename ? Path.basename(file.metadata.filename, Path.extname(file.metadata.filename)) : `Chapter ${currChapterId}`

          // When prefer audio metadata server setting is set then use ID3 title tag as long as it is not the same as the book title
          if (preferAudioMetadata && file.metaTags?.tagTitle && file.metaTags?.tagTitle !== this.metadata.title) {
            title = file.metaTags.tagTitle
          }

          this.chapters.push({
            id: currChapterId++,
            start: currStartTime,
            end: currStartTime + file.duration,
            title
          })
          currStartTime += file.duration
        }
      })
    }
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
