const uuidv4 = require('uuid').v4
const Path = require('path')
const sequelize = require('sequelize')
const { LogLevel } = require('../utils/constants')
const { getTitleIgnorePrefix, areEquivalent } = require('../utils/index')
const parseNameString = require('../utils/parsers/parseNameString')
const parseEbookMetadata = require('../utils/parsers/parseEbookMetadata')
const globals = require('../utils/globals')
const { readTextFile, filePathToPOSIX, getFileTimestampsWithIno } = require('../utils/fileUtils')

const AudioFileScanner = require('./AudioFileScanner')
const Database = require('../Database')
const SocketAuthority = require('../SocketAuthority')
const BookFinder = require('../finders/BookFinder')
const fsExtra = require('../libs/fsExtra')
const EBookFile = require('../objects/files/EBookFile')
const AudioFile = require('../objects/files/AudioFile')
const LibraryFile = require('../objects/files/LibraryFile')

const RssFeedManager = require('../managers/RssFeedManager')
const CoverManager = require('../managers/CoverManager')

const LibraryScan = require('./LibraryScan')
const OpfFileScanner = require('./OpfFileScanner')
const NfoFileScanner = require('./NfoFileScanner')
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
  constructor() {}

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
      media.audioFiles = media.audioFiles.filter((af) => !libraryItemData.checkAudioFileRemoved(af))

      // Update audio files that were modified
      if (libraryItemData.audioLibraryFilesModified.length) {
        let scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(
          existingLibraryItem.mediaType,
          libraryItemData,
          libraryItemData.audioLibraryFilesModified.map((lf) => lf.new)
        )
        media.audioFiles = media.audioFiles.map((audioFileObj) => {
          let matchedScannedAudioFile = scannedAudioFiles.find((saf) => saf.metadata.path === audioFileObj.metadata.path)
          if (!matchedScannedAudioFile) {
            matchedScannedAudioFile = scannedAudioFiles.find((saf) => saf.ino === audioFileObj.ino)
          }

          if (matchedScannedAudioFile) {
            scannedAudioFiles = scannedAudioFiles.filter((saf) => saf !== matchedScannedAudioFile)
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
        if (!media.audioFiles.some((af) => af.ino === audioLibraryFile.ino)) {
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
    if (media.coverPath && libraryItemData.imageLibraryFilesRemoved.some((lf) => lf.metadata.path === media.coverPath) && !(await fsExtra.pathExists(media.coverPath))) {
      media.coverPath = null
      hasMediaChanges = true
    }

    // Update cover if it was modified
    if (media.coverPath && libraryItemData.imageLibraryFilesModified.length) {
      let coverMatch = libraryItemData.imageLibraryFilesModified.find((iFile) => iFile.old.metadata.path === media.coverPath)
      if (coverMatch) {
        const coverPath = coverMatch.new.metadata.path
        if (coverPath !== media.coverPath) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating book cover "${media.coverPath}" => "${coverPath}" for book "${media.title}"`)
          media.coverPath = coverPath
          media.changed('coverPath', true)
          hasMediaChanges = true
        }
      }
    }

    // Check if cover is not set and image files were found
    if (!media.coverPath && libraryItemData.imageLibraryFiles.length) {
      // Prefer using a cover image with the name "cover" otherwise use the first image
      const coverMatch = libraryItemData.imageLibraryFiles.find((iFile) => /\/cover\.[^.\/]*$/.test(iFile.metadata.path))
      media.coverPath = coverMatch?.metadata.path || libraryItemData.imageLibraryFiles[0].metadata.path
      hasMediaChanges = true
    }

    // Check if ebook was removed
    if (media.ebookFile && (librarySettings.audiobooksOnly || libraryItemData.checkEbookFileRemoved(media.ebookFile))) {
      media.ebookFile = null
      hasMediaChanges = true
    }

    // Update ebook if it was modified
    if (media.ebookFile && libraryItemData.ebookLibraryFilesModified.length) {
      let ebookMatch = libraryItemData.ebookLibraryFilesModified.find((eFile) => eFile.old.metadata.path === media.ebookFile.metadata.path)
      if (ebookMatch) {
        const ebookFile = new EBookFile(ebookMatch.new)
        ebookFile.ebookFormat = ebookFile.metadata.ext.slice(1).toLowerCase()
        libraryScan.addLog(LogLevel.DEBUG, `Updating book ebook file "${media.ebookFile.metadata.path}" => "${ebookFile.metadata.path}" for book "${media.title}"`)
        media.ebookFile = ebookFile.toJSON()
        media.changed('ebookFile', true)
        hasMediaChanges = true
      }
    }

    // Check if ebook is not set and ebooks were found
    if (!media.ebookFile && !librarySettings.audiobooksOnly && libraryItemData.ebookLibraryFiles.length) {
      // Prefer to use an epub ebook then fallback to the first ebook found
      let ebookLibraryFile = libraryItemData.ebookLibraryFiles.find((lf) => lf.metadata.ext.slice(1).toLowerCase() === 'epub')
      if (!ebookLibraryFile) ebookLibraryFile = libraryItemData.ebookLibraryFiles[0]
      ebookLibraryFile = ebookLibraryFile.toJSON()
      // Ebook file is the same as library file except for additional `ebookFormat`
      ebookLibraryFile.ebookFormat = ebookLibraryFile.metadata.ext.slice(1).toLowerCase()
      media.ebookFile = ebookLibraryFile
      media.changed('ebookFile', true)
      hasMediaChanges = true
    }

    const ebookFileScanData = await parseEbookMetadata.parse(media.ebookFile)

    const bookMetadata = await this.getBookMetadataFromScanData(media.audioFiles, ebookFileScanData, libraryItemData, libraryScan, librarySettings, existingLibraryItem.id)
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
          if (!media.authors.some((au) => au.name === authorName)) {
            const existingAuthorId = await Database.getAuthorIdByName(libraryItemData.libraryId, authorName)
            if (existingAuthorId) {
              await Database.bookAuthorModel.create({
                bookId: media.id,
                authorId: existingAuthorId
              })
              libraryScan.addLog(LogLevel.DEBUG, `Updating book "${bookMetadata.title}" added author "${authorName}"`)
              authorsUpdated = true
            } else {
              const newAuthor = await Database.authorModel.create({
                name: authorName,
                lastFirst: Database.authorModel.getLastFirst(authorName),
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
          const existingBookSeries = media.series.find((se) => se.name === seriesObj.name)
          if (!existingBookSeries) {
            const existingSeriesId = await Database.getSeriesIdByName(libraryItemData.libraryId, seriesObj.name)
            if (existingSeriesId) {
              await Database.bookSeriesModel.create({
                bookId: media.id,
                seriesId: existingSeriesId,
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
          } else if (seriesObj.sequence && existingBookSeries.bookSeries.sequence !== seriesObj.sequence) {
            libraryScan.addLog(LogLevel.DEBUG, `Updating book "${bookMetadata.title}" series "${seriesObj.name}" sequence "${existingBookSeries.bookSeries.sequence || ''}" => "${seriesObj.sequence}"`)
            seriesUpdated = true
            existingBookSeries.bookSeries.sequence = seriesObj.sequence
            await existingBookSeries.bookSeries.save()
          }
        }
        // Check for series removed
        for (const series of media.series) {
          if (!bookMetadata.series.some((se) => se.name === series.name)) {
            await series.bookSeries.destroy()
            libraryScan.addLog(LogLevel.DEBUG, `Updating book "${bookMetadata.title}" removed series "${series.name}"`)
            seriesUpdated = true
            bookSeriesRemoved.push(series.id)
          }
        }
      } else if (key === 'genres') {
        const existingGenres = media.genres || []
        if (bookMetadata.genres.some((g) => !existingGenres.includes(g)) || existingGenres.some((g) => !bookMetadata.genres.includes(g))) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating book genres "${existingGenres.join(',')}" => "${bookMetadata.genres.join(',')}" for book "${bookMetadata.title}"`)
          media.genres = bookMetadata.genres
          hasMediaChanges = true
        }
      } else if (key === 'tags') {
        const existingTags = media.tags || []
        if (bookMetadata.tags.some((t) => !existingTags.includes(t)) || existingTags.some((t) => !bookMetadata.tags.includes(t))) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating book tags "${existingTags.join(',')}" => "${bookMetadata.tags.join(',')}" for book "${bookMetadata.title}"`)
          media.tags = bookMetadata.tags
          hasMediaChanges = true
        }
      } else if (key === 'narrators') {
        const existingNarrators = media.narrators || []
        if (bookMetadata.narrators.some((t) => !existingNarrators.includes(t)) || existingNarrators.some((t) => !bookMetadata.narrators.includes(t))) {
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
        order: [sequelize.literal(`bookAuthor.createdAt ASC`)]
      })
    }
    if (seriesUpdated) {
      media.series = await media.getSeries({
        joinTableAttributes: ['sequence', 'createdAt'],
        order: [sequelize.literal(`bookSeries.createdAt ASC`)]
      })
    }

    // If no cover then extract cover from audio file OR from ebook
    const libraryItemDir = existingLibraryItem.isFile ? null : existingLibraryItem.path
    if (!media.coverPath) {
      let extractedCoverPath = await CoverManager.saveEmbeddedCoverArt(media.audioFiles, existingLibraryItem.id, libraryItemDir)
      if (extractedCoverPath) {
        libraryScan.addLog(LogLevel.DEBUG, `Updating book "${bookMetadata.title}" extracted embedded cover art from audio file to path "${extractedCoverPath}"`)
        media.coverPath = extractedCoverPath
        hasMediaChanges = true
      } else if (ebookFileScanData?.ebookCoverPath) {
        extractedCoverPath = await CoverManager.saveEbookCoverArt(ebookFileScanData, existingLibraryItem.id, libraryItemDir)
        if (extractedCoverPath) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating book "${bookMetadata.title}" extracted embedded cover art from ebook file to path "${extractedCoverPath}"`)
          media.coverPath = extractedCoverPath
          hasMediaChanges = true
        }
      }
    }

    // If no cover then search for cover if enabled in server settings
    if (!media.coverPath && Database.serverSettings.scannerFindCovers) {
      const authorName = media.authors
        .map((au) => au.name)
        .filter((au) => au)
        .join(', ')
      const coverPath = await this.searchForCover(existingLibraryItem.id, libraryItemDir, media.title, authorName, libraryScan)
      if (coverPath) {
        media.coverPath = coverPath
        hasMediaChanges = true
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
    let ebookLibraryFile = librarySettings.audiobooksOnly ? null : libraryItemData.ebookLibraryFiles.find((lf) => lf.metadata.ext.slice(1).toLowerCase() === 'epub') || libraryItemData.ebookLibraryFiles[0]

    // Do not add library items that have no valid audio files and no ebook file
    if (!ebookLibraryFile && !scannedAudioFiles.length) {
      libraryScan.addLog(LogLevel.WARN, `Library item at path "${libraryItemData.relPath}" has no audio files and no ebook file - ignoring`)
      return null
    }

    let ebookFileScanData = null
    if (ebookLibraryFile) {
      ebookLibraryFile = ebookLibraryFile.toJSON()
      ebookLibraryFile.ebookFormat = ebookLibraryFile.metadata.ext.slice(1).toLowerCase()
      ebookFileScanData = await parseEbookMetadata.parse(ebookLibraryFile)
    }

    const bookMetadata = await this.getBookMetadataFromScanData(scannedAudioFiles, ebookFileScanData, libraryItemData, libraryScan, librarySettings)
    bookMetadata.explicit = !!bookMetadata.explicit // Ensure boolean
    bookMetadata.abridged = !!bookMetadata.abridged // Ensure boolean

    let duration = 0
    scannedAudioFiles.forEach((af) => (duration += !isNaN(af.duration) ? Number(af.duration) : 0))
    const bookObject = {
      ...bookMetadata,
      audioFiles: scannedAudioFiles,
      ebookFile: ebookLibraryFile || null,
      duration,
      bookAuthors: [],
      bookSeries: []
    }

    const createdAtTimestamp = new Date().getTime()
    if (bookMetadata.authors.length) {
      for (const authorName of bookMetadata.authors) {
        const matchingAuthorId = await Database.getAuthorIdByName(libraryItemData.libraryId, authorName)
        if (matchingAuthorId) {
          bookObject.bookAuthors.push({
            authorId: matchingAuthorId
          })
        } else {
          // New author
          bookObject.bookAuthors.push({
            // Ensures authors are in a set order
            createdAt: createdAtTimestamp + bookObject.bookAuthors.length,
            author: {
              libraryId: libraryItemData.libraryId,
              name: authorName,
              lastFirst: Database.authorModel.getLastFirst(authorName)
            }
          })
        }
      }
    }
    if (bookMetadata.series.length) {
      for (const seriesObj of bookMetadata.series) {
        if (!seriesObj.name) continue
        const matchingSeriesId = await Database.getSeriesIdByName(libraryItemData.libraryId, seriesObj.name)
        if (matchingSeriesId) {
          bookObject.bookSeries.push({
            seriesId: matchingSeriesId,
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
    libraryItemObj.title = bookMetadata.title
    libraryItemObj.titleIgnorePrefix = getTitleIgnorePrefix(bookMetadata.title)
    libraryItemObj.authorNamesFirstLast = bookMetadata.authors.join(', ')
    libraryItemObj.authorNamesLastFirst = bookMetadata.authors.map((author) => Database.authorModel.getLastFirst(author)).join(', ')

    // Set isSupplementary flag on ebook library files
    for (const libraryFile of libraryItemObj.libraryFiles) {
      if (globals.SupportedEbookTypes.includes(libraryFile.metadata.ext.slice(1).toLowerCase())) {
        libraryFile.isSupplementary = libraryFile.ino !== ebookLibraryFile?.ino
      }
    }

    // If cover was not found in folder then check embedded covers in audio files OR ebook file
    const libraryItemDir = libraryItemObj.isFile ? null : libraryItemObj.path
    if (!bookObject.coverPath) {
      let extractedCoverPath = await CoverManager.saveEmbeddedCoverArt(scannedAudioFiles, libraryItemObj.id, libraryItemDir)
      if (extractedCoverPath) {
        libraryScan.addLog(LogLevel.DEBUG, `Extracted embedded cover from audio file at "${extractedCoverPath}" for book "${bookObject.title}"`)
        bookObject.coverPath = extractedCoverPath
      } else if (ebookFileScanData?.ebookCoverPath) {
        extractedCoverPath = await CoverManager.saveEbookCoverArt(ebookFileScanData, libraryItemObj.id, libraryItemDir)
        if (extractedCoverPath) {
          libraryScan.addLog(LogLevel.DEBUG, `Extracted embedded cover from ebook file at "${extractedCoverPath}" for book "${bookObject.title}"`)
          bookObject.coverPath = extractedCoverPath
        }
      }
    }

    // If cover not found then search for cover if enabled in settings
    if (!bookObject.coverPath && Database.serverSettings.scannerFindCovers) {
      const authorName = bookMetadata.authors.join(', ')
      bookObject.coverPath = await this.searchForCover(libraryItemObj.id, libraryItemDir, bookObject.title, authorName, libraryScan)
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

    const publishedYear = libraryItem.book.publishedYear
    const decade = publishedYear ? `${Math.floor(publishedYear / 10) * 10}` : null
    Database.addPublishedDecadeToFilterData(libraryItemData.libraryId, decade)

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
   * @param {import('../utils/parsers/parseEbookMetadata').EBookFileScanData} ebookFileScanData
   * @param {import('./LibraryItemScanData')} libraryItemData
   * @param {LibraryScan} libraryScan
   * @param {import('../models/Library').LibrarySettingsObject} librarySettings
   * @param {string} [existingLibraryItemId]
   * @returns {Promise<BookMetadataObject>}
   */
  async getBookMetadataFromScanData(audioFiles, ebookFileScanData, libraryItemData, libraryScan, librarySettings, existingLibraryItemId = null) {
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

    const bookMetadataSourceHandler = new BookScanner.BookMetadataSourceHandler(bookMetadata, audioFiles, ebookFileScanData, libraryItemData, libraryScan, existingLibraryItemId)
    const metadataPrecedence = librarySettings.metadataPrecedence || Database.libraryModel.defaultMetadataPrecedence
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
      const coverMatch = libraryItemData.imageLibraryFiles.find((iFile) => /\/cover\.[^.\/]*$/.test(iFile.metadata.path))
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
     * @param {import('../utils/parsers/parseEbookMetadata').EBookFileScanData} ebookFileScanData
     * @param {import('./LibraryItemScanData')} libraryItemData
     * @param {LibraryScan} libraryScan
     * @param {string} existingLibraryItemId
     */
    constructor(bookMetadata, audioFiles, ebookFileScanData, libraryItemData, libraryScan, existingLibraryItemId) {
      this.bookMetadata = bookMetadata
      this.audioFiles = audioFiles
      this.ebookFileScanData = ebookFileScanData
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
     * Metadata from audio file meta tags OR metadata from ebook file
     */
    audioMetatags() {
      if (this.audioFiles.length) {
        // Modifies bookMetadata with metadata mapped from audio file meta tags
        const bookTitle = this.bookMetadata.title || this.libraryItemData.mediaMetadata.title
        AudioFileScanner.setBookMetadataFromAudioMetaTags(bookTitle, this.audioFiles, this.bookMetadata, this.libraryScan)
      } else if (this.ebookFileScanData) {
        const ebookMetdataObject = this.ebookFileScanData.metadata || {}
        for (const key in ebookMetdataObject) {
          if (key === 'tags') {
            if (ebookMetdataObject.tags.length) {
              this.bookMetadata.tags = ebookMetdataObject.tags
            }
          } else if (key === 'genres') {
            if (ebookMetdataObject.genres.length) {
              this.bookMetadata.genres = ebookMetdataObject.genres
            }
          } else if (key === 'authors') {
            if (ebookMetdataObject.authors?.length) {
              this.bookMetadata.authors = ebookMetdataObject.authors
            }
          } else if (key === 'narrators') {
            if (ebookMetdataObject.narrators?.length) {
              this.bookMetadata.narrators = ebookMetdataObject.narrators
            }
          } else if (key === 'series') {
            if (ebookMetdataObject.series?.length) {
              this.bookMetadata.series = ebookMetdataObject.series
            }
          } else if (ebookMetdataObject[key] && key !== 'sequence') {
            this.bookMetadata[key] = ebookMetdataObject[key]
          }
        }
      }
      return null
    }

    /**
     * Metadata from .nfo file
     */
    async nfoFile() {
      if (!this.libraryItemData.metadataNfoLibraryFile) return
      await NfoFileScanner.scanBookNfoFile(this.libraryItemData.metadataNfoLibraryFile, this.bookMetadata)
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
     * Metadata from metadata.json
     */
    async absMetadata() {
      // If metadata.json use this for metadata
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

    const metadataFilePath = Path.join(metadataPath, `metadata.${global.ServerSettings.metadataFileFormat}`)

    const jsonObject = {
      tags: libraryItem.media.tags || [],
      chapters: libraryItem.media.chapters?.map((c) => ({ ...c })) || [],
      title: libraryItem.media.title,
      subtitle: libraryItem.media.subtitle,
      authors: libraryItem.media.authors.map((a) => a.name),
      narrators: libraryItem.media.narrators,
      series: libraryItem.media.series.map((se) => {
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
    return fsExtra
      .writeFile(metadataFilePath, JSON.stringify(jsonObject, null, 2))
      .then(async () => {
        // Add metadata.json to libraryFiles array if it is new
        let metadataLibraryFile = libraryItem.libraryFiles.find((lf) => lf.metadata.path === filePathToPOSIX(metadataFilePath))
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
            libraryItem.libraryFiles.forEach((lf) => (size += !isNaN(lf.metadata.size) ? Number(lf.metadata.size) : 0))
            libraryItem.size = size
          }
        }

        libraryScan.addLog(LogLevel.DEBUG, `Success saving abmetadata to "${metadataFilePath}"`)

        return metadataLibraryFile
      })
      .catch((error) => {
        libraryScan.addLog(LogLevel.ERROR, `Failed to save json file at "${metadataFilePath}"`, error)
        return null
      })
  }

  /**
   * Check authors that were removed from a book and remove them if they no longer have any books
   * keep authors without books that have a asin, description or imagePath
   * @param {string} libraryId
   * @param {import('./ScanLogger')} scanLogger
   * @returns {Promise}
   */
  async checkAuthorsRemovedFromBooks(libraryId, scanLogger) {
    const bookAuthorsToRemove = (
      await Database.authorModel.findAll({
        where: [
          {
            id: scanLogger.authorsRemovedFromBooks,
            asin: {
              [sequelize.Op.or]: [null, '']
            },
            description: {
              [sequelize.Op.or]: [null, '']
            },
            imagePath: {
              [sequelize.Op.or]: [null, '']
            }
          },
          sequelize.where(sequelize.literal('(SELECT count(*) FROM bookAuthors ba WHERE ba.authorId = author.id)'), 0)
        ],
        attributes: ['id'],
        raw: true
      })
    ).map((au) => au.id)
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
    const bookSeriesToRemove = (
      await Database.seriesModel.findAll({
        where: [
          {
            id: scanLogger.seriesRemovedFromBooks
          },
          sequelize.where(sequelize.literal('(SELECT count(*) FROM bookSeries bs WHERE bs.seriesId = series.id)'), 0)
        ],
        attributes: ['id'],
        raw: true
      })
    ).map((se) => se.id)
    if (bookSeriesToRemove.length) {
      await Database.seriesModel.destroy({
        where: {
          id: bookSeriesToRemove
        }
      })
      // Close any open feeds for series
      await RssFeedManager.closeFeedsForEntityIds(bookSeriesToRemove)

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
