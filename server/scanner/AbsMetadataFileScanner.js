const Path = require('path')
const fsExtra = require('../libs/fsExtra')
const { readTextFile } = require('../utils/fileUtils')
const { LogLevel } = require('../utils/constants')
const abmetadataGenerator = require('../utils/generators/abmetadataGenerator')

class AbsMetadataFileScanner {
  constructor() { }

  /**
   * Check for metadata.json or metadata.abs file and set book metadata
   * 
   * @param {import('./LibraryScan')} libraryScan 
   * @param {import('./LibraryItemScanData')} libraryItemData 
   * @param {Object} bookMetadata 
   * @param {string} [existingLibraryItemId] 
   */
  async scanBookMetadataFile(libraryScan, libraryItemData, bookMetadata, existingLibraryItemId = null) {
    const metadataLibraryFile = libraryItemData.metadataJsonLibraryFile || libraryItemData.metadataAbsLibraryFile
    let metadataText = metadataLibraryFile ? await readTextFile(metadataLibraryFile.metadata.path) : null
    let metadataFilePath = metadataLibraryFile?.metadata.path
    let metadataFileFormat = libraryItemData.metadataJsonLibraryFile ? 'json' : 'abs'

    // When metadata file is not stored with library item then check in the /metadata/items folder for it
    if (!metadataText && existingLibraryItemId) {
      let metadataPath = Path.join(global.MetadataPath, 'items', existingLibraryItemId)

      let altFormat = global.ServerSettings.metadataFileFormat === 'json' ? 'abs' : 'json'
      // First check the metadata format set in server settings, fallback to the alternate
      metadataFilePath = Path.join(metadataPath, `metadata.${global.ServerSettings.metadataFileFormat}`)
      metadataFileFormat = global.ServerSettings.metadataFileFormat
      if (await fsExtra.pathExists(metadataFilePath)) {
        metadataText = await readTextFile(metadataFilePath)
      } else if (await fsExtra.pathExists(Path.join(metadataPath, `metadata.${altFormat}`))) {
        metadataFilePath = Path.join(metadataPath, `metadata.${altFormat}`)
        metadataFileFormat = altFormat
        metadataText = await readTextFile(metadataFilePath)
      }
    }

    if (metadataText) {
      libraryScan.addLog(LogLevel.INFO, `Found metadata file "${metadataFilePath}" - preferring`)
      let abMetadata = null
      if (metadataFileFormat === 'json') {
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
          if (abMetadata.metadata[key] === undefined) continue
          bookMetadata[key] = abMetadata.metadata[key]
        }
      }
    }
  }
}
module.exports = new AbsMetadataFileScanner()