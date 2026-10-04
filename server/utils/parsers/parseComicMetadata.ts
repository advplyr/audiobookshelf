import Path from 'path'
import Logger from '../../Logger'
import type { EBookFileObject } from '../../models/Book'
import globals from '../globals'
import { xmlToJSON } from '../index'
import { createComicBookExtractor } from '../comicBookExtractors'
import { parse as parseComicInfoMetadata } from './parseComicInfoMetadata'

type ComicInfoDocument = Parameters<typeof parseComicInfoMetadata>[0]
import type { EBookFileScanData } from './parseEbookMetadata'

/**
 * Extract a cover image from a comic. Returns true on success.
 */
export async function extractCoverImage(comicPath: string, comicImageFilepath: string, outputCoverPath: string): Promise<boolean> {
  let archive: ReturnType<typeof createComicBookExtractor> | null = null
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

/**
 * Parse metadata from a comic.
 */
export async function parse(ebookFile: EBookFileObject): Promise<EBookFileScanData | null> {
  const comicPath = ebookFile.metadata.path
  Logger.debug(`[parseComicMetadata] Parsing comic metadata at "${comicPath}"`)
  let archive: ReturnType<typeof createComicBookExtractor> | null = null
  try {
    archive = createComicBookExtractor(comicPath)
    await archive.open()

    // A missing path list throws on sort, which the catch below reports.
    const filePaths = (await archive.getFilePaths().catch((error: unknown) => {
      Logger.error(`[parseComicMetadata] Failed to get file paths from comic at "${comicPath}"`, error)
    })) as string[]

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
      // Archive contents and parsed XML are checked at the metadata boundary.
      const comicInfoData = (await archive.extractToBuffer(comicInfoPath)) as AllowSharedBufferSource | null | undefined
      if (comicInfoData) {
        const comicInfoStr = new TextDecoder().decode(comicInfoData)
        const comicInfoJson = (await xmlToJSON(comicInfoStr)) as ComicInfoDocument
        if (comicInfoJson) {
          metadata = parseComicInfoMetadata(comicInfoJson)
        }
      }
    }

    const payload: EBookFileScanData = {
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
