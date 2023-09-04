const uuidv4 = require("uuid").v4
const Path = require('path')
const { LogLevel } = require('../utils/constants')
const { getTitleIgnorePrefix } = require('../utils/index')
const abmetadataGenerator = require('../utils/generators/abmetadataGenerator')
const AudioFileScanner = require('./AudioFileScanner')
const Database = require('../Database')
const { readTextFile, filePathToPOSIX, getFileTimestampsWithIno } = require('../utils/fileUtils')
const AudioFile = require('../objects/files/AudioFile')
const CoverManager = require('../managers/CoverManager')
const LibraryFile = require('../objects/files/LibraryFile')
const fsExtra = require("../libs/fsExtra")
const PodcastEpisode = require("../models/PodcastEpisode")

/**
 * Metadata for podcasts pulled from files
 * @typedef PodcastMetadataObject
 * @property {string} title
 * @property {string} titleIgnorePrefix
 * @property {string} author
 * @property {string} releaseDate
 * @property {string} feedURL
 * @property {string} imageURL
 * @property {string} description
 * @property {string} itunesPageURL
 * @property {string} itunesId
 * @property {string} language
 * @property {string} podcastType
 * @property {string[]} genres
 * @property {string[]} tags
 * @property {boolean} explicit
 */

class PodcastScanner {
  constructor() { }

  /**
   * @param {import('../models/LibraryItem')} existingLibraryItem 
   * @param {import('./LibraryItemScanData')} libraryItemData 
   * @param {import('../models/Library').LibrarySettingsObject} librarySettings
   * @param {import('./LibraryScan')} libraryScan 
   * @returns {Promise<import('../models/LibraryItem')>}
   */
  async rescanExistingPodcastLibraryItem(existingLibraryItem, libraryItemData, librarySettings, libraryScan) {
    /** @type {import('../models/Podcast')} */
    const media = await existingLibraryItem.getMedia({
      include: [
        {
          model: Database.podcastEpisodeModel
        }
      ]
    })

    /** @type {import('../models/PodcastEpisode')[]} */
    let existingPodcastEpisodes = media.podcastEpisodes

    /** @type {AudioFile[]} */
    let newAudioFiles = []

    if (libraryItemData.hasAudioFileChanges || libraryItemData.audioLibraryFiles.length !== existingPodcastEpisodes.length) {
      // Filter out and destroy episodes that were removed
      existingPodcastEpisodes = await Promise.all(existingPodcastEpisodes.filter(async ep => {
        if (libraryItemData.checkAudioFileRemoved(ep.audioFile)) {
          libraryScan.addLog(LogLevel.INFO, `Podcast episode "${ep.title}" audio file was removed`)
          // TODO: Should clean up other data linked to this episode
          await ep.destroy()
          return false
        }
        return true
      }))

      // Update audio files that were modified
      if (libraryItemData.audioLibraryFilesModified.length) {
        let scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(existingLibraryItem.mediaType, libraryItemData, libraryItemData.audioLibraryFilesModified)

        for (const podcastEpisode of existingPodcastEpisodes) {
          let matchedScannedAudioFile = scannedAudioFiles.find(saf => saf.metadata.path === podcastEpisode.audioFile.metadata.path)
          if (!matchedScannedAudioFile) {
            matchedScannedAudioFile = scannedAudioFiles.find(saf => saf.ino === podcastEpisode.audioFile.ino)
          }

          if (matchedScannedAudioFile) {
            scannedAudioFiles = scannedAudioFiles.filter(saf => saf !== matchedScannedAudioFile)
            const audioFile = new AudioFile(podcastEpisode.audioFile)
            audioFile.updateFromScan(matchedScannedAudioFile)
            podcastEpisode.audioFile = audioFile.toJSON()
            podcastEpisode.changed('audioFile', true)

            // Set metadata and save episode
            this.setPodcastEpisodeMetadataFromAudioFile(podcastEpisode, libraryScan)
            libraryScan.addLog(LogLevel.INFO, `Podcast episode "${podcastEpisode.title}" keys changed [${podcastEpisode.changed()?.join(', ')}]`)
            await podcastEpisode.save()
          }
        }

        // Modified audio files that were not found as a podcast episode
        if (scannedAudioFiles.length) {
          newAudioFiles.push(...scannedAudioFiles)
        }
      }

      // Add new audio files scanned in
      if (libraryItemData.audioLibraryFilesAdded.length) {
        const scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(existingLibraryItem.mediaType, libraryItemData, libraryItemData.audioLibraryFilesAdded)
        newAudioFiles.push(...scannedAudioFiles)
      }

      // Create new podcast episodes from new found audio files
      for (const newAudioFile of newAudioFiles) {
        const newEpisode = {
          title: newAudioFile.metaTags.tagTitle || newAudioFile.metadata.filenameNoExt,
          subtitle: null,
          season: null,
          episode: null,
          episodeType: null,
          pubDate: null,
          publishedAt: null,
          description: null,
          audioFile: newAudioFile.toJSON(),
          chapters: newAudioFile.chapters || [],
          podcastId: media.id
        }
        const newPodcastEpisode = Database.podcastEpisodeModel.build(newEpisode)
        // Set metadata and save new episode
        this.setPodcastEpisodeMetadataFromAudioFile(newPodcastEpisode, libraryScan)
        libraryScan.addLog(LogLevel.INFO, `New Podcast episode "${newPodcastEpisode.title}" added`)
        await newPodcastEpisode.save()
        existingPodcastEpisodes.push(newPodcastEpisode)
      }
    }

    let hasMediaChanges = false

    // Check if cover was removed
    if (media.coverPath && !libraryItemData.imageLibraryFiles.some(lf => lf.metadata.path === media.coverPath)) {
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

    // TODO: When metadata file is stored in /metadata/items/{libraryItemId}.[abs|json] we should load this
    const podcastMetadata = await this.getPodcastMetadataFromScanData(existingPodcastEpisodes, libraryItemData, libraryScan)

    for (const key in podcastMetadata) {
      // Ignore unset metadata and empty arrays
      if (podcastMetadata[key] === undefined || (Array.isArray(podcastMetadata[key]) && !podcastMetadata[key].length)) continue

      if (key === 'genres') {
        const existingGenres = media.genres || []
        if (podcastMetadata.genres.some(g => !existingGenres.includes(g)) || existingGenres.some(g => !podcastMetadata.genres.includes(g))) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating podcast genres "${existingGenres.join(',')}" => "${podcastMetadata.genres.join(',')}" for podcast "${podcastMetadata.title}"`)
          media.genres = podcastMetadata.genres
          media.changed('genres', true)
          hasMediaChanges = true
        }
      } else if (key === 'tags') {
        const existingTags = media.tags || []
        if (podcastMetadata.tags.some(t => !existingTags.includes(t)) || existingTags.some(t => !podcastMetadata.tags.includes(t))) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating podcast tags "${existingTags.join(',')}" => "${podcastMetadata.tags.join(',')}" for podcast "${podcastMetadata.title}"`)
          media.tags = podcastMetadata.tags
          media.changed('tags', true)
          hasMediaChanges = true
        }
      } else if (podcastMetadata[key] !== media[key]) {
        libraryScan.addLog(LogLevel.DEBUG, `Updating podcast ${key} "${media[key]}" => "${podcastMetadata[key]}" for podcast "${podcastMetadata.title}"`)
        media[key] = podcastMetadata[key]
        hasMediaChanges = true
      }
    }

    // If no cover then extract cover from audio file if available
    if (!media.coverPath && existingPodcastEpisodes.length) {
      const audioFiles = existingPodcastEpisodes.map(ep => ep.audioFile)
      const extractedCoverPath = await CoverManager.saveEmbeddedCoverArtNew(audioFiles, existingLibraryItem.id, existingLibraryItem.path)
      if (extractedCoverPath) {
        libraryScan.addLog(LogLevel.DEBUG, `Updating podcast "${podcastMetadata.title}" extracted embedded cover art from audio file to path "${extractedCoverPath}"`)
        media.coverPath = extractedCoverPath
        hasMediaChanges = true
      }
    }

    existingLibraryItem.media = media

    let libraryItemUpdated = false

    // Save Podcast changes to db
    if (hasMediaChanges) {
      await media.save()
      await this.saveMetadataFile(existingLibraryItem, libraryScan)
      libraryItemUpdated = global.ServerSettings.storeMetadataWithItem
    }

    if (libraryItemUpdated) {
      existingLibraryItem.changed('libraryFiles', true)
      await existingLibraryItem.save()
    }

    return existingLibraryItem
  }

  /**
   * 
   * @param {import('./LibraryItemScanData')} libraryItemData 
   * @param {import('../models/Library').LibrarySettingsObject} librarySettings
   * @param {import('./LibraryScan')} libraryScan 
   * @returns {Promise<import('../models/LibraryItem')>}
   */
  async scanNewPodcastLibraryItem(libraryItemData, librarySettings, libraryScan) {
    // Scan audio files found
    let scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(libraryItemData.mediaType, libraryItemData, libraryItemData.audioLibraryFiles)

    // Do not add library items that have no valid audio files
    if (!scannedAudioFiles.length) {
      libraryScan.addLog(LogLevel.WARN, `Library item at path "${libraryItemData.relPath}" has no audio files - ignoring`)
      return null
    }

    const newPodcastEpisodes = []

    // Create podcast episodes from audio files
    for (const audioFile of scannedAudioFiles) {
      const newEpisode = {
        title: audioFile.metaTags.tagTitle || audioFile.metadata.filenameNoExt,
        subtitle: null,
        season: null,
        episode: null,
        episodeType: null,
        pubDate: null,
        publishedAt: null,
        description: null,
        audioFile: audioFile.toJSON(),
        chapters: audioFile.chapters || []
      }

      // Set metadata and save new episode
      this.setPodcastEpisodeMetadataFromAudioFile(newEpisode, libraryScan)
      libraryScan.addLog(LogLevel.INFO, `New Podcast episode "${newEpisode.title}" found`)
      newPodcastEpisodes.push(newEpisode)
    }

    const podcastMetadata = await this.getPodcastMetadataFromScanData(newPodcastEpisodes, libraryItemData, libraryScan)
    podcastMetadata.explicit = !!podcastMetadata.explicit // Ensure boolean

    // Set cover image from library file
    if (libraryItemData.imageLibraryFiles.length) {
      // Prefer using a cover image with the name "cover" otherwise use the first image
      const coverMatch = libraryItemData.imageLibraryFiles.find(iFile => /\/cover\.[^.\/]*$/.test(iFile.metadata.path))
      podcastMetadata.coverPath = coverMatch?.metadata.path || libraryItemData.imageLibraryFiles[0].metadata.path
    }

    // Set default podcastType to episodic
    if (!podcastMetadata.podcastType) {
      podcastMetadata.podcastType = 'episodic'
    }

    const podcastObject = {
      ...podcastMetadata,
      autoDownloadEpisodes: false,
      autoDownloadSchedule: '0 * * * *',
      lastEpisodeCheck: 0,
      maxEpisodesToKeep: 0,
      maxNewEpisodesToDownload: 3,
      podcastEpisodes: newPodcastEpisodes
    }

    const libraryItemObj = libraryItemData.libraryItemObject
    libraryItemObj.id = uuidv4() // Generate library item id ahead of time to use for saving extracted cover image
    libraryItemObj.isMissing = false
    libraryItemObj.isInvalid = false
    libraryItemObj.extraData = {}

    // If cover was not found in folder then check embedded covers in audio files
    if (!podcastObject.coverPath && scannedAudioFiles.length) {
      // Extract and save embedded cover art
      podcastObject.coverPath = await CoverManager.saveEmbeddedCoverArtNew(scannedAudioFiles, libraryItemObj.id, libraryItemObj.path)
    }

    libraryItemObj.podcast = podcastObject
    const libraryItem = await Database.libraryItemModel.create(libraryItemObj, {
      include: {
        model: Database.podcastModel,
        include: Database.podcastEpisodeModel
      }
    })

    Database.addGenresToFilterData(libraryItemData.libraryId, libraryItem.podcast.genres)
    Database.addTagsToFilterData(libraryItemData.libraryId, libraryItem.podcast.tags)

    // Load for emitting to client
    libraryItem.media = await libraryItem.getMedia({
      include: Database.podcastEpisodeModel
    })

    await this.saveMetadataFile(libraryItem, libraryScan)
    if (global.ServerSettings.storeMetadataWithItem) {
      libraryItem.changed('libraryFiles', true)
      await libraryItem.save()
    }

    return libraryItem
  }

  /**
   * 
   * @param {PodcastEpisode[]} podcastEpisodes Not the models for new podcasts
   * @param {import('./LibraryItemScanData')} libraryItemData 
   * @param {import('./LibraryScan')} libraryScan 
   * @returns {Promise<PodcastMetadataObject>}
   */
  async getPodcastMetadataFromScanData(podcastEpisodes, libraryItemData, libraryScan) {
    const podcastMetadata = {
      title: libraryItemData.mediaMetadata.title,
      titleIgnorePrefix: getTitleIgnorePrefix(libraryItemData.mediaMetadata.title),
      author: undefined,
      releaseDate: undefined,
      feedURL: undefined,
      imageURL: undefined,
      description: undefined,
      itunesPageURL: undefined,
      itunesId: undefined,
      itunesArtistId: undefined,
      language: undefined,
      podcastType: undefined,
      explicit: undefined,
      tags: [],
      genres: []
    }

    if (podcastEpisodes.length) {
      const audioFileMetaTags = podcastEpisodes[0].audioFile.metaTags
      const overrideExistingDetails = Database.serverSettings.scannerPreferAudioMetadata

      const MetadataMapArray = [
        {
          tag: 'tagAlbum',
          altTag: 'tagSeries',
          key: 'title'
        },
        {
          tag: 'tagArtist',
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
          key: 'podcastType',
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

          if (mapping.key === 'genres' && (!podcastMetadata.genres.length || overrideExistingDetails)) {
            podcastMetadata.genres = this.parseGenresString(value)
            libraryScan.addLog(LogLevel.DEBUG, `Mapping metadata to key ${tagToUse} => ${mapping.key}: ${podcastMetadata.genres.join(', ')}`)
          } else if (!podcastMetadata[mapping.key] || overrideExistingDetails) {
            podcastMetadata[mapping.key] = value
            libraryScan.addLog(LogLevel.DEBUG, `Mapping metadata to key ${tagToUse} => ${mapping.key}: ${podcastMetadata[mapping.key]}`)
          }
        }
      })
    }

    // If metadata.json or metadata.abs use this for metadata
    const metadataLibraryFile = libraryItemData.metadataJsonLibraryFile || libraryItemData.metadataAbsLibraryFile
    const metadataText = metadataLibraryFile ? await readTextFile(metadataLibraryFile.metadata.path) : null
    if (metadataText) {
      libraryScan.addLog(LogLevel.INFO, `Found metadata file "${metadataLibraryFile.metadata.path}" - preferring`)
      let abMetadata = null
      if (!!libraryItemData.metadataJsonLibraryFile) {
        abMetadata = abmetadataGenerator.parseJson(metadataText)
      } else {
        abMetadata = abmetadataGenerator.parse(metadataText, 'podcast')
      }

      if (abMetadata) {
        if (abMetadata.tags?.length) {
          podcastMetadata.tags = abMetadata.tags
        }
        for (const key in abMetadata.metadata) {
          if (abMetadata.metadata[key] === undefined) continue

          // TODO: New podcast model changed some keys, need to update the abmetadataGenerator
          let newModelKey = key
          if (key === 'feedUrl') newModelKey = 'feedURL'
          else if (key === 'imageUrl') newModelKey = 'imageURL'
          else if (key === 'itunesPageUrl') newModelKey = 'itunesPageURL'
          else if (key === 'type') newModelKey = 'podcastType'

          podcastMetadata[newModelKey] = abMetadata.metadata[key]
        }
      }
    }

    podcastMetadata.titleIgnorePrefix = getTitleIgnorePrefix(podcastMetadata.title)

    return podcastMetadata
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
   * 
   * @param {import('../models/LibraryItem')} libraryItem 
   * @param {import('./LibraryScan')} libraryScan
   * @returns {Promise}
   */
  async saveMetadataFile(libraryItem, libraryScan) {
    let metadataPath = Path.join(global.MetadataPath, 'items', libraryItem.id)
    let storeMetadataWithItem = global.ServerSettings.storeMetadataWithItem
    if (storeMetadataWithItem) {
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
        metadata: {
          title: libraryItem.media.title,
          author: libraryItem.media.author,
          description: libraryItem.media.description,
          releaseDate: libraryItem.media.releaseDate,
          genres: libraryItem.media.genres || [],
          feedUrl: libraryItem.media.feedURL,
          imageUrl: libraryItem.media.imageURL,
          itunesPageUrl: libraryItem.media.itunesPageURL,
          itunesId: libraryItem.media.itunesId,
          itunesArtistId: libraryItem.media.itunesArtistId,
          asin: libraryItem.media.asin,
          language: libraryItem.media.language,
          explicit: !!libraryItem.media.explicit,
          type: libraryItem.media.podcastType
        }
      }
      return fsExtra.writeFile(metadataFilePath, JSON.stringify(jsonObject, null, 2)).then(async () => {
        // Add metadata.json to libraryFiles array if it is new
        let metadataLibraryFile = libraryItem.libraryFiles.find(lf => lf.metadata.path === filePathToPOSIX(metadataFilePath))
        if (storeMetadataWithItem && !metadataLibraryFile) {
          const newLibraryFile = new LibraryFile()
          await newLibraryFile.setDataFromPath(metadataFilePath, `metadata.json`)
          metadataLibraryFile = newLibraryFile.toJSON()
          libraryItem.libraryFiles.push(metadataLibraryFile)
        } else if (storeMetadataWithItem) {
          const fileTimestamps = await getFileTimestampsWithIno(metadataFilePath)
          if (fileTimestamps) {
            metadataLibraryFile.metadata.mtimeMs = fileTimestamps.mtimeMs
            metadataLibraryFile.metadata.ctimeMs = fileTimestamps.ctimeMs
            metadataLibraryFile.metadata.size = fileTimestamps.size
            metadataLibraryFile.ino = fileTimestamps.ino
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
        if (storeMetadataWithItem && !metadataLibraryFile) {
          const newLibraryFile = new LibraryFile()
          await newLibraryFile.setDataFromPath(metadataFilePath, `metadata.abs`)
          metadataLibraryFile = newLibraryFile.toJSON()
          libraryItem.libraryFiles.push(metadataLibraryFile)
        } else if (storeMetadataWithItem) {
          const fileTimestamps = await getFileTimestampsWithIno(metadataFilePath)
          if (fileTimestamps) {
            metadataLibraryFile.metadata.mtimeMs = fileTimestamps.mtimeMs
            metadataLibraryFile.metadata.ctimeMs = fileTimestamps.ctimeMs
            metadataLibraryFile.metadata.size = fileTimestamps.size
            metadataLibraryFile.ino = fileTimestamps.ino
          }
        }

        libraryScan.addLog(LogLevel.DEBUG, `Success saving abmetadata to "${metadataFilePath}"`)
        return metadataLibraryFile
      })
    }
  }

  /**
   * 
   * @param {PodcastEpisode} podcastEpisode Not the model when creating new podcast
   * @param {import('./ScanLogger')} scanLogger
   */
  setPodcastEpisodeMetadataFromAudioFile(podcastEpisode, scanLogger) {
    const MetadataMapArray = [
      {
        tag: 'tagComment',
        altTag: 'tagSubtitle',
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
        key: 'season',
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
    const overrideExistingDetails = Database.serverSettings.scannerPreferAudioMetadata
    MetadataMapArray.forEach((mapping) => {
      let value = audioFileMetaTags[mapping.tag]
      let tagToUse = mapping.tag
      if (!value && mapping.altTag) {
        tagToUse = mapping.altTag
        value = audioFileMetaTags[mapping.altTag]
      }

      if (value && typeof value === 'string') {
        value = value.trim() // Trim whitespace

        if (mapping.key === 'pubDate' && (!podcastEpisode.pubDate || overrideExistingDetails)) {
          const pubJsDate = new Date(value)
          if (pubJsDate && !isNaN(pubJsDate)) {
            podcastEpisode.publishedAt = pubJsDate.valueOf()
            podcastEpisode.pubDate = value
            scanLogger.addLog(LogLevel.DEBUG, `Mapping metadata to key ${tagToUse} => ${mapping.key}: ${podcastEpisode[mapping.key]}`)
          } else {
            scanLogger.addLog(LogLevel.WARN, `Mapping pubDate with tag ${tagToUse} has invalid date "${value}"`)
          }
        } else if (mapping.key === 'episodeType' && (!podcastEpisode.episodeType || overrideExistingDetails)) {
          if (['full', 'trailer', 'bonus'].includes(value)) {
            podcastEpisode.episodeType = value
            scanLogger.addLog(LogLevel.DEBUG, `Mapping metadata to key ${tagToUse} => ${mapping.key}: ${podcastEpisode[mapping.key]}`)
          } else {
            scanLogger.addLog(LogLevel.WARN, `Mapping episodeType with invalid value "${value}". Must be one of [full, trailer, bonus].`)
          }
        } else if (!podcastEpisode[mapping.key] || overrideExistingDetails) {
          podcastEpisode[mapping.key] = value
          scanLogger.addLog(LogLevel.DEBUG, `Mapping metadata to key ${tagToUse} => ${mapping.key}: ${podcastEpisode[mapping.key]}`)
        }
      }
    })
  }
}
module.exports = new PodcastScanner()