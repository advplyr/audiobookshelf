const Path = require('path')
const Logger = require('../../Logger')
const parseComicInfoMetadata = require('./parseComicInfoMetadata')
const globals = require('../globals')
const { xmlToJSON } = require('../index')
const { createComicBookExtractor } = require('../comicBookExtractors.js')

/**
 * Extract cover image from comic return true if success
 *
 * @param {string} comicPath
 * @param {string} comicImageFilepath
 * @param {string} outputCoverPath
 * @returns {Promise<boolean>}
 */
async function extractCoverImage(comicPath, comicImageFilepath, outputCoverPath) {
  let archive = null
  try {
    archive = createComicBookExtractor(comicPath)
    await archive.open()
    return await archive.extractToFile(comicImageFilepath, outputCoverPath)
  } catch (error) {
    Logger.error(`[parseComicMetadata] Failed to extract image "${comicImageFilepath}" from comicPath "${comicPath}" into "${outputCoverPath}"`, error)
    return false
  } finally {
    // Ensure we free the memory
    archive?.close()
  }
}
module.exports.extractCoverImage = extractCoverImage

/**
 * Parse metadata from comic
 *
 * @param {import('../../models/Book').EBookFileObject} ebookFile
 * @returns {Promise<import('./parseEbookMetadata').EBookFileScanData>}
 */
async function parse(ebookFile) {
  const comicPath = ebookFile.metadata.path
  Logger.debug(`[parseComicMetadata] Parsing comic metadata at "${comicPath}"`)
  let archive = null
  try {
    archive = createComicBookExtractor(comicPath)
    await archive.open()

    const filePaths = await archive.getFilePaths().catch((error) => {
      Logger.error(`[parseComicMetadata] Failed to get file paths from comic at "${comicPath}"`, error)
    })

    // Sort the file paths in a natural order to get the first image
    filePaths.sort((a, b) => {
      return a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    })

    let metadata = null
    const comicInfoPath = filePaths.find((filePath) => filePath === 'ComicInfo.xml')
    if (comicInfoPath) {
      const comicInfoData = await archive.extractToBuffer(comicInfoPath)
      if (comicInfoData) {
        const comicInfoStr = new TextDecoder().decode(comicInfoData)
        const comicInfoJson = await xmlToJSON(comicInfoStr)
        if (comicInfoJson) {
          metadata = parseComicInfoMetadata.parse(comicInfoJson)
        }
      }
    }

    const payload = {
      path: comicPath,
      ebookFormat: ebookFile.ebookFormat,
      metadata
    }

    const firstImagePath = filePaths.find((filePath) => globals.SupportedImageTypes.includes(Path.extname(filePath).toLowerCase().slice(1)))
    if (firstImagePath) {
      payload.ebookCoverPath = firstImagePath
    } else {
      Logger.warn(`[parseComicMetadata] Cover image not found in comic at "${comicPath}"`)
    }

    return payload
  } catch (error) {
    Logger.error(`[parseComicMetadata] Failed to parse comic metadata at "${comicPath}"`, error)
    return null
  } finally {
    // Ensure we free the memory
    archive?.close()
  }
}
module.exports.parse = parse
