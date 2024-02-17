const Path = require('path')
const fsExtra = require('../libs/fsExtra')
const { readTextFile } = require('../utils/fileUtils')
const { LogLevel } = require('../utils/constants')
const abmetadataGenerator = require('../utils/generators/abmetadataGenerator')

class AbsMetadataFileScanner {
  constructor() { }

  /**
   * Check for metadata.json file and set book metadata
   * 
   * @param {import('./LibraryScan')} libraryScan 
   * @param {import('./LibraryItemScanData')} libraryItemData 
   * @param {Object} bookMetadata 
   * @param {string} [existingLibraryItemId] 
   */
  async scanBookMetadataFile(libraryScan, libraryItemData, bookMetadata, existingLibraryItemId = null) {
    const metadataLibraryFile = libraryItemData.metadataJsonLibraryFile
    let metadataText = metadataLibraryFile ? await readTextFile(metadataLibraryFile.metadata.path) : null
    let metadataFilePath = metadataLibraryFile?.metadata.path

    // When metadata file is not stored with library item then check in the /metadata/items folder for it
    if (!metadataText && existingLibraryItemId) {
      let metadataPath = Path.join(global.MetadataPath, 'items', existingLibraryItemId)

      metadataFilePath = Path.join(metadataPath, 'metadata.json')
      if (await fsExtra.pathExists(metadataFilePath)) {
        metadataText = await readTextFile(metadataFilePath)
      }
    }

    if (metadataText) {
      libraryScan.addLog(LogLevel.INFO, `Found metadata file "${metadataFilePath}"`)
      const abMetadata = abmetadataGenerator.parseJson(metadataText) || {}
      for (const key in abMetadata) {
        // TODO: When to override with null or empty arrays?
        if (abMetadata[key] === undefined || abMetadata[key] === null) continue
        if (key === 'authors' && !abMetadata.authors?.length) continue
        if (key === 'genres' && !abMetadata.genres?.length) continue
        if (key === 'tags' && !abMetadata.tags?.length) continue
        if (key === 'chapters' && !abMetadata.chapters?.length) continue

        bookMetadata[key] = abMetadata[key]
      }
    }
  }

  /**
   * Check for metadata.json file and set podcast metadata
   * 
   * @param {import('./LibraryScan')} libraryScan 
   * @param {import('./LibraryItemScanData')} libraryItemData 
   * @param {Object} podcastMetadata 
   * @param {string} [existingLibraryItemId] 
   */
  async scanPodcastMetadataFile(libraryScan, libraryItemData, podcastMetadata, existingLibraryItemId = null) {
    const metadataLibraryFile = libraryItemData.metadataJsonLibraryFile
    let metadataText = metadataLibraryFile ? await readTextFile(metadataLibraryFile.metadata.path) : null
    let metadataFilePath = metadataLibraryFile?.metadata.path

    // When metadata file is not stored with library item then check in the /metadata/items folder for it
    if (!metadataText && existingLibraryItemId) {
      let metadataPath = Path.join(global.MetadataPath, 'items', existingLibraryItemId)

      metadataFilePath = Path.join(metadataPath, 'metadata.json')
      if (await fsExtra.pathExists(metadataFilePath)) {
        metadataText = await readTextFile(metadataFilePath)
      }
    }

    if (metadataText) {
      libraryScan.addLog(LogLevel.INFO, `Found metadata file "${metadataFilePath}"`)
      const abMetadata = abmetadataGenerator.parseJson(metadataText) || {}
      for (const key in abMetadata) {
        if (abMetadata[key] === undefined || abMetadata[key] === null) continue
        if (key === 'tags' && !abMetadata.tags?.length) continue

        podcastMetadata[key] = abMetadata[key]
      }
    }
  }
}
module.exports = new AbsMetadataFileScanner()