const uuidv4 = require("uuid").v4
const Path = require('path')
const { LogLevel } = require('../utils/constants')
const { getTitleIgnorePrefix } = require('../utils/index')
const AudioFileScanner = require('./AudioFileScanner')
const Database = require('../Database')
const { filePathToPOSIX, getFileTimestampsWithIno } = require('../utils/fileUtils')
const AudioFile = require('../objects/files/AudioFile')
const CoverManager = require('../managers/CoverManager')
const LibraryFile = require('../objects/files/LibraryFile')
const fsExtra = require("../libs/fsExtra")
const PodcastEpisode = require("../models/PodcastEpisode")
const AbsMetadataFileScanner = require("./AbsMetadataFileScanner")

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
   * @returns {Promise<{libraryItem:import('../models/LibraryItem'), wasUpdated:boolean}>}
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
        let scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(existingLibraryItem.mediaType, libraryItemData, libraryItemData.audioLibraryFilesModified.map(lf => lf.new))

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
            AudioFileScanner.setPodcastEpisodeMetadataFromAudioMetaTags(podcastEpisode, libraryScan)
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
        AudioFileScanner.setPodcastEpisodeMetadataFromAudioMetaTags(newPodcastEpisode, libraryScan)
        libraryScan.addLog(LogLevel.INFO, `New Podcast episode "${newPodcastEpisode.title}" added`)
        await newPodcastEpisode.save()
        existingPodcastEpisodes.push(newPodcastEpisode)
      }
    }

    let hasMediaChanges = false

    // Check if cover was removed
    if (media.coverPath && libraryItemData.imageLibraryFilesRemoved.some(lf => lf.metadata.path === media.coverPath)) {
      media.coverPath = null
      hasMediaChanges = true
    }

    // Update cover if it was modified
    if (media.coverPath && libraryItemData.imageLibraryFilesModified.length) {
      let coverMatch = libraryItemData.imageLibraryFilesModified.find(iFile => iFile.old.metadata.path === media.coverPath)
      if (coverMatch) {
        const coverPath = coverMatch.new.metadata.path
        if (coverPath !== media.coverPath) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating podcast cover "${media.coverPath}" => "${coverPath}" for podcast "${media.title}"`)
          media.coverPath = coverPath
          media.changed('coverPath', true)
          hasMediaChanges = true
        }
      }
    }

    // Check if cover is not set and image files were found
    if (!media.coverPath && libraryItemData.imageLibraryFiles.length) {
      // Prefer using a cover image with the name "cover" otherwise use the first image
      const coverMatch = libraryItemData.imageLibraryFiles.find(iFile => /\/cover\.[^.\/]*$/.test(iFile.metadata.path))
      media.coverPath = coverMatch?.metadata.path || libraryItemData.imageLibraryFiles[0].metadata.path
      hasMediaChanges = true
    }

    const podcastMetadata = await this.getPodcastMetadataFromScanData(existingPodcastEpisodes, libraryItemData, libraryScan, existingLibraryItem.id)

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
      const extractedCoverPath = await CoverManager.saveEmbeddedCoverArt(audioFiles, existingLibraryItem.id, existingLibraryItem.path)
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

    return {
      libraryItem: existingLibraryItem,
      wasUpdated: hasMediaChanges || libraryItemUpdated
    }
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
      AudioFileScanner.setPodcastEpisodeMetadataFromAudioMetaTags(newEpisode, libraryScan)
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
      podcastObject.coverPath = await CoverManager.saveEmbeddedCoverArt(scannedAudioFiles, libraryItemObj.id, libraryItemObj.path)
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
   * @param {string} [existingLibraryItemId]
   * @returns {Promise<PodcastMetadataObject>}
   */
  async getPodcastMetadataFromScanData(podcastEpisodes, libraryItemData, libraryScan, existingLibraryItemId = null) {
    const podcastMetadata = {
      title: libraryItemData.mediaMetadata.title,
      titleIgnorePrefix: undefined,
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

    // Use audio meta tags
    if (podcastEpisodes.length) {
      AudioFileScanner.setPodcastMetadataFromAudioMetaTags(podcastEpisodes[0].audioFile, podcastMetadata, libraryScan)
    }

    // Use metadata.json file
    await AbsMetadataFileScanner.scanPodcastMetadataFile(libraryScan, libraryItemData, podcastMetadata, existingLibraryItemId)

    podcastMetadata.titleIgnorePrefix = getTitleIgnorePrefix(podcastMetadata.title)

    return podcastMetadata
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

    const metadataFilePath = Path.join(metadataPath, `metadata.${global.ServerSettings.metadataFileFormat}`)

    const jsonObject = {
      tags: libraryItem.media.tags || [],
      title: libraryItem.media.title,
      author: libraryItem.media.author,
      description: libraryItem.media.description,
      releaseDate: libraryItem.media.releaseDate,
      genres: libraryItem.media.genres || [],
      feedURL: libraryItem.media.feedURL,
      imageURL: libraryItem.media.imageURL,
      itunesPageURL: libraryItem.media.itunesPageURL,
      itunesId: libraryItem.media.itunesId,
      itunesArtistId: libraryItem.media.itunesArtistId,
      asin: libraryItem.media.asin,
      language: libraryItem.media.language,
      explicit: !!libraryItem.media.explicit,
      podcastType: libraryItem.media.podcastType
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
  }
}
module.exports = new PodcastScanner()