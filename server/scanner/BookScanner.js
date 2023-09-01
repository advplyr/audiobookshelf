const uuidv4 = require("uuid").v4
const { LogLevel } = require('../utils/constants')
const { getTitleIgnorePrefix } = require('../utils/index')
const { parseOpfMetadataXML } = require('../utils/parsers/parseOpfMetadata')
const { parseOverdriveMediaMarkersAsChapters } = require('../utils/parsers/parseOverdriveMediaMarkers')
const abmetadataGenerator = require('../utils/generators/abmetadataGenerator')
const parseNameString = require('../utils/parsers/parseNameString')
const AudioFileScanner = require('./AudioFileScanner')
const Database = require('../Database')
const { readTextFile } = require('../utils/fileUtils')
const AudioFile = require('../objects/files/AudioFile')
const CoverManager = require('../managers/CoverManager')

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
   * 
   * @param {import('./LibraryItemScanData')} libraryItemData 
   * @param {import('./LibraryScan')} libraryScan 
   * @returns {import('../models/LibraryItem')}
   */
  async scanNewBookLibraryItem(libraryItemData, libraryScan) {
    // Scan audio files found
    let scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(libraryScan.libraryMediaType, libraryItemData, libraryItemData.audioLibraryFiles)
    scannedAudioFiles = AudioFileScanner.runSmartTrackOrder(libraryItemData.relPath, scannedAudioFiles)

    // Find ebook file (prefer epub)
    let ebookLibraryFile = libraryItemData.ebookLibraryFiles.find(lf => lf.metadata.ext.slice(1).toLowerCase() === 'epub') || libraryItemData.ebookLibraryFiles[0]

    // Do not add library items that have no valid audio files and no ebook file
    if (!ebookLibraryFile && !scannedAudioFiles.length) {
      libraryScan.addLog(LogLevel.WARN, `Library item at path "${libraryItemData.relPath}" has no audio files and no ebook file - ignoring`)
      return null
    }

    if (ebookLibraryFile) {
      ebookLibraryFile.ebookFormat = ebookLibraryFile.metadata.ext.slice(1).toLowerCase()
    }

    const bookMetadata = await this.getBookMetadataFromScanData(scannedAudioFiles, libraryItemData, libraryScan)

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
        const matchingAuthor = Database.libraryFilterData[libraryScan.libraryId].authors.find(au => au.name === authorName)
        if (matchingAuthor) {
          bookObject.bookAuthors.push({
            authorId: matchingAuthor.id
          })
        } else {
          // New author
          bookObject.bookAuthors.push({
            author: {
              libraryId: libraryScan.libraryId,
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
        const matchingSeries = Database.libraryFilterData[libraryScan.libraryId].series.find(se => se.name === seriesObj.name)
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
              libraryId: libraryScan.libraryId
            }
          })
        }
      }
    }

    const libraryItemObj = libraryItemData.libraryItemObject
    libraryItemObj.id = uuidv4() // Generate library item id ahead of time to use for saving extracted cover image

    // If cover was not found in folder then check embedded covers in audio files
    if (!bookObject.coverPath && scannedAudioFiles.length) {
      const libraryItemDir = libraryItemObj.isFile ? null : libraryItemObj.path
      // Extract and save embedded cover art
      bookObject.coverPath = await CoverManager.saveEmbeddedCoverArtNew(scannedAudioFiles, libraryItemObj.id, libraryItemDir)
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
          Database.addSeriesToFilterData(libraryScan.libraryId, bs.series.name, bs.series.id)
        }
      }
    }
    if (libraryItem.book.bookAuthors?.length) {
      for (const ba of libraryItem.book.bookAuthors) {
        if (ba.author) {
          Database.addAuthorToFilterData(libraryScan.libraryId, ba.author.name, ba.author.id)
        }
      }
    }
    Database.addNarratorsToFilterData(libraryScan.libraryId, libraryItem.book.narrators)
    Database.addGenresToFilterData(libraryScan.libraryId, libraryItem.book.genres)
    Database.addTagsToFilterData(libraryScan.libraryId, libraryItem.book.tags)
    Database.addPublisherToFilterData(libraryScan.libraryId, libraryItem.book.publisher)
    Database.addLanguageToFilterData(libraryScan.libraryId, libraryItem.book.language)

    return libraryItem
  }

  /**
   * 
   * @param {import('../objects/files/AudioFile')[]} scannedAudioFiles 
   * @param {import('./LibraryItemScanData')} libraryItemData 
   * @param {import('./LibraryScan')} libraryScan 
   * @returns {Promise<BookMetadataObject>}
   */
  async getBookMetadataFromScanData(scannedAudioFiles, libraryItemData, libraryScan) {
    // First set book metadata from folder/file names
    const bookMetadata = {
      title: libraryItemData.mediaMetadata.title,
      titleIgnorePrefix: getTitleIgnorePrefix(libraryItemData.mediaMetadata.title),
      subtitle: libraryItemData.mediaMetadata.subtitle,
      publishedYear: libraryItemData.mediaMetadata.publishedYear,
      publisher: null,
      description: null,
      isbn: null,
      asin: null,
      language: null,
      narrators: parseNameString.parse(libraryItemData.mediaMetadata.narrators)?.names || [],
      genres: [],
      tags: [],
      authors: parseNameString.parse(libraryItemData.mediaMetadata.author)?.names || [],
      series: [],
      chapters: [],
      explicit: false,
      abridged: false,
      coverPath: null
    }
    if (libraryItemData.mediaMetadata.series) {
      bookMetadata.series.push({
        name: libraryItemData.mediaMetadata.series,
        sequence: libraryItemData.mediaMetadata.sequence || null
      })
    }

    // Fill in or override book metadata from audio file meta tags
    if (scannedAudioFiles.length) {
      const MetadataMapArray = [
        {
          tag: 'tagComposer',
          key: 'narrators'
        },
        {
          tag: 'tagDescription',
          altTag: 'tagComment',
          key: 'description'
        },
        {
          tag: 'tagPublisher',
          key: 'publisher'
        },
        {
          tag: 'tagDate',
          key: 'publishedYear'
        },
        {
          tag: 'tagSubtitle',
          key: 'subtitle'
        },
        {
          tag: 'tagAlbum',
          altTag: 'tagTitle',
          key: 'title',
        },
        {
          tag: 'tagArtist',
          altTag: 'tagAlbumArtist',
          key: 'authors'
        },
        {
          tag: 'tagGenre',
          key: 'genres'
        },
        {
          tag: 'tagSeries',
          key: 'series'
        },
        {
          tag: 'tagIsbn',
          key: 'isbn'
        },
        {
          tag: 'tagLanguage',
          key: 'language'
        },
        {
          tag: 'tagASIN',
          key: 'asin'
        }
      ]
      const overrideExistingDetails = Database.serverSettings.scannerPreferAudioMetadata
      const firstScannedFile = scannedAudioFiles[0]
      const audioFileMetaTags = firstScannedFile.metaTags
      MetadataMapArray.forEach((mapping) => {
        let value = audioFileMetaTags[mapping.tag]
        if (!value && mapping.altTag) {
          value = audioFileMetaTags[mapping.altTag]
        }

        if (value && typeof value === 'string') {
          value = value.trim() // Trim whitespace

          if (mapping.key === 'narrators' && (!bookMetadata.narrators.length || overrideExistingDetails)) {
            bookMetadata.narrators = parseNameString.parse(value)?.names || []
          } else if (mapping.key === 'authors' && (!bookMetadata.authors.length || overrideExistingDetails)) {
            bookMetadata.authors = parseNameString.parse(value)?.names || []
          } else if (mapping.key === 'genres' && (!bookMetadata.genres.length || overrideExistingDetails)) {
            bookMetadata.genres = this.parseGenresString(value)
          } else if (mapping.key === 'series' && (!bookMetadata.series.length || overrideExistingDetails)) {
            bookMetadata.series = [
              {
                name: value,
                sequence: audioFileMetaTags.tagSeriesPart || null
              }
            ]
          } else if (!bookMetadata[mapping.key] || overrideExistingDetails) {
            bookMetadata[mapping.key] = value
          }
        }
      })
    }

    // If desc.txt in library item folder then use this for description
    if (libraryItemData.descTxtLibraryFile) {
      const description = await readTextFile(libraryItemData.descTxtLibraryFile.metadata.path)
      if (description.trim()) bookMetadata.description = description.trim()
    }

    // If reader.txt in library item folder then use this for narrator
    if (libraryItemData.readerTxtLibraryFile) {
      let narrator = await readTextFile(libraryItemData.readerTxtLibraryFile.metadata.path)
      narrator = narrator.split(/\r?\n/)[0]?.trim() || '' // Only use first line
      if (narrator) {
        bookMetadata.narrators = parseNameString.parse(narrator)?.names || []
      }
    }

    // If opf file is found look for metadata
    if (libraryItemData.metadataOpfLibraryFile) {
      const xmlText = await readTextFile(libraryItemData.metadataOpfLibraryFile.metadata.path)
      const opfMetadata = xmlText ? await parseOpfMetadataXML(xmlText) : null
      if (opfMetadata) {
        const opfMetadataOverrideDetails = Database.serverSettings.scannerPreferOpfMetadata
        for (const key in opfMetadata) {
          if (key === 'tags') { // Add tags only if tags are empty
            if (opfMetadata.tags.length && (!bookMetadata.tags.length || opfMetadataOverrideDetails)) {
              bookMetadata.tags = opfMetadata.tags
            }
          } else if (key === 'genres') { // Add genres only if genres are empty
            if (opfMetadata.genres.length && (!bookMetadata.genres.length || opfMetadataOverrideDetails)) {
              bookMetadata.genres = opfMetadata.genres
            }
          } else if (key === 'authors') {
            if (opfMetadata.authors?.length && (!bookMetadata.authors.length || opfMetadataOverrideDetails)) {
              bookMetadata.authors = opfMetadata.authors
            }
          } else if (key === 'narrators') {
            if (opfMetadata.narrators?.length && (!bookMetadata.narrators.length || opfMetadataOverrideDetails)) {
              bookMetadata.narrators = opfMetadata.narrators
            }
          } else if (key === 'series') {
            if (opfMetadata.series && (!bookMetadata.series.length || opfMetadataOverrideDetails)) {
              bookMetadata.series = [{
                name: opfMetadata.series,
                sequence: opfMetadata.sequence || null
              }]
            }
          } else if (opfMetadata[key] && (!bookMetadata[key] || opfMetadataOverrideDetails)) {
            bookMetadata[key] = opfMetadata[key]
          }
        }
      }
    }

    // If metadata.json or metadata.abs use this for metadata
    const metadataLibraryFile = libraryItemData.metadataJsonLibraryFile || libraryItemData.metadataAbsLibraryFile
    const metadataText = metadataLibraryFile ? await readTextFile(metadataLibraryFile.metadata.path) : null
    if (metadataText) {
      libraryScan.addLog(LogLevel.INFO, `Found metadata file "${metadataLibraryFile.metadata.relPath}" - preferring`)
      let abMetadata = null
      if (!!libraryItemData.metadataJsonLibraryFile) {
        abMetadata = abmetadataGenerator.parseJson(metadataText)
      } else {
        abMetadata = abmetadataGenerator.parse(metadataText, 'book')
      }

      if (abMetadata) {
        if (abMetadata.tags?.length) {
          bookMetadata.tags = abMetadata.tags
        }
        if (abMetadata.chapters?.length) {
          bookMetadata.chapters = abMetadata.chapters
        }
        for (const key in abMetadata.metadata) {
          if (bookMetadata[key] === undefined || abMetadata.metadata[key] === undefined) continue
          bookMetadata[key] = abMetadata.metadata[key]
        }
      }
    }

    // Set chapters from audio files if not already set
    if (!bookMetadata.chapters.length) {
      bookMetadata.chapters = this.getChaptersFromAudioFiles(bookMetadata.title, scannedAudioFiles, libraryScan)
    }

    // Set cover from library file if one is found otherwise check audiofile
    if (libraryItemData.imageLibraryFiles.length) {
      const coverMatch = libraryItemData.imageLibraryFiles.find(iFile => /\/cover\.[^.\/]*$/.test(iFile.metadata.path))
      bookMetadata.coverPath = coverMatch?.metadata.path || libraryItemData.imageLibraryFiles[0].metadata.path
    }

    return bookMetadata
  }

  /**
   * Parse a genre string into multiple genres
   * @example "Fantasy;Sci-Fi;History" => ["Fantasy", "Sci-Fi", "History"]
   * @param {string} genreTag 
   * @returns {string[]}
   */
  parseGenresString(genreTag) {
    if (!genreTag?.length) return []
    const separators = ['/', '//', ';']
    for (let i = 0; i < separators.length; i++) {
      if (genreTag.includes(separators[i])) {
        return genreTag.split(separators[i]).map(genre => genre.trim()).filter(g => !!g)
      }
    }
    return [genreTag]
  }

  /**
   * @param {string} bookTitle
   * @param {AudioFile[]} audioFiles 
   * @param {import('./LibraryScan')} libraryScan
   * @returns {import('../models/Book').ChapterObject[]}
   */
  getChaptersFromAudioFiles(bookTitle, audioFiles, libraryScan) {
    if (!audioFiles.length) return []

    // If overdrive media markers are present and preferred, use those instead
    if (Database.serverSettings.scannerPreferOverdriveMediaMarker) {
      const overdriveChapters = parseOverdriveMediaMarkersAsChapters(audioFiles)
      if (overdriveChapters) {
        libraryScan.addLog(LogLevel.DEBUG, 'Overdrive Media Markers and preference found! Using these for chapter definitions')

        return overdriveChapters
      }
    }

    let chapters = []

    // If first audio file has embedded chapters then use embedded chapters
    if (audioFiles[0].chapters?.length) {
      // If all files chapters are the same, then only make chapters for the first file
      if (
        audioFiles.length === 1 ||
        audioFiles.length > 1 &&
        audioFiles[0].chapters.length === audioFiles[1].chapters?.length &&
        audioFiles[0].chapters.every((c, i) => c.title === audioFiles[1].chapters[i].title)
      ) {
        libraryScan.addLog(LogLevel.DEBUG, `setChapters: Using embedded chapters in first audio file ${audioFiles[0].metadata?.path}`)
        chapters = audioFiles[0].chapters.map((c) => ({ ...c }))
      } else {
        libraryScan.addLog(LogLevel.DEBUG, `setChapters: Using embedded chapters from all audio files ${audioFiles[0].metadata?.path}`)
        let currChapterId = 0
        let currStartTime = 0

        audioFiles.forEach((file) => {
          if (file.duration) {
            const afChapters = file.chapters?.map((c) => ({
              ...c,
              id: c.id + currChapterId,
              start: c.start + currStartTime,
              end: c.end + currStartTime,
            })) ?? []
            chapters = chapters.concat(afChapters)

            currChapterId += file.chapters?.length ?? 0
            currStartTime += file.duration
          }
        })
        return chapters
      }
    } else if (audioFiles.length > 1) {
      const preferAudioMetadata = !!Database.serverSettings.scannerPreferAudioMetadata

      // Build chapters from audio files
      let currChapterId = 0
      let currStartTime = 0
      includedAudioFiles.forEach((file) => {
        if (file.duration) {
          let title = file.metadata.filename ? Path.basename(file.metadata.filename, Path.extname(file.metadata.filename)) : `Chapter ${currChapterId}`

          // When prefer audio metadata server setting is set then use ID3 title tag as long as it is not the same as the book title
          if (preferAudioMetadata && file.metaTags?.tagTitle && file.metaTags?.tagTitle !== bookTitle) {
            title = file.metaTags.tagTitle
          }

          chapters.push({
            id: currChapterId++,
            start: currStartTime,
            end: currStartTime + file.duration,
            title
          })
          currStartTime += file.duration
        }
      })
    }
    return chapters
  }
}
module.exports = new BookScanner()