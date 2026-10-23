import Path from 'path'
import fsExtra from '../libs/fsExtra'
import { readTextFile } from '../utils/fileUtils'
import { LogLevel } from '../utils/constants'
import { parseJson } from '../utils/generators/abmetadataGenerator'
import type LibraryScan from './LibraryScan'
import type LibraryItemScanData from './LibraryItemScanData'

// parseJson only returns arrays for the authors, genres, tags and chapters keys
const hasItems = (value: unknown): boolean => Array.isArray(value) && value.length > 0

class AbsMetadataFileScanner {
  constructor() {}

  /**
   * Check for metadata.json file and set book metadata
   */
  async scanBookMetadataFile(libraryScan: LibraryScan, libraryItemData: LibraryItemScanData, bookMetadata: Record<string, unknown>, existingLibraryItemId: string | null = null) {
    const metadataLibraryFile = libraryItemData.metadataJsonLibraryFile
    let metadataText = metadataLibraryFile ? await readTextFile(metadataLibraryFile.metadata.path) : null
    let metadataFilePath = metadataLibraryFile?.metadata.path

    // When metadata file is not stored with library item then check in the /metadata/items folder for it
    if (!metadataText && existingLibraryItemId) {
      const metadataPath = Path.join(global.MetadataPath!, 'items', existingLibraryItemId)

      metadataFilePath = Path.join(metadataPath, 'metadata.json')
      if (await fsExtra.pathExists(metadataFilePath)) {
        metadataText = await readTextFile(metadataFilePath)
      }
    }

    if (metadataText) {
      libraryScan.addLog(LogLevel.INFO, `Found metadata file "${metadataFilePath}"`)
      const abMetadata = parseJson(metadataText, 'book') || {}

      for (const key in abMetadata) {
        // TODO: When to override with null or empty arrays?
        if (abMetadata[key] === undefined || abMetadata[key] === null) continue
        if (key === 'authors' && !hasItems(abMetadata.authors)) continue
        if (key === 'genres' && !hasItems(abMetadata.genres)) continue
        if (key === 'tags' && !hasItems(abMetadata.tags)) continue
        if (key === 'chapters' && !hasItems(abMetadata.chapters)) continue

        bookMetadata[key] = abMetadata[key]
      }
    }
  }

  /**
   * Check for metadata.json file and set podcast metadata
   */
  async scanPodcastMetadataFile(libraryScan: LibraryScan, libraryItemData: LibraryItemScanData, podcastMetadata: Record<string, unknown>, existingLibraryItemId: string | null = null) {
    const metadataLibraryFile = libraryItemData.metadataJsonLibraryFile
    let metadataText = metadataLibraryFile ? await readTextFile(metadataLibraryFile.metadata.path) : null
    let metadataFilePath = metadataLibraryFile?.metadata.path

    // When metadata file is not stored with library item then check in the /metadata/items folder for it
    if (!metadataText && existingLibraryItemId) {
      const metadataPath = Path.join(global.MetadataPath!, 'items', existingLibraryItemId)

      metadataFilePath = Path.join(metadataPath, 'metadata.json')
      if (await fsExtra.pathExists(metadataFilePath)) {
        metadataText = await readTextFile(metadataFilePath)
      }
    }

    if (metadataText) {
      libraryScan.addLog(LogLevel.INFO, `Found metadata file "${metadataFilePath}"`)
      const abMetadata = parseJson(metadataText, 'podcast') || {}
      for (const key in abMetadata) {
        if (abMetadata[key] === undefined || abMetadata[key] === null) continue
        if (key === 'tags' && !hasItems(abMetadata.tags)) continue

        podcastMetadata[key] = abMetadata[key]
      }
    }
  }
}

export = new AbsMetadataFileScanner()
