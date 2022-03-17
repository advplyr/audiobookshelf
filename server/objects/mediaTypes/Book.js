const Path = require('path')
const Logger = require('../../Logger')
const BookMetadata = require('../metadata/BookMetadata')
const abmetadataGenerator = require('../../utils/abmetadataGenerator')
const { areEquivalent, copyValue } = require('../../utils/index')
const { parseOpfMetadataXML } = require('../../utils/parseOpfMetadata')
const { readTextFile } = require('../../utils/fileUtils')

const Audiobook = require('../entities/Audiobook')
const EBook = require('../entities/EBook')

class Book {
  constructor(book) {
    this.metadata = null

    this.coverPath = null
    this.tags = []

    this.audiobooks = []
    this.ebooks = []

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
    this.audiobooks = book.audiobooks.map(ab => new Audiobook(ab))
    this.ebooks = book.ebooks.map(eb => new EBook(eb))
    this.lastCoverSearch = book.lastCoverSearch || null
    this.lastCoverSearchQuery = book.lastCoverSearchQuery || null
  }

  toJSON() {
    return {
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      audiobooks: this.audiobooks.map(ab => ab.toJSON()),
      ebooks: this.ebooks.map(eb => eb.toJSON())
    }
  }

  toJSONMinified() {
    return {
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      audiobooks: this.audiobooks.map(ab => ab.toJSONMinified()),
      ebooks: this.ebooks.map(eb => eb.toJSONMinified()),
      size: this.size
    }
  }

  toJSONExpanded() {
    return {
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      audiobooks: this.audiobooks.map(ab => ab.toJSONExpanded()),
      ebooks: this.ebooks.map(eb => eb.toJSONExpanded()),
      size: this.size,
    }
  }

  get size() {
    var total = 0
    this.audiobooks.forEach((ab) => total += ab.size)
    this.ebooks.forEach((eb) => total += eb.size)
    return total
  }
  get hasMediaEntities() {
    return !!(this.audiobooks.length + this.ebooks.length)
  }
  get shouldSearchForCover() {
    if (this.coverPath) return false
    if (!this.lastCoverSearch || this.metadata.coverSearchQuery !== this.lastCoverSearchQuery) return true
    return (Date.now() - this.lastCoverSearch) > 1000 * 60 * 60 * 24 * 7 // 7 day
  }
  get hasEmbeddedCoverArt() {
    return this.audiobooks.some(ab => ab.hasEmbeddedCoverArt)
  }

  update(payload) {
    var json = this.toJSON()
    delete json.audiobooks // do not update media entities here
    delete json.ebooks

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

  removeFileWithInode(inode) {
    var audiobookWithIno = this.audiobooks.find(ab => ab.findFileWithInode(inode))
    if (audiobookWithIno) {
      audiobookWithIno.removeFileWithInode(inode)
      if (!audiobookWithIno.audioFiles.length) { // All audio files removed = remove audiobook
        this.audiobooks = this.audiobooks.filter(ab => ab.id !== audiobookWithIno.id)
      }
      return true
    }
    var ebookWithIno = this.ebooks.find(eb => eb.findFileWithInode(inode))
    if (ebookWithIno) {
      this.ebooks = this.ebooks.filter(eb => eb.id !== ebookWithIno.id) // Remove ebook
      return true
    }
    return false
  }

  findFileWithInode(inode) {
    var audioFile = this.audiobooks.find(ab => ab.findFileWithInode(inode))
    if (audioFile) return audioFile
    var ebookFile = this.ebooks.find(eb => eb.findFileWithInode(inode))
    if (ebookFile) return ebookFile
    return null
  }

  updateLastCoverSearch(coverWasFound) {
    this.lastCoverSearch = coverWasFound ? null : Date.now()
    this.lastCoverSearchQuery = coverWasFound ? null : this.metadata.coverSearchQuery
  }

  // Audio file metadata tags map to book details (will not overwrite)
  setMetadataFromAudioFile(overrideExistingDetails = false) {
    if (!this.audiobooks.length) return false
    var audiobook = this.audiobooks[0]
    var audioFile = audiobook.audioFiles[0]
    if (!audioFile.metaTags) return false
    return this.metadata.setDataFromAudioMetaTags(audioFile.metaTags, overrideExistingDetails)
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
    // var newEbook = new EBookFile()
    // newEbook.setData(libraryFile)
    // this.ebookFiles.push(newEbook)
  }

  getDirectPlayTracklist(options) {

  }
}
module.exports = Book