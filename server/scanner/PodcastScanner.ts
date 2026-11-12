import { v4 as uuidv4 } from 'uuid'
import Path from 'path'
import { LogLevel } from '../utils/constants'
import { getTitleIgnorePrefix } from '../utils'
import AudioFileScanner from './AudioFileScanner'
import Database from '../Database'
import { filePathToPOSIX, getFileTimestampsWithIno } from '../utils/fileUtils'
import AudioFile from '../objects/files/AudioFile'
import CoverManager from '../managers/CoverManager'
import LibraryFile from '../objects/files/LibraryFile'
import fsExtra from '../libs/fsExtra'
import AbsMetadataFileScanner from './AbsMetadataFileScanner'
import htmlSanitizer from '../utils/htmlSanitizer'
import type Library from '../models/Library'
import type LibraryItem from '../models/LibraryItem'
import type Podcast from '../models/Podcast'
import type PodcastEpisode from '../models/PodcastEpisode'
import type LibraryItemScanData from './LibraryItemScanData'
import type LibraryScan from './LibraryScan'

type PodcastWithMetadata = Podcast & { asin?: string }
type PodcastScanMetadata = Partial<Pick<PodcastWithMetadata, 'titleIgnorePrefix' | 'author' | 'releaseDate' | 'feedURL' | 'imageURL' | 'description' | 'itunesPageURL' | 'itunesId' | 'itunesArtistId' | 'asin' | 'language' | 'podcastType' | 'explicit' | 'coverPath'>> & {
  title: string
  tags: string[]
  genres: string[]
}

class PodcastScanner {
  constructor() {}

  async rescanExistingPodcastLibraryItem(existingLibraryItem: LibraryItem, libraryItemData: LibraryItemScanData, _librarySettings: Library.LibrarySettingsObject, libraryScan: LibraryScan) {
    // The item scanner dispatches podcast items here and the query includes their episodes.
    const media = (await existingLibraryItem.getMedia({
      include: [
        {
          model: Database.podcastEpisodeModel
        }
      ]
    })) as Podcast.PodcastExpanded & PodcastWithMetadata

    let existingPodcastEpisodes = media.podcastEpisodes

    const newAudioFiles: Awaited<ReturnType<typeof AudioFileScanner.executeMediaFileScans>> = []

    // Track episode add/remove/update so item_updated includes the current episode list
    let hasEpisodeChanges = false

    if (libraryItemData.hasAudioFileChanges || libraryItemData.audioLibraryFiles.length !== existingPodcastEpisodes.length) {
      // Filter out and destroy episodes that were removed.
      // filter() returns a new array — reassign to media.podcastEpisodes before emit.
      const episodesToRemove: PodcastEpisode[] = []
      existingPodcastEpisodes = existingPodcastEpisodes.filter((ep) => {
        if (libraryItemData.checkAudioFileRemoved(ep.audioFile!)) {
          episodesToRemove.push(ep)
          return false
        }
        return true
      })

      if (episodesToRemove.length) {
        hasEpisodeChanges = true
        // Remove episodes from playlists and media progress
        const episodeIds = episodesToRemove.map((ep) => ep.id)
        await Database.playlistModel.removeMediaItemsFromPlaylists(episodeIds)
        const mediaProgressRemoved = await Database.mediaProgressModel.destroy({
          where: {
            mediaItemId: episodeIds
          }
        })
        if (mediaProgressRemoved) {
          libraryScan.addLog(LogLevel.INFO, `Removed ${mediaProgressRemoved} media progress for episodes`)
        }

        // Remove episodes
        await Promise.all(
          episodesToRemove.map(async (ep) => {
            await ep.destroy()
            libraryScan.addLog(LogLevel.INFO, `Podcast episode "${ep.title}" audio file was removed`)
          })
        )
      }

      // Update audio files that were modified
      if (libraryItemData.audioLibraryFilesModified.length) {
        let scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(
          existingLibraryItem.mediaType,
          libraryItemData,
          libraryItemData.audioLibraryFilesModified.map((lf) => lf.new)
        )

        for (const podcastEpisode of existingPodcastEpisodes) {
          let matchedScannedAudioFile = scannedAudioFiles.find((saf) => saf.metadata.path === podcastEpisode.audioFile!.metadata.path)
          if (!matchedScannedAudioFile) {
            matchedScannedAudioFile = scannedAudioFiles.find((saf) => saf.ino === podcastEpisode.audioFile!.ino)
          }

          if (matchedScannedAudioFile) {
            scannedAudioFiles = scannedAudioFiles.filter((saf) => saf !== matchedScannedAudioFile)
            const audioFile = new AudioFile(podcastEpisode.audioFile)
            audioFile.updateFromScan(matchedScannedAudioFile)
            podcastEpisode.audioFile = audioFile.toJSON()
            podcastEpisode.changed('audioFile', true)

            // Set metadata and save episode
            AudioFileScanner.setPodcastEpisodeMetadataFromAudioMetaTags(podcastEpisode, libraryScan)
            // The audioFile key was explicitly marked as changed above.
            const changedKeys = podcastEpisode.changed() as string[]
            libraryScan.addLog(LogLevel.INFO, `Podcast episode "${podcastEpisode.title}" keys changed [${changedKeys?.join(', ')}]`)
            await podcastEpisode.save()
            hasEpisodeChanges = true
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
        // Podcast episode audio files always have index 1
        newAudioFile.index = 1

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
        hasEpisodeChanges = true
      }
    }

    // Keep association in sync for toOldJSONExpanded() / item_updated socket payload
    media.podcastEpisodes = existingPodcastEpisodes

    let hasMediaChanges = false
    if (existingPodcastEpisodes.length !== media.numEpisodes) {
      media.numEpisodes = existingPodcastEpisodes.length
      hasMediaChanges = true
    }

    // Check if cover was removed
    if (media.coverPath && libraryItemData.imageLibraryFilesRemoved.some((lf) => lf.metadata.path === media.coverPath)) {
      media.coverPath = null
      hasMediaChanges = true
    }

    // Update cover if it was modified
    if (media.coverPath && libraryItemData.imageLibraryFilesModified.length) {
      let coverMatch = libraryItemData.imageLibraryFilesModified.find((iFile) => iFile.old.metadata.path === media.coverPath)
      if (coverMatch) {
        const coverPath = coverMatch.new.metadata.path
        if (coverPath !== media.coverPath) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating podcast cover "${media.coverPath}" => "${coverPath}" for podcast "${media.title}"`)
          // Historical file JSON can omit a path, which this update copies as-is.
          Object.assign(media, { coverPath })
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

    const podcastMetadata = await this.getPodcastMetadataFromScanData(existingPodcastEpisodes, libraryItemData, libraryScan, existingLibraryItem.id)

    for (const metadataKey in podcastMetadata) {
      // File metadata is filtered to podcast keys before being merged with the scan defaults.
      const key = metadataKey as keyof PodcastScanMetadata
      // Ignore unset metadata and empty arrays
      if (podcastMetadata[key] === undefined || (Array.isArray(podcastMetadata[key]) && !podcastMetadata[key].length)) continue

      if (key === 'genres') {
        const existingGenres = media.genres || []
        if (podcastMetadata.genres.some((g) => !existingGenres.includes(g)) || existingGenres.some((g) => !podcastMetadata.genres.includes(g))) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating podcast genres "${existingGenres.join(',')}" => "${podcastMetadata.genres.join(',')}" for podcast "${podcastMetadata.title}"`)
          media.genres = podcastMetadata.genres
          media.changed('genres', true)
          hasMediaChanges = true
        }
      } else if (key === 'tags') {
        const existingTags = media.tags || []
        if (podcastMetadata.tags.some((t) => !existingTags.includes(t)) || existingTags.some((t) => !podcastMetadata.tags.includes(t))) {
          libraryScan.addLog(LogLevel.DEBUG, `Updating podcast tags "${existingTags.join(',')}" => "${podcastMetadata.tags.join(',')}" for podcast "${podcastMetadata.title}"`)
          media.tags = podcastMetadata.tags
          media.changed('tags', true)
          hasMediaChanges = true
        }
      } else if (podcastMetadata[key] !== media[key]) {
        libraryScan.addLog(LogLevel.DEBUG, `Updating podcast ${key} "${String(media[key])}" => "${String(podcastMetadata[key])}" for podcast "${podcastMetadata.title}"`)
        Object.assign(media, { [key]: podcastMetadata[key] })
        hasMediaChanges = true
      }
    }

    // If no cover then extract cover from audio file if available
    if (!media.coverPath && existingPodcastEpisodes.length) {
      const audioFiles = existingPodcastEpisodes.map((ep) => ep.audioFile!)
      const extractedCoverPath = await CoverManager.saveEmbeddedCoverArt(audioFiles, existingLibraryItem.id, existingLibraryItem.path)
      if (extractedCoverPath) {
        libraryScan.addLog(LogLevel.DEBUG, `Updating podcast "${podcastMetadata.title}" extracted embedded cover art from audio file to path "${extractedCoverPath}"`)
        media.coverPath = extractedCoverPath
        hasMediaChanges = true
      }
    }

    existingLibraryItem.media = media

    let libraryItemUpdated: boolean | undefined = false

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
      wasUpdated: hasMediaChanges || libraryItemUpdated || hasEpisodeChanges
    }
  }

  async scanNewPodcastLibraryItem(libraryItemData: LibraryItemScanData, _librarySettings: Library.LibrarySettingsObject, libraryScan: LibraryScan) {
    // Scan audio files found
    const scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(libraryItemData.mediaType, libraryItemData, libraryItemData.audioLibraryFiles)

    // Do not add library items that have no valid audio files
    if (!scannedAudioFiles.length) {
      libraryScan.addLog(LogLevel.WARN, `Library item at path "${libraryItemData.relPath}" has no audio files - ignoring`)
      return null
    }

    const newPodcastEpisodes = []

    // Create podcast episodes from audio files
    for (const audioFile of scannedAudioFiles) {
      // Podcast episode audio files always have index 1
      audioFile.index = 1

      const newEpisode: Pick<PodcastEpisode, 'title' | 'subtitle' | 'season' | 'episode' | 'episodeType' | 'pubDate' | 'description' | 'audioFile' | 'chapters'> & { publishedAt: number | null } = {
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
      const coverMatch = libraryItemData.imageLibraryFiles.find((iFile) => /\/cover\.[^.\/]*$/.test(iFile.metadata.path))
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
      podcastEpisodes: newPodcastEpisodes,
      numEpisodes: newPodcastEpisodes.length
    }

    const libraryItemObj = {
      ...libraryItemData.libraryItemObject,
      id: uuidv4(), // Generate the item id before extracting the cover.
      isMissing: false,
      isInvalid: false,
      extraData: {},
      title: podcastObject.title,
      titleIgnorePrefix: getTitleIgnorePrefix(podcastObject.title)
    }

    // If cover was not found in folder then check embedded covers in audio files
    if (!podcastObject.coverPath && scannedAudioFiles.length) {
      // Extract and save embedded cover art
      podcastObject.coverPath = await CoverManager.saveEmbeddedCoverArt(scannedAudioFiles, libraryItemObj.id, libraryItemObj.path)
    }

    const libraryItem = await Database.libraryItemModel.create(Object.assign(libraryItemObj, { podcast: podcastObject }), {
      include: {
        model: Database.podcastModel,
        include: [Database.podcastEpisodeModel]
      }
    })

    Database.addGenresToFilterData(libraryItemData.libraryId, libraryItem.podcast!.genres)
    Database.addTagsToFilterData(libraryItemData.libraryId, libraryItem.podcast!.tags)

    // Load for emitting to client
    libraryItem.media = await libraryItem.getMedia({
      include: [Database.podcastEpisodeModel]
    })

    await this.saveMetadataFile(libraryItem, libraryScan)
    if (global.ServerSettings.storeMetadataWithItem) {
      libraryItem.changed('libraryFiles', true)
      await libraryItem.save()
    }

    return libraryItem
  }

  async getPodcastMetadataFromScanData(podcastEpisodes: Pick<PodcastEpisode, 'audioFile'>[], libraryItemData: LibraryItemScanData, libraryScan: LibraryScan, existingLibraryItemId: string | null = null) {
    const podcastMetadata: PodcastScanMetadata = {
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
      AudioFileScanner.setPodcastMetadataFromAudioMetaTags(podcastEpisodes[0].audioFile!, podcastMetadata, libraryScan)
    }

    // Use metadata.json file
    await AbsMetadataFileScanner.scanPodcastMetadataFile(libraryScan, libraryItemData, podcastMetadata, existingLibraryItemId)

    podcastMetadata.titleIgnorePrefix = getTitleIgnorePrefix(podcastMetadata.title)

    if (typeof podcastMetadata.description === 'string' && podcastMetadata.description) {
      podcastMetadata.description = htmlSanitizer.sanitize(podcastMetadata.description)
    }

    return podcastMetadata
  }

  async saveMetadataFile(libraryItem: LibraryItem, libraryScan: LibraryScan) {
    let metadataPath = Path.join(global.MetadataPath!, 'items', libraryItem.id)
    let storeMetadataWithItem = global.ServerSettings.storeMetadataWithItem
    if (storeMetadataWithItem) {
      metadataPath = libraryItem.path!
    } else {
      // Make sure metadata book dir exists
      storeMetadataWithItem = false
      await fsExtra.ensureDir(metadataPath)
    }

    const metadataFilePath = Path.join(metadataPath, `metadata.${global.ServerSettings.metadataFileFormat}`)

    /**
     * Keys must match abmetadataGenerator.js
     */
    const media = libraryItem.media as PodcastWithMetadata
    const jsonObject = {
      tags: media.tags || [],
      title: media.title,
      author: media.author,
      description: media.description,
      releaseDate: media.releaseDate,
      genres: media.genres || [],
      feedURL: media.feedURL,
      imageURL: media.imageURL,
      itunesPageURL: media.itunesPageURL,
      itunesId: media.itunesId,
      itunesArtistId: media.itunesArtistId,
      asin: media.asin,
      language: media.language,
      explicit: !!media.explicit,
      podcastType: media.podcastType
    }
    return fsExtra
      .writeFile(metadataFilePath, JSON.stringify(jsonObject, null, 2))
      .then(async () => {
        // Add metadata.json to libraryFiles array if it is new
        let metadataLibraryFile = libraryItem.libraryFiles!.find((lf) => lf.metadata.path === filePathToPOSIX(metadataFilePath))
        if (storeMetadataWithItem) {
          if (!metadataLibraryFile) {
            const newLibraryFile = new LibraryFile()
            await newLibraryFile.setDataFromPath(metadataFilePath, `metadata.json`)
            metadataLibraryFile = newLibraryFile.toJSON()
            libraryItem.libraryFiles!.push(metadataLibraryFile)
          } else {
            const fileTimestamps = await getFileTimestampsWithIno(metadataFilePath)
            if (fileTimestamps) {
              metadataLibraryFile.metadata.mtimeMs = fileTimestamps.mtimeMs
              metadataLibraryFile.metadata.ctimeMs = fileTimestamps.ctimeMs
              metadataLibraryFile.metadata.size = fileTimestamps.size
              metadataLibraryFile.ino = fileTimestamps.ino
            }
          }
          const libraryItemDirTimestamps = await getFileTimestampsWithIno(libraryItem.path!)
          if (libraryItemDirTimestamps) {
            libraryItem.mtime = libraryItemDirTimestamps.mtimeMs
            libraryItem.ctime = libraryItemDirTimestamps.ctimeMs
            let size = 0
            libraryItem.libraryFiles!.forEach((lf) => (size += !isNaN(Number(lf.metadata.size)) ? Number(lf.metadata.size) : 0))
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
}
export = new PodcastScanner()
