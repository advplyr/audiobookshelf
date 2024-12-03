const Path = require('path')
const Logger = require('../Logger')
const prober = require('../utils/prober')
const { LogLevel } = require('../utils/constants')
const { parseOverdriveMediaMarkersAsChapters } = require('../utils/parsers/parseOverdriveMediaMarkers')
const parseNameString = require('../utils/parsers/parseNameString')
const parseSeriesString = require('../utils/parsers/parseSeriesString')
const LibraryItem = require('../models/LibraryItem')
const AudioFile = require('../objects/files/AudioFile')

class AudioFileScanner {
  constructor() {}

  /**
   * Is array of numbers sequential, i.e. 1, 2, 3, 4
   * @param {number[]} nums
   * @returns {boolean}
   */
  isSequential(nums) {
    if (!nums?.length) return false
    if (nums.length === 1) return true
    let prev = nums[0]
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - prev > 1) return false
      prev = nums[i]
    }
    return true
  }

  /**
   * Remove
   * @param {number[]} nums
   * @returns {number[]}
   */
  removeDupes(nums) {
    if (!nums || !nums.length) return []
    if (nums.length === 1) return nums

    let nodupes = [nums[0]]
    nums.forEach((num) => {
      if (num > nodupes[nodupes.length - 1]) nodupes.push(num)
    })
    return nodupes
  }

  /**
   * Order audio files by track/disc number
   * @param {string} libraryItemRelPath
   * @param {import('../models/Book').AudioFileObject[]} audioFiles
   * @returns {import('../models/Book').AudioFileObject[]}
   */
  runSmartTrackOrder(libraryItemRelPath, audioFiles) {
    if (!audioFiles.length) return []

    let discsFromFilename = []
    let tracksFromFilename = []
    let discsFromMeta = []
    let tracksFromMeta = []

    audioFiles.forEach((af) => {
      if (af.discNumFromFilename !== null) discsFromFilename.push(af.discNumFromFilename)
      if (af.discNumFromMeta !== null) discsFromMeta.push(af.discNumFromMeta)
      if (af.trackNumFromFilename !== null) tracksFromFilename.push(af.trackNumFromFilename)
      if (af.trackNumFromMeta !== null) tracksFromMeta.push(af.trackNumFromMeta)
    })
    discsFromFilename.sort((a, b) => a - b)
    discsFromMeta.sort((a, b) => a - b)
    tracksFromFilename.sort((a, b) => a - b)
    tracksFromMeta.sort((a, b) => a - b)

    let discKey = null
    if (discsFromMeta.length === audioFiles.length && this.isSequential(discsFromMeta)) {
      discKey = 'discNumFromMeta'
    } else if (discsFromFilename.length === audioFiles.length && this.isSequential(discsFromFilename)) {
      discKey = 'discNumFromFilename'
    }

    let trackKey = null
    tracksFromFilename = this.removeDupes(tracksFromFilename)
    tracksFromMeta = this.removeDupes(tracksFromMeta)
    if (tracksFromFilename.length > tracksFromMeta.length) {
      trackKey = 'trackNumFromFilename'
    } else {
      trackKey = 'trackNumFromMeta'
    }

    if (discKey !== null) {
      Logger.debug(`[AudioFileScanner] Smart track order for "${libraryItemRelPath}" using disc key ${discKey} and track key ${trackKey}`)
      audioFiles.sort((a, b) => {
        let Dx = a[discKey] - b[discKey]
        if (Dx === 0) Dx = a[trackKey] - b[trackKey]
        return Dx
      })
    } else {
      Logger.debug(`[AudioFileScanner] Smart track order for "${libraryItemRelPath}" using track key ${trackKey}`)
      audioFiles.sort((a, b) => a[trackKey] - b[trackKey])
    }

    for (let i = 0; i < audioFiles.length; i++) {
      audioFiles[i].index = i + 1
    }
    return audioFiles
  }

  /**
   * Get track and disc number from audio filename
   * @param {{title:string, subtitle:string, series:string, sequence:string, publishedYear:string, narrators:string}} mediaMetadataFromScan
   * @param {LibraryItem.LibraryFileObject} audioLibraryFile
   * @returns {{trackNumber:number, discNumber:number}}
   */
  getTrackAndDiscNumberFromFilename(mediaMetadataFromScan, audioLibraryFile) {
    const { title, author, series, publishedYear } = mediaMetadataFromScan
    const { filename, path } = audioLibraryFile.metadata
    let partbasename = Path.basename(filename, Path.extname(filename))

    // Remove title, author, series, and publishedYear from filename if there
    if (title) partbasename = partbasename.replace(title, '')
    if (author) partbasename = partbasename.replace(author, '')
    if (series) partbasename = partbasename.replace(series, '')
    if (publishedYear) partbasename = partbasename.replace(publishedYear)

    // Look for disc number
    let discNumber = null
    const discMatch = partbasename.match(/\b(disc|cd) ?(\d\d?)\b/i)
    if (discMatch && discMatch.length > 2 && discMatch[2]) {
      if (!isNaN(discMatch[2])) {
        discNumber = Number(discMatch[2])
      }

      // Remove disc number from filename
      partbasename = partbasename.replace(/\b(disc|cd) ?(\d\d?)\b/i, '')
    }

    // Look for disc number in folder path e.g. /Book Title/CD01/audiofile.mp3
    const pathdir = Path.dirname(path).split('/').pop()
    if (pathdir && /^(cd|dis[ck])\s*\d{1,3}$/i.test(pathdir)) {
      const discFromFolder = Number(pathdir.replace(/^(cd|dis[ck])\s*/i, ''))
      if (!isNaN(discFromFolder) && discFromFolder !== null) discNumber = discFromFolder
    }

    const numbersinpath = partbasename.match(/\d{1,4}/g)
    const trackNumber = numbersinpath && numbersinpath.length ? parseInt(numbersinpath[0]) : null
    return {
      trackNumber,
      discNumber
    }
  }

  /**
   *
   * @param {string} mediaType
   * @param {LibraryItem.LibraryFileObject} libraryFile
   * @param {{title:string, subtitle:string, series:string, sequence:string, publishedYear:string, narrators:string}} mediaMetadataFromScan
   * @returns {Promise<AudioFile>}
   */
  async scan(mediaType, libraryFile, mediaMetadataFromScan) {
    const probeData = await prober.probe(libraryFile.metadata.path)

    if (probeData.error) {
      Logger.error(`[AudioFileScanner] ${probeData.error} : "${libraryFile.metadata.path}"`)
      return null
    }

    if (!probeData.audioStream) {
      Logger.error('[AudioFileScanner] Invalid audio file no audio stream')
      return null
    }

    const audioFile = new AudioFile()
    audioFile.trackNumFromMeta = probeData.audioMetaTags.trackNumber
    audioFile.discNumFromMeta = probeData.audioMetaTags.discNumber
    if (mediaType === 'book') {
      const { trackNumber, discNumber } = this.getTrackAndDiscNumberFromFilename(mediaMetadataFromScan, libraryFile)
      audioFile.trackNumFromFilename = trackNumber
      audioFile.discNumFromFilename = discNumber
    }
    audioFile.setDataFromProbe(libraryFile, probeData)

    return audioFile
  }

  /**
   * Scan LibraryFiles and return AudioFiles
   * @param {string} mediaType
   * @param {import('./LibraryItemScanData')} libraryItemScanData
   * @param {LibraryItem.LibraryFileObject[]} audioLibraryFiles
   * @returns {Promise<AudioFile[]>}
   */
  async executeMediaFileScans(mediaType, libraryItemScanData, audioLibraryFiles) {
    const batchSize = 32
    const results = []
    for (let batch = 0; batch < audioLibraryFiles.length; batch += batchSize) {
      const proms = []
      for (let i = batch; i < Math.min(batch + batchSize, audioLibraryFiles.length); i++) {
        proms.push(this.scan(mediaType, audioLibraryFiles[i], libraryItemScanData.mediaMetadata))
      }
      results.push(...(await Promise.all(proms).then((scanResults) => scanResults.filter((sr) => sr))))
    }

    return results
  }

  /**
   *
   * @param {AudioFile} audioFile
   * @returns {object}
   */
  probeAudioFile(audioFile) {
    Logger.debug(`[AudioFileScanner] Running ffprobe for audio file at "${audioFile.metadata.path}"`)
    return prober.rawProbe(audioFile.metadata.path)
  }

  /**
   * Set book metadata & chapters from audio file meta tags
   *
   * @param {string} bookTitle
   * @param {import('../models/Book').AudioFileObject} audioFile
   * @param {Object} bookMetadata
   * @param {import('./LibraryScan')} libraryScan
   */
  setBookMetadataFromAudioMetaTags(bookTitle, audioFiles, bookMetadata, libraryScan) {
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
        key: 'title'
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
        altTag: 'tagGrouping',
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

    const firstScannedFile = audioFiles[0]
    const audioFileMetaTags = firstScannedFile.metaTags
    MetadataMapArray.forEach((mapping) => {
      let value = audioFileMetaTags[mapping.tag]
      let isAltTag = false
      if (!value && mapping.altTag) {
        value = audioFileMetaTags[mapping.altTag]
        isAltTag = true
      }

      if (value && typeof value === 'string') {
        value = value.trim() // Trim whitespace

        if (mapping.key === 'narrators') {
          bookMetadata.narrators = parseNameString.parse(value)?.names || []
        } else if (mapping.key === 'authors') {
          bookMetadata.authors = parseNameString.parse(value)?.names || []
        } else if (mapping.key === 'genres') {
          bookMetadata.genres = this.parseGenresString(value)
        } else if (mapping.key === 'series') {
          // If series was embedded in the grouping tag, then parse it with semicolon separator and sequence in the same string
          // e.g. "Test Series; Series Name #1; Other Series #2"
          if (isAltTag) {
            const series = value
              .split(';')
              .map((seriesWithPart) => {
                seriesWithPart = seriesWithPart.trim()
                return parseSeriesString.parse(seriesWithPart)
              })
              .filter(Boolean)
            if (series.length) {
              bookMetadata.series = series
            }
          } else {
            // Original embed used "series" and "series-part" tags
            bookMetadata.series = [
              {
                name: value,
                sequence: audioFileMetaTags.tagSeriesPart || null
              }
            ]
          }
        } else {
          bookMetadata[mapping.key] = value
        }
      }
    })

    // Set chapters
    const chapters = this.getBookChaptersFromAudioFiles(bookTitle, audioFiles, libraryScan)
    if (chapters.length) {
      bookMetadata.chapters = chapters
    }
  }

  /**
   * Set podcast metadata from first audio file
   *
   * @param {import('../models/Book').AudioFileObject} audioFile
   * @param {Object} podcastMetadata
   * @param {import('./LibraryScan')} libraryScan
   */
  setPodcastMetadataFromAudioMetaTags(audioFile, podcastMetadata, libraryScan) {
    const audioFileMetaTags = audioFile.metaTags

    const MetadataMapArray = [
      {
        tag: 'tagAlbum',
        altTag: 'tagSeries',
        key: 'title'
      },
      {
        tag: 'tagAlbumArtist',
        altTag: 'tagArtist',
        key: 'author'
      },
      {
        tag: 'tagGenre',
        key: 'genres'
      },
      {
        tag: 'tagLanguage',
        key: 'language'
      },
      {
        tag: 'tagItunesId',
        key: 'itunesId'
      },
      {
        tag: 'tagPodcastType',
        key: 'podcastType'
      }
    ]

    MetadataMapArray.forEach((mapping) => {
      let value = audioFileMetaTags[mapping.tag]
      let tagToUse = mapping.tag
      if (!value && mapping.altTag) {
        value = audioFileMetaTags[mapping.altTag]
        tagToUse = mapping.altTag
      }

      if (value && typeof value === 'string') {
        value = value.trim() // Trim whitespace

        if (mapping.key === 'genres') {
          podcastMetadata.genres = this.parseGenresString(value)
          libraryScan.addLog(LogLevel.DEBUG, `Mapping metadata to key ${tagToUse} => ${mapping.key}: ${podcastMetadata.genres.join(', ')}`)
        } else {
          podcastMetadata[mapping.key] = value
          libraryScan.addLog(LogLevel.DEBUG, `Mapping metadata to key ${tagToUse} => ${mapping.key}: ${podcastMetadata[mapping.key]}`)
        }
      }
    })
  }

  /**
   *
   * @param {import('../models/PodcastEpisode')} podcastEpisode Not the model when creating new podcast
   * @param {import('./ScanLogger')} scanLogger
   */
  setPodcastEpisodeMetadataFromAudioMetaTags(podcastEpisode, scanLogger) {
    const MetadataMapArray = [
      {
        tag: 'tagComment',
        altTag: 'tagDescription',
        key: 'description'
      },
      {
        tag: 'tagSubtitle',
        key: 'subtitle'
      },
      {
        tag: 'tagDate',
        key: 'pubDate'
      },
      {
        tag: 'tagDisc',
        key: 'season'
      },
      {
        tag: 'tagTrack',
        altTag: 'tagSeriesPart',
        key: 'episode'
      },
      {
        tag: 'tagTitle',
        key: 'title'
      },
      {
        tag: 'tagEpisodeType',
        key: 'episodeType'
      }
    ]

    const audioFileMetaTags = podcastEpisode.audioFile.metaTags
    MetadataMapArray.forEach((mapping) => {
      let value = audioFileMetaTags[mapping.tag]
      let tagToUse = mapping.tag
      if (!value && mapping.altTag) {
        tagToUse = mapping.altTag
        value = audioFileMetaTags[mapping.altTag]
      }

      if (value && typeof value === 'string') {
        value = value.trim() // Trim whitespace

        if (mapping.key === 'pubDate') {
          const pubJsDate = new Date(value)
          if (pubJsDate && !isNaN(pubJsDate)) {
            podcastEpisode.publishedAt = pubJsDate.valueOf()
            podcastEpisode.pubDate = value
            scanLogger.addLog(LogLevel.DEBUG, `Mapping metadata to key ${tagToUse} => ${mapping.key}: ${podcastEpisode[mapping.key]}`)
          } else {
            scanLogger.addLog(LogLevel.WARN, `Mapping pubDate with tag ${tagToUse} has invalid date "${value}"`)
          }
        } else if (mapping.key === 'episodeType') {
          if (['full', 'trailer', 'bonus'].includes(value)) {
            podcastEpisode.episodeType = value
            scanLogger.addLog(LogLevel.DEBUG, `Mapping metadata to key ${tagToUse} => ${mapping.key}: ${podcastEpisode[mapping.key]}`)
          } else {
            scanLogger.addLog(LogLevel.WARN, `Mapping episodeType with invalid value "${value}". Must be one of [full, trailer, bonus].`)
          }
        } else {
          podcastEpisode[mapping.key] = value
          scanLogger.addLog(LogLevel.DEBUG, `Mapping metadata to key ${tagToUse} => ${mapping.key}: ${podcastEpisode[mapping.key]}`)
        }
      }
    })
  }

  /**
   * @param {string} bookTitle
   * @param {AudioFile[]} audioFiles
   * @param {import('./LibraryScan')} libraryScan
   * @returns {import('../models/Book').ChapterObject[]}
   */
  getBookChaptersFromAudioFiles(bookTitle, audioFiles, libraryScan) {
    // If overdrive media markers are present then use those instead
    const overdriveChapters = parseOverdriveMediaMarkersAsChapters(audioFiles)
    if (overdriveChapters?.length) {
      libraryScan.addLog(LogLevel.DEBUG, 'Overdrive Media Markers and preference found! Using these for chapter definitions')

      return overdriveChapters
    }

    let chapters = []

    // If first audio file has embedded chapters then use embedded chapters
    if (audioFiles[0].chapters?.length) {
      // If all files chapters are the same, then only make chapters for the first file
      if (audioFiles.length === 1 || (audioFiles.length > 1 && audioFiles[0].chapters.length === audioFiles[1].chapters?.length && audioFiles[0].chapters.every((c, i) => c.title === audioFiles[1].chapters[i].title && c.start === audioFiles[1].chapters[i].start))) {
        libraryScan.addLog(LogLevel.DEBUG, `setChapters: Using embedded chapters in first audio file ${audioFiles[0].metadata?.path}`)
        chapters = audioFiles[0].chapters.map((c) => ({ ...c }))
      } else {
        libraryScan.addLog(LogLevel.DEBUG, `setChapters: Using embedded chapters from all audio files ${audioFiles[0].metadata?.path}`)
        let currChapterId = 0
        let currStartTime = 0

        audioFiles.forEach((file) => {
          if (file.duration) {
            // Multi-file audiobook may include the previous and next chapters embedded with close to 0 duration
            // Filter these out and log a warning
            // See https://github.com/advplyr/audiobookshelf/issues/3361
            const afChaptersCleaned =
              file.chapters?.filter((c) => {
                if (c.end - c.start < 0.1) {
                  libraryScan.addLog(LogLevel.WARN, `Chapter "${c.title}" has invalid duration of ${c.end - c.start} seconds. Skipping this chapter.`)
                  return false
                }
                return true
              }) || []
            const afChapters = afChaptersCleaned.map((c) => ({
              ...c,
              id: c.id + currChapterId,
              start: c.start + currStartTime,
              end: c.end + currStartTime
            }))
            chapters = chapters.concat(afChapters)

            currChapterId += afChaptersCleaned.length ?? 0
            currStartTime += file.duration
          }
        })
        return chapters
      }
    } else if (audioFiles.length > 1) {
      // In some cases the ID3 title tag for each file is the chapter title, the criteria to determine if this will be used
      // 1. Every audio file has an ID3 title tag set
      // 2. None of the title tags are the same as the book title
      // 3. Every ID3 title tag is unique
      const metaTagTitlesFound = [...new Set(audioFiles.map((af) => af.metaTags?.tagTitle).filter((tagTitle) => !!tagTitle && tagTitle !== bookTitle))]
      const useMetaTagAsTitle = metaTagTitlesFound.length === audioFiles.length

      // Build chapters from audio files
      let currChapterId = 0
      let currStartTime = 0
      audioFiles.forEach((file) => {
        if (file.duration) {
          let title = file.metadata.filename ? Path.basename(file.metadata.filename, Path.extname(file.metadata.filename)) : `Chapter ${currChapterId}`
          if (useMetaTagAsTitle) {
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

  /**
   * Parse a genre string into multiple genres
   * @example "Fantasy;Sci-Fi;History" => ["Fantasy", "Sci-Fi", "History"]
   *
   * @param {string} genreTag
   * @returns {string[]}
   */
  parseGenresString(genreTag) {
    if (!genreTag?.length) return []
    const separators = ['/', '//', ';']
    for (let i = 0; i < separators.length; i++) {
      if (genreTag.includes(separators[i])) {
        return genreTag
          .split(separators[i])
          .map((genre) => genre.trim())
          .filter((g) => !!g)
      }
    }
    return [genreTag]
  }
}
module.exports = new AudioFileScanner()
