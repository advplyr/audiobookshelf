const uuidv4 = require("uuid").v4
const Path = require('path')
const sequelize = require('sequelize')
const { LogLevel } = require('../utils/constants')
const { getTitleIgnorePrefix, areEquivalent } = require('../utils/index')
const abmetadataGenerator = require('../utils/generators/abmetadataGenerator')
const parseNameString = require('../utils/parsers/parseNameString')
const globals = require('../utils/globals')
const AudioFileScanner = require('./AudioFileScanner')
const Database = require('../Database')
const { readTextFile, filePathToPOSIX, getFileTimestampsWithIno } = require('../utils/fileUtils')
const AudioFile = require('../objects/files/AudioFile')
const CoverManager = require('../managers/CoverManager')
const LibraryFile = require('../objects/files/LibraryFile')
const SocketAuthority = require('../SocketAuthority')
const fsExtra = require("../libs/fsExtra")
const BookFinder = require('../finders/BookFinder')

const LibraryScan = require("./LibraryScan")
const OpfFileScanner = require('./OpfFileScanner')
const AbsMetadataFileScanner = require('./AbsMetadataFileScanner')

/**
 * Metadata for books pulled from files
 * @typedef BookMetadataObject
 * @property {string} title
 * @property {string} titleIgnorePrefix
 * @property {string} subtitle
 * @property {string} publishedYear
 * @property {string} publisher
 * @property {string} description
 * @property {string} isbn
 * @property {string} asin
 * @property {string} language
 * @property {string[]} narrators
 * @property {string[]} genres
 * @property {string[]} tags
 * @property {string[]} authors
 * @property {{name:string, sequence:string}[]} series
 * @property {{id:number, start:number, end:number, title:string}[]} chapters
 * @property {boolean} explicit
 * @property {boolean} abridged
 * @property {string} coverPath
 */

class BookScanner {
  constructor() { }

  /**
   * @param {import('../models/LibraryItem')} existingLibraryItem 
   * @param {import('./LibraryItemScanData')} libraryItemData 
   * @param {import('../models/Library').LibrarySettingsObject} librarySettings
   * @param {LibraryScan} libraryScan 
   * @returns {Promise<{libraryItem:import('../models/LibraryItem'), wasUpdated:boolean}>}
   */
  async rescanExistingBookLibraryItem(existingLibraryItem, libraryItemData, librarySettings, libraryScan) {
    /** @type {import('../models/Book')} */
    const media = await existingLibraryItem.getMedia({
      include: [
        {
          model: Database.authorModel,
          through: {
            attributes: ['id', 'createdAt']
          }
        },
        {
          model: Database.seriesModel,
          through: {
            attributes: ['id', 'sequence', 'createdAt']
          }
        }
      ],
      order: [
        [Database.authorModel, Database.bookAuthorModel, 'createdAt', 'ASC'],
        [Database.seriesModel, 'bookSeries', 'createdAt', 'ASC']
      ]
    })

    let hasMediaChanges = libraryItemData.hasAudioFileChanges || libraryItemData.audioLibraryFiles.length !== media.audioFiles.length
    if (hasMediaChanges) {
      // Filter out audio files that were removed
      media.audioFiles = media.audioFiles.filter(af => !libraryItemData.checkAudioFileRemoved(af))

      // Update audio files that were modified
      if (libraryItemData.audioLibraryFilesModified.length) {
        let scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(existingLibraryItem.mediaType, libraryItemData, libraryItemData.audioLibraryFilesModified)
        media.audioFiles = media.audioFiles.map((audioFileObj) => {
          let matchedScannedAudioFile = scannedAudioFiles.find(saf => saf.metadata.path === audioFileObj.metadata.path)
          if (!matchedScannedAudioFile) {
            matchedScannedAudioFile = scannedAudioFiles.find(saf => saf.ino === audioFileObj.ino)
          }

          if (matchedScannedAudioFile) {
            scannedAudioFiles = scannedAudioFiles.filter(saf => saf !== matchedScannedAudioFile)
            const audioFile = new AudioFile(audioFileObj)
            audioFile.updateFromScan(matchedScannedAudioFile)
            return audioFile.toJSON()
          }
          return audioFileObj
        })
        // Modified audio files that were not found on the book
        if (scannedAudioFiles.length) {
          media.audioFiles.push(...scannedAudioFiles)
        }
      }

      // Add new audio files scanned in
      if (libraryItemData.audioLibraryFilesAdded.length) {
        const scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(existingLibraryItem.mediaType, libraryItemData, libraryItemData.audioLibraryFilesAdded)
        media.audioFiles.push(...scannedAudioFiles)
      }

      // Add audio library files that are not already set on the book (safety check)
      let audioLibraryFilesToAdd = []
      for (const audioLibraryFile of libraryItemData.audioLibraryFiles) {
        if (!media.audioFiles.some(af => af.ino === audioLibraryFile.ino)) {
          libraryScan.addLog(LogLevel.DEBUG, `Existing audio library file "${audioLibraryFile.metadata.relPath}" was not set on book "${media.title}" so setting it now`)

          audioLibraryFilesToAdd.push(audioLibraryFile)
        }
      }
      if (audioLibraryFilesToAdd.length) {
        const scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(existingLibraryItem.mediaType, libraryItemData, audioLibraryFilesToAdd)
        media.audioFiles.push(...scannedAudioFiles)
      }

      media.audioFiles = AudioFileScanner.runSmartTrackOrder(existingLibraryItem.relPath, media.audioFiles)

      media.duration = 0
      media.audioFiles.forEach((af) => {
        if (!isNaN(af.duration)) {
          media.duration += af.duration
        }
      })

      media.changed('audioFiles', true)
    }

    // Check if cover was removed
    if (media.coverPath && !libraryItemData.imageLibraryFiles.some(lf => lf.metadata.path === media.coverPath) && !(await fsExtra.pathExists(media.coverPath))) {
      media.coverPath = null
      hasMediaChanges = true
    }

    // Check if cover is not set and image files were found
    if (!media.coverPath && libraryItemData.imageLibraryFiles.length) {
      // Prefer using a cover image with the name "cover" otherwise use the first image
      const coverMatch = libraryItemData.imageLibraryFiles.find(iFile => /\/cover\.[^.\/]*$/.test(iFile.metadata.path))
      media.coverPath = coverMatch?.metadata.path || libraryItemData.imageLibraryFiles[0].metadata.path
      hasMediaChanges = true
    }

    // Check if ebook was removed
    if (media.ebookFile && (librarySettings.audiobooksOnly || libraryItemData.checkEbookFileRemoved(media.ebookFile))) {
      media.ebookFile = null
      hasMediaChanges = true
    }

    // Check if ebook is not set and ebooks were found
    if (!media.ebookFile && !librarySettings.audiobooksOnly && libraryItemData.ebookLibraryFiles.length) {
      // Prefer to use an epub ebook then fallback to the first ebook found
      let ebookLibraryFile = libraryItemData.ebookLibraryFiles.find(lf => lf.metadata.ext.slice(1).toLowerCase() === 'epub')
      if (!ebookLibraryFile) ebookLibraryFile = libraryItemData.ebookLibraryFiles[0]
      ebookLibraryFile = ebookLibraryFile.toJSON()
      // Ebook file is the same as library file except for additional `ebookFormat`
      ebookLibraryFile.ebookFormat = ebookLibraryFile.metadata.ext.slice(1).toLowerCase()
      media.ebookFile = ebookLibraryFile
      media.changed('ebookFile', true)
      hasMediaChanges = true
    }

    const bookMetadata = await this.getBookMetadataFromScanData(media.audioFiles, libraryItemData, libraryScan, librarySettings, existingLibraryItem.id)
    let authorsUpdated = false
    const bookAuthorsRemoved = []
    let seriesUpdated = false
    const bookSeriesRemoved = []

    for (const key in bookMetadata) {
      // Ignore unset metadata and empty arrays
      if (bookMetadata[key] === undefined || (Array.isArray(bookMetadata[key]) && !bookMetadata[key].length)) continue

      if (key === 'authors') {
        // Check for authors added
        for (const authorName of bookMetadata.authors) {
          if (!media.authors.some(au => au.name === authorName)) {
            const existingAuthor = Database.libraryFilterData[libraryItemData.libraryId].authors.find(au => au.name === authorName)
            if (existingAuthor) {
              await Database.bookAuthorModel.create({
                bookId: media.id,
                authorId: existingAuthor.id
              })
              libraryScan.addLog(LogLevel.DEBUG, `Updating book "${bookMetadata.title}" added author "${authorName}"`)
              authorsUpdated = true
            } else {
              const newAuthor = await Database.authorModel.create({
                name: authorName,
                lastFirst: parseNameString.nameToLastFirst(authorName),
                libraryId: libraryItemData.libraryId
              })
              await media.addAuthor(newAuthor)
              Database.addAuthorToFilterData(libraryItemData.libraryId, newAuthor.name, newAuthor.id)
              libraryScan.addLog(LogLevel.DEBUG, `Updating book "${bookMetadata.title}" added new author "${authorName}"`)
              authorsUpdated = true
            }
          }
        }
        // Check for authors removed
        for (const author of media.authors) {
          if (!bookMetadata.authors.includes(author.name)) {
            await author.bookAuthor.destroy()
            libraryScan.addLog(LogLevel.DEBUG, `Updating book "${bookMetadata.title}" removed author "${author.name}"`)
            authorsUpdated = true
            bookAuthorsRemoved.push(author.id)
          }
        }
      } else if (key === 'series') {
        // Check for series added
        for (const seriesObj of bookMetadata.series) {
          if (!media.series.some(se => se.name === seriesObj.name)) {
            const existingSeries = Database.libraryFilterData[libraryItemData.libraryId].series.find(se => se.name === seriesObj.name)
            if (existingSeries) {
              await Database.bookSeriesModel.create({
                bookId: media.id,
                seriesId: existingSeries.id,
                sequence: seriesObj.sequence
              })
              libraryScan.addLog(LogLevel.DEBUG, `Updating book "${bookMetadata.title}" added series "${seriesObj.name}"${seriesObj.sequence ? ` with sequence "${seriesObj.sequence}"` : ''}`)
              seriesUpdated = true
            } else {
              const newSeries = await Database.seriesModel.create({
                name: seriesObj.name,
                nameIgnorePrefix: getTitleIgnorePrefix(seriesObj.name),
                libraryId: libraryItemData.libraryId
              })
              await media.addSeries(newSeries, { through: { sequence: seriesObj.sequence } })
              Database.addSeriesToFilterData(libraryItemData.libraryId, newSeries.name, newSeries.id)
              libraryScan.addLog(LogLevel.DEBUG, `Updating book "${bookMetadata.title}" added new series "${seriesObj.name}"${seriesObj.sequence ? ` with sequence "${seriesObj.sequence}"` : ''}`)
              seriesUpdated = true
            }
          }
        }
        // Check for series removed
        for (const series of media.series) {
          if (!bookMetadata.series.some(se => se.name === series.name)) {
            await series.bookSeries.destroy()
            libraryScan.addLog(LogLevel.DEBUG, `Updating book "${bookMetadata.title}" removed series "${series.name}"`)
            seriesUpdated = true
            bookSeriesRemoved.push(series.id)
          }
        }
      } else if (key === 'genres') {
        const existingGenres = media.genres || []
        if (bookMetadata.genres.some(g => !existingGenres.includes(g)) || existingGenres.some(g => !bookMetadata.genres.includes(g))) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating book genres "${existingGenres.join(',')}" => "${bookMetadata.genres.join(',')}" for book "${bookMetadata.title}"`)
          media.genres = bookMetadata.genres
          hasMediaChanges = true
        }
      } else if (key === 'tags') {
        const existingTags = media.tags || []
        if (bookMetadata.tags.some(t => !existingTags.includes(t)) || existingTags.some(t => !bookMetadata.tags.includes(t))) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating book tags "${existingTags.join(',')}" => "${bookMetadata.tags.join(',')}" for book "${bookMetadata.title}"`)
          media.tags = bookMetadata.tags
          hasMediaChanges = true
        }
      } else if (key === 'narrators') {
        const existingNarrators = media.narrators || []
        if (bookMetadata.narrators.some(t => !existingNarrators.includes(t)) || existingNarrators.some(t => !bookMetadata.narrators.includes(t))) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating book narrators "${existingNarrators.join(',')}" => "${bookMetadata.narrators.join(',')}" for book "${bookMetadata.title}"`)
          media.narrators = bookMetadata.narrators
          hasMediaChanges = true
        }
      } else if (key === 'chapters') {
        if (!areEquivalent(media.chapters, bookMetadata.chapters)) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating book chapters for book "${bookMetadata.title}"`)
          media.chapters = bookMetadata.chapters
          hasMediaChanges = true
        }
      } else if (key === 'coverPath') {
        if (media.coverPath && media.coverPath !== bookMetadata.coverPath && !(await fsExtra.pathExists(media.coverPath))) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating book cover "${media.coverPath}" => "${bookMetadata.coverPath}" for book "${bookMetadata.title}" - original cover path does not exist`)
          media.coverPath = bookMetadata.coverPath
          hasMediaChanges = true
        } else if (!media.coverPath) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating book cover "unset" => "${bookMetadata.coverPath}" for book "${bookMetadata.title}"`)
          media.coverPath = bookMetadata.coverPath
          hasMediaChanges = true
        }
      } else if (bookMetadata[key] !== media[key]) {
        libraryScan.addLog(LogLevel.DEBUG, `Updating book ${key} "${media[key]}" => "${bookMetadata[key]}" for book "${bookMetadata.title}"`)
        media[key] = bookMetadata[key]
        hasMediaChanges = true
      }
    }

    // Load authors/series again if updated (for sending back to client)
    if (authorsUpdated) {
      media.authors = await media.getAuthors({
        joinTableAttributes: ['createdAt'],
        order: [
          sequelize.literal(`bookAuthor.createdAt ASC`)
        ]
      })
    }
    if (seriesUpdated) {
      media.series = await media.getSeries({
        joinTableAttributes: ['sequence', 'createdAt'],
        order: [
          sequelize.literal(`bookSeries.createdAt ASC`)
        ]
      })
    }

    // If no cover then extract cover from audio file if available OR search for cover if enabled in server settings
    if (!media.coverPath) {
      const libraryItemDir = existingLibraryItem.isFile ? null : existingLibraryItem.path
      const extractedCoverPath = await CoverManager.saveEmbeddedCoverArt(media.audioFiles, existingLibraryItem.id, libraryItemDir)
      if (extractedCoverPath) {
        libraryScan.addLog(LogLevel.DEBUG, `Updating book "${bookMetadata.title}" extracted embedded cover art from audio file to path "${extractedCoverPath}"`)
        media.coverPath = extractedCoverPath
        hasMediaChanges = true
      } else if (Database.serverSettings.scannerFindCovers) {
        const authorName = media.authors.map(au => au.name).filter(au => au).join(', ')
        const coverPath = await this.searchForCover(existingLibraryItem.id, libraryItemDir, media.title, authorName, libraryScan)
        if (coverPath) {
          media.coverPath = coverPath
          hasMediaChanges = true
        }
      }
    }

    existingLibraryItem.media = media

    let libraryItemUpdated = false

    // Save Book changes to db
    if (hasMediaChanges) {
      await media.save()
      await this.saveMetadataFile(existingLibraryItem, libraryScan)
      libraryItemUpdated = global.ServerSettings.storeMetadataWithItem && !existingLibraryItem.isFile
    }

    // If book has no audio files and no ebook then it is considered missing
    if (!media.audioFiles.length && !media.ebookFile) {
      if (!existingLibraryItem.isMissing) {
        libraryScan.addLog(LogLevel.INFO, `Book "${bookMetadata.title}" has no audio files and no ebook file. Setting library item as missing`)
        existingLibraryItem.isMissing = true
        libraryItemUpdated = true
      }
    } else if (existingLibraryItem.isMissing) {
      libraryScan.addLog(LogLevel.INFO, `Book "${bookMetadata.title}" was missing but now has media files. Setting library item as NOT missing`)
      existingLibraryItem.isMissing = false
      libraryItemUpdated = true
    }

    // Check/update the isSupplementary flag on libraryFiles for the LibraryItem
    for (const libraryFile of existingLibraryItem.libraryFiles) {
      if (globals.SupportedEbookTypes.includes(libraryFile.metadata.ext.slice(1).toLowerCase())) {
        if (media.ebookFile && libraryFile.ino === media.ebookFile.ino) {
          if (libraryFile.isSupplementary !== false) {
            libraryFile.isSupplementary = false
            libraryItemUpdated = true
          }
        } else if (libraryFile.isSupplementary !== true) {
          libraryFile.isSupplementary = true
          libraryItemUpdated = true
        }
      }
    }
    if (libraryItemUpdated) {
      existingLibraryItem.changed('libraryFiles', true)
      await existingLibraryItem.save()
    }

    libraryScan.seriesRemovedFromBooks.push(...bookSeriesRemoved)
    libraryScan.authorsRemovedFromBooks.push(...bookAuthorsRemoved)

    return {
      libraryItem: existingLibraryItem,
      wasUpdated: hasMediaChanges || libraryItemUpdated || seriesUpdated || authorsUpdated
    }
  }

  /**
   * 
   * @param {import('./LibraryItemScanData')} libraryItemData 
   * @param {import('../models/Library').LibrarySettingsObject} librarySettings
   * @param {LibraryScan} libraryScan 
   * @returns {Promise<import('../models/LibraryItem')>}
   */
  async scanNewBookLibraryItem(libraryItemData, librarySettings, libraryScan) {
    // Scan audio files found
    let scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(libraryItemData.mediaType, libraryItemData, libraryItemData.audioLibraryFiles)
    scannedAudioFiles = AudioFileScanner.runSmartTrackOrder(libraryItemData.relPath, scannedAudioFiles)

    // Find ebook file (prefer epub)
    let ebookLibraryFile = librarySettings.audiobooksOnly ? null : libraryItemData.ebookLibraryFiles.find(lf => lf.metadata.ext.slice(1).toLowerCase() === 'epub') || libraryItemData.ebookLibraryFiles[0]

    // Do not add library items that have no valid audio files and no ebook file
    if (!ebookLibraryFile && !scannedAudioFiles.length) {
      libraryScan.addLog(LogLevel.WARN, `Library item at path "${libraryItemData.relPath}" has no audio files and no ebook file - ignoring`)
      return null
    }

    if (ebookLibraryFile) {
      ebookLibraryFile = ebookLibraryFile.toJSON()
      ebookLibraryFile.ebookFormat = ebookLibraryFile.metadata.ext.slice(1).toLowerCase()
    }

    const bookMetadata = await this.getBookMetadataFromScanData(scannedAudioFiles, libraryItemData, libraryScan, librarySettings)
    bookMetadata.explicit = !!bookMetadata.explicit // Ensure boolean
    bookMetadata.abridged = !!bookMetadata.abridged // Ensure boolean

    let duration = 0
    scannedAudioFiles.forEach((af) => duration += (!isNaN(af.duration) ? Number(af.duration) : 0))
    const bookObject = {
      ...bookMetadata,
      audioFiles: scannedAudioFiles,
      ebookFile: ebookLibraryFile || null,
      duration,
      bookAuthors: [],
      bookSeries: []
    }
    if (bookMetadata.authors.length) {
      for (const authorName of bookMetadata.authors) {
        const matchingAuthor = Database.libraryFilterData[libraryItemData.libraryId].authors.find(au => au.name === authorName)
        if (matchingAuthor) {
          bookObject.bookAuthors.push({
            authorId: matchingAuthor.id
          })
        } else {
          // New author
          bookObject.bookAuthors.push({
            author: {
              libraryId: libraryItemData.libraryId,
              name: authorName,
              lastFirst: parseNameString.nameToLastFirst(authorName)
            }
          })
        }
      }
    }
    if (bookMetadata.series.length) {
      for (const seriesObj of bookMetadata.series) {
        if (!seriesObj.name) continue
        const matchingSeries = Database.libraryFilterData[libraryItemData.libraryId].series.find(se => se.name === seriesObj.name)
        if (matchingSeries) {
          bookObject.bookSeries.push({
            seriesId: matchingSeries.id,
            sequence: seriesObj.sequence
          })
        } else {
          bookObject.bookSeries.push({
            sequence: seriesObj.sequence,
            series: {
              name: seriesObj.name,
              nameIgnorePrefix: getTitleIgnorePrefix(seriesObj.name),
              libraryId: libraryItemData.libraryId
            }
          })
        }
      }
    }

    const libraryItemObj = libraryItemData.libraryItemObject
    libraryItemObj.id = uuidv4() // Generate library item id ahead of time to use for saving extracted cover image
    libraryItemObj.isMissing = false
    libraryItemObj.isInvalid = false
    libraryItemObj.extraData = {}

    // Set isSupplementary flag on ebook library files
    for (const libraryFile of libraryItemObj.libraryFiles) {
      if (globals.SupportedEbookTypes.includes(libraryFile.metadata.ext.slice(1).toLowerCase())) {
        libraryFile.isSupplementary = libraryFile.ino !== ebookLibraryFile?.ino
      }
    }

    // If cover was not found in folder then check embedded covers in audio files OR search for cover
    if (!bookObject.coverPath) {
      const libraryItemDir = libraryItemObj.isFile ? null : libraryItemObj.path
      // Extract and save embedded cover art
      const extractedCoverPath = await CoverManager.saveEmbeddedCoverArt(scannedAudioFiles, libraryItemObj.id, libraryItemDir)
      if (extractedCoverPath) {
        bookObject.coverPath = extractedCoverPath
      } else if (Database.serverSettings.scannerFindCovers) {
        const authorName = bookMetadata.authors.join(', ')
        bookObject.coverPath = await this.searchForCover(libraryItemObj.id, libraryItemDir, bookObject.title, authorName, libraryScan)
      }
    }

    libraryItemObj.book = bookObject
    const libraryItem = await Database.libraryItemModel.create(libraryItemObj, {
      include: {
        model: Database.bookModel,
        include: [
          {
            model: Database.bookSeriesModel,
            include: {
              model: Database.seriesModel
            }
          },
          {
            model: Database.bookAuthorModel,
            include: {
              model: Database.authorModel
            }
          }
        ]
      }
    })

    // Update library filter data
    if (libraryItem.book.bookSeries?.length) {
      for (const bs of libraryItem.book.bookSeries) {
        if (bs.series) {
          Database.addSeriesToFilterData(libraryItemData.libraryId, bs.series.name, bs.series.id)
        }
      }
    }
    if (libraryItem.book.bookAuthors?.length) {
      for (const ba of libraryItem.book.bookAuthors) {
        if (ba.author) {
          Database.addAuthorToFilterData(libraryItemData.libraryId, ba.author.name, ba.author.id)
        }
      }
    }
    Database.addNarratorsToFilterData(libraryItemData.libraryId, libraryItem.book.narrators)
    Database.addGenresToFilterData(libraryItemData.libraryId, libraryItem.book.genres)
    Database.addTagsToFilterData(libraryItemData.libraryId, libraryItem.book.tags)
    Database.addPublisherToFilterData(libraryItemData.libraryId, libraryItem.book.publisher)
    Database.addLanguageToFilterData(libraryItemData.libraryId, libraryItem.book.language)

    // Load for emitting to client
    libraryItem.media = await libraryItem.getMedia({
      include: [
        {
          model: Database.authorModel,
          through: {
            attributes: ['id', 'createdAt']
          }
        },
        {
          model: Database.seriesModel,
          through: {
            attributes: ['id', 'sequence', 'createdAt']
          }
        }
      ],
      order: [
        [Database.authorModel, Database.bookAuthorModel, 'createdAt', 'ASC'],
        [Database.seriesModel, 'bookSeries', 'createdAt', 'ASC']
      ]
    })

    await this.saveMetadataFile(libraryItem, libraryScan)
    if (global.ServerSettings.storeMetadataWithItem && !libraryItem.isFile) {
      libraryItem.changed('libraryFiles', true)
      await libraryItem.save()
    }

    return libraryItem
  }

  /**
   * 
   * @param {import('../models/Book').AudioFileObject[]} audioFiles 
   * @param {import('./LibraryItemScanData')} libraryItemData 
   * @param {LibraryScan} libraryScan 
   * @param {import('../models/Library').LibrarySettingsObject} librarySettings
   * @param {string} [existingLibraryItemId]
   * @returns {Promise<BookMetadataObject>}
   */
  async getBookMetadataFromScanData(audioFiles, libraryItemData, libraryScan, librarySettings, existingLibraryItemId = null) {
    // First set book metadata from folder/file names
    const bookMetadata = {
      title: libraryItemData.mediaMetadata.title, // required
      titleIgnorePrefix: undefined,
      subtitle: undefined,
      publishedYear: undefined,
      publisher: undefined,
      description: undefined,
      isbn: undefined,
      asin: undefined,
      language: undefined,
      narrators: [],
      genres: [],
      tags: [],
      authors: [],
      series: [],
      chapters: [],
      explicit: undefined,
      abridged: undefined,
      coverPath: undefined
    }

    const bookMetadataSourceHandler = new BookScanner.BookMetadataSourceHandler(bookMetadata, audioFiles, libraryItemData, libraryScan, existingLibraryItemId)
    const metadataPrecedence = librarySettings.metadataPrecedence || ['folderStructure', 'audioMetatags', 'txtFiles', 'opfFile', 'absMetadata']
    libraryScan.addLog(LogLevel.DEBUG, `"${bookMetadata.title}" Getting metadata with precedence [${metadataPrecedence.join(', ')}]`)
    for (const metadataSource of metadataPrecedence) {
      if (bookMetadataSourceHandler[metadataSource]) {
        await bookMetadataSourceHandler[metadataSource]()
      } else {
        libraryScan.addLog(LogLevel.ERROR, `Invalid metadata source "${metadataSource}"`)
      }
    }

    // Set cover from library file if one is found otherwise check audiofile
    if (libraryItemData.imageLibraryFiles.length) {
      const coverMatch = libraryItemData.imageLibraryFiles.find(iFile => /\/cover\.[^.\/]*$/.test(iFile.metadata.path))
      bookMetadata.coverPath = coverMatch?.metadata.path || libraryItemData.imageLibraryFiles[0].metadata.path
    }

    bookMetadata.titleIgnorePrefix = getTitleIgnorePrefix(bookMetadata.title)

    return bookMetadata
  }


  static BookMetadataSourceHandler = class {
    /**
     * 
     * @param {Object} bookMetadata 
     * @param {import('../models/Book').AudioFileObject[]} audioFiles 
     * @param {import('./LibraryItemScanData')} libraryItemData 
     * @param {LibraryScan} libraryScan 
     * @param {string} existingLibraryItemId 
     */
    constructor(bookMetadata, audioFiles, libraryItemData, libraryScan, existingLibraryItemId) {
      this.bookMetadata = bookMetadata
      this.audioFiles = audioFiles
      this.libraryItemData = libraryItemData
      this.libraryScan = libraryScan
      this.existingLibraryItemId = existingLibraryItemId
    }

    /**
     * Metadata parsed from folder names/structure
     */
    folderStructure() {
      this.libraryItemData.setBookMetadataFromFilenames(this.bookMetadata)
    }

    /**
     * Metadata from audio file meta tags
     */
    audioMetatags() {
      if (!this.audioFiles.length) return
      // Modifies bookMetadata with metadata mapped from audio file meta tags
      const bookTitle = this.bookMetadata.title || this.libraryItemData.mediaMetadata.title
      AudioFileScanner.setBookMetadataFromAudioMetaTags(bookTitle, this.audioFiles, this.bookMetadata, this.libraryScan)
    }

    /**
     * Description from desc.txt and narrator from reader.txt
     */
    async txtFiles() {
      // If desc.txt in library item folder then use this for description
      if (this.libraryItemData.descTxtLibraryFile) {
        const description = await readTextFile(this.libraryItemData.descTxtLibraryFile.metadata.path)
        if (description.trim()) this.bookMetadata.description = description.trim()
      }

      // If reader.txt in library item folder then use this for narrator
      if (this.libraryItemData.readerTxtLibraryFile) {
        let narrator = await readTextFile(this.libraryItemData.readerTxtLibraryFile.metadata.path)
        narrator = narrator.split(/\r?\n/)[0]?.trim() || '' // Only use first line
        if (narrator) {
          this.bookMetadata.narrators = parseNameString.parse(narrator)?.names || []
        }
      }
    }

    /**
     * Metadata from opf file
     */
    async opfFile() {
      if (!this.libraryItemData.metadataOpfLibraryFile) return
      await OpfFileScanner.scanBookOpfFile(this.libraryItemData.metadataOpfLibraryFile, this.bookMetadata)
    }

    /**
     * Metadata from metadata.json or metadata.abs
     */
    async absMetadata() {
      // If metadata.json or metadata.abs use this for metadata
      await AbsMetadataFileScanner.scanBookMetadataFile(this.libraryScan, this.libraryItemData, this.bookMetadata, this.existingLibraryItemId)
    }
  }

  /**
   * 
   * @param {import('../models/LibraryItem')} libraryItem 
   * @param {LibraryScan} libraryScan
   * @returns {Promise}
   */
  async saveMetadataFile(libraryItem, libraryScan) {
    let metadataPath = Path.join(global.MetadataPath, 'items', libraryItem.id)
    let storeMetadataWithItem = global.ServerSettings.storeMetadataWithItem
    if (storeMetadataWithItem && !libraryItem.isFile) {
      metadataPath = libraryItem.path
    } else {
      // Make sure metadata book dir exists
      storeMetadataWithItem = false
      await fsExtra.ensureDir(metadataPath)
    }

    const metadataFileFormat = global.ServerSettings.metadataFileFormat
    const metadataFilePath = Path.join(metadataPath, `metadata.${metadataFileFormat}`)
    if (metadataFileFormat === 'json') {
      // Remove metadata.abs if it exists
      if (await fsExtra.pathExists(Path.join(metadataPath, `metadata.abs`))) {
        libraryScan.addLog(LogLevel.DEBUG, `Removing metadata.abs for item "${libraryItem.media.title}"`)
        await fsExtra.remove(Path.join(metadataPath, `metadata.abs`))
        libraryItem.libraryFiles = libraryItem.libraryFiles.filter(lf => lf.metadata.path !== filePathToPOSIX(Path.join(metadataPath, `metadata.abs`)))
      }

      // TODO: Update to not use `metadata` so it fits the updated model
      const jsonObject = {
        tags: libraryItem.media.tags || [],
        chapters: libraryItem.media.chapters?.map(c => ({ ...c })) || [],
        metadata: {
          title: libraryItem.media.title,
          subtitle: libraryItem.media.subtitle,
          authors: libraryItem.media.authors.map(a => a.name),
          narrators: libraryItem.media.narrators,
          series: libraryItem.media.series.map(se => {
            const sequence = se.bookSeries?.sequence || ''
            if (!sequence) return se.name
            return `${se.name} #${sequence}`
          }),
          genres: libraryItem.media.genres || [],
          publishedYear: libraryItem.media.publishedYear,
          publishedDate: libraryItem.media.publishedDate,
          publisher: libraryItem.media.publisher,
          description: libraryItem.media.description,
          isbn: libraryItem.media.isbn,
          asin: libraryItem.media.asin,
          language: libraryItem.media.language,
          explicit: !!libraryItem.media.explicit,
          abridged: !!libraryItem.media.abridged
        }
      }
      return fsExtra.writeFile(metadataFilePath, JSON.stringify(jsonObject, null, 2)).then(async () => {
        // Add metadata.json to libraryFiles array if it is new
        let metadataLibraryFile = libraryItem.libraryFiles.find(lf => lf.metadata.path === filePathToPOSIX(metadataFilePath))
        if (storeMetadataWithItem) {
          if (!metadataLibraryFile) {
            const newLibraryFile = new LibraryFile()
            await newLibraryFile.setDataFromPath(metadataFilePath, `metadata.json`)
            metadataLibraryFile = newLibraryFile.toJSON()
            libraryItem.libraryFiles.push(metadataLibraryFile)
          } else {
            const fileTimestamps = await getFileTimestampsWithIno(metadataFilePath)
            if (fileTimestamps) {
              metadataLibraryFile.metadata.mtimeMs = fileTimestamps.mtimeMs
              metadataLibraryFile.metadata.ctimeMs = fileTimestamps.ctimeMs
              metadataLibraryFile.metadata.size = fileTimestamps.size
              metadataLibraryFile.ino = fileTimestamps.ino
            }
          }
          const libraryItemDirTimestamps = await getFileTimestampsWithIno(libraryItem.path)
          if (libraryItemDirTimestamps) {
            libraryItem.mtime = libraryItemDirTimestamps.mtimeMs
            libraryItem.ctime = libraryItemDirTimestamps.ctimeMs
            let size = 0
            libraryItem.libraryFiles.forEach((lf) => size += (!isNaN(lf.metadata.size) ? Number(lf.metadata.size) : 0))
            libraryItem.size = size
          }
        }

        libraryScan.addLog(LogLevel.DEBUG, `Success saving abmetadata to "${metadataFilePath}"`)

        return metadataLibraryFile
      }).catch((error) => {
        libraryScan.addLog(LogLevel.ERROR, `Failed to save json file at "${metadataFilePath}"`, error)
        return null
      })
    } else {
      // Remove metadata.json if it exists
      if (await fsExtra.pathExists(Path.join(metadataPath, `metadata.json`))) {
        libraryScan.addLog(LogLevel.DEBUG, `Removing metadata.json for item "${libraryItem.media.title}"`)
        await fsExtra.remove(Path.join(metadataPath, `metadata.json`))
        libraryItem.libraryFiles = libraryItem.libraryFiles.filter(lf => lf.metadata.path !== filePathToPOSIX(Path.join(metadataPath, `metadata.json`)))
      }

      return abmetadataGenerator.generateFromNewModel(libraryItem, metadataFilePath).then(async (success) => {
        if (!success) {
          libraryScan.addLog(LogLevel.ERROR, `Failed saving abmetadata to "${metadataFilePath}"`)
          return null
        }
        // Add metadata.abs to libraryFiles array if it is new
        let metadataLibraryFile = libraryItem.libraryFiles.find(lf => lf.metadata.path === filePathToPOSIX(metadataFilePath))
        if (storeMetadataWithItem) {
          if (!metadataLibraryFile) {
            const newLibraryFile = new LibraryFile()
            await newLibraryFile.setDataFromPath(metadataFilePath, `metadata.abs`)
            metadataLibraryFile = newLibraryFile.toJSON()
            libraryItem.libraryFiles.push(metadataLibraryFile)
          } else {
            const fileTimestamps = await getFileTimestampsWithIno(metadataFilePath)
            if (fileTimestamps) {
              metadataLibraryFile.metadata.mtimeMs = fileTimestamps.mtimeMs
              metadataLibraryFile.metadata.ctimeMs = fileTimestamps.ctimeMs
              metadataLibraryFile.metadata.size = fileTimestamps.size
              metadataLibraryFile.ino = fileTimestamps.ino
            }
          }
          const libraryItemDirTimestamps = await getFileTimestampsWithIno(libraryItem.path)
          if (libraryItemDirTimestamps) {
            libraryItem.mtime = libraryItemDirTimestamps.mtimeMs
            libraryItem.ctime = libraryItemDirTimestamps.ctimeMs
            let size = 0
            libraryItem.libraryFiles.forEach((lf) => size += (!isNaN(lf.metadata.size) ? Number(lf.metadata.size) : 0))
            libraryItem.size = size
          }
        }

        libraryScan.addLog(LogLevel.DEBUG, `Success saving abmetadata to "${metadataFilePath}"`)
        return metadataLibraryFile
      })
    }
  }

  /**
   * Check authors that were removed from a book and remove them if they no longer have any books
   * keep authors without books that have a asin, description or imagePath
   * @param {string} libraryId 
   * @param {import('./ScanLogger')} scanLogger 
   * @returns {Promise}
   */
  async checkAuthorsRemovedFromBooks(libraryId, scanLogger) {
    const bookAuthorsToRemove = (await Database.authorModel.findAll({
      where: [
        {
          id: scanLogger.authorsRemovedFromBooks,
          asin: {
            [sequelize.Op.or]: [null, ""]
          },
          description: {
            [sequelize.Op.or]: [null, ""]
          },
          imagePath: {
            [sequelize.Op.or]: [null, ""]
          }
        },
        sequelize.where(sequelize.literal('(SELECT count(*) FROM bookAuthors ba WHERE ba.authorId = author.id)'), 0)
      ],
      attributes: ['id'],
      raw: true
    })).map(au => au.id)
    if (bookAuthorsToRemove.length) {
      await Database.authorModel.destroy({
        where: {
          id: bookAuthorsToRemove
        }
      })
      bookAuthorsToRemove.forEach((authorId) => {
        Database.removeAuthorFromFilterData(libraryId, authorId)
        // TODO: Clients were expecting full author in payload but its unnecessary
        SocketAuthority.emitter('author_removed', { id: authorId, libraryId })
      })
      scanLogger.addLog(LogLevel.INFO, `Removed ${bookAuthorsToRemove.length} authors`)
    }
  }

  /**
   * Check series that were removed from books and remove them if they no longer have any books
   * @param {string} libraryId 
   * @param {import('./ScanLogger')} scanLogger 
   * @returns {Promise}
   */
  async checkSeriesRemovedFromBooks(libraryId, scanLogger) {
    const bookSeriesToRemove = (await Database.seriesModel.findAll({
      where: [
        {
          id: scanLogger.seriesRemovedFromBooks
        },
        sequelize.where(sequelize.literal('(SELECT count(*) FROM bookSeries bs WHERE bs.seriesId = series.id)'), 0)
      ],
      attributes: ['id'],
      raw: true
    })).map(se => se.id)
    if (bookSeriesToRemove.length) {
      await Database.seriesModel.destroy({
        where: {
          id: bookSeriesToRemove
        }
      })
      bookSeriesToRemove.forEach((seriesId) => {
        Database.removeSeriesFromFilterData(libraryId, seriesId)
        SocketAuthority.emitter('series_removed', { id: seriesId, libraryId })
      })
      scanLogger.addLog(LogLevel.INFO, `Removed ${bookSeriesToRemove.length} series`)
    }
  }

  /**
   * Search cover provider for matching cover
   * @param {string} libraryItemId 
   * @param {string} libraryItemPath null if book isFile
   * @param {string} title 
   * @param {string} author 
   * @param {LibraryScan} libraryScan 
   * @returns {Promise<string>} path to downloaded cover or null if no cover found
   */
  async searchForCover(libraryItemId, libraryItemPath, title, author, libraryScan) {
    const options = {
      titleDistance: 2,
      authorDistance: 2
    }
    const results = await BookFinder.findCovers(Database.serverSettings.scannerCoverProvider, title, author, options)
    if (results.length) {
      libraryScan.addLog(LogLevel.DEBUG, `Found best cover for "${title}"`)

      // If the first cover result fails, attempt to download the second
      for (let i = 0; i < results.length && i < 2; i++) {

        // Downloads and updates the book cover
        const result = await CoverManager.downloadCoverFromUrlNew(results[i], libraryItemId, libraryItemPath)

        if (result.error) {
          libraryScan.addLog(LogLevel.ERROR, `Failed to download cover from url "${results[i]}" | Attempt ${i + 1}`, result.error)
        } else if (result.cover) {
          return result.cover
        }
      }
    }
    return null
  }
}
module.exports = new BookScanner()