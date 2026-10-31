import { parseOpfMetadataXML } from '../utils/parsers/parseOpfMetadata'
import type { OpfMetadataResult } from '../utils/parsers/parseOpfMetadata'
import { readTextFile } from '../utils/fileUtils'
import type LibraryItem from '../models/LibraryItem'

class OpfFileScanner {
  constructor() {}

  /**
   * Parse metadata from .opf file found in library scan and update bookMetadata
   */
  async scanBookOpfFile(opfLibraryFileObj: Pick<LibraryItem.LibraryFileObject, 'metadata'>, bookMetadata: Record<string, unknown>) {
    const xmlText = await readTextFile(opfLibraryFileObj.metadata.path)
    const opfMetadata = xmlText ? await parseOpfMetadataXML(xmlText) : null
    if (opfMetadata) {
      for (const key in opfMetadata) {
        const field = key as keyof OpfMetadataResult
        if (field === 'tags') {
          // Add tags only if tags are empty
          if (opfMetadata.tags.length) {
            bookMetadata.tags = opfMetadata.tags
          }
        } else if (field === 'genres') {
          // Add genres only if genres are empty
          if (opfMetadata.genres.length) {
            bookMetadata.genres = opfMetadata.genres
          }
        } else if (field === 'authors') {
          if (opfMetadata.authors?.length) {
            bookMetadata.authors = opfMetadata.authors
          }
        } else if (field === 'narrators') {
          if (opfMetadata.narrators?.length) {
            bookMetadata.narrators = opfMetadata.narrators
          }
        } else if (field === 'series') {
          if (opfMetadata.series?.length) {
            bookMetadata.series = opfMetadata.series
          }
        } else if (opfMetadata[field] && key !== 'sequence') {
          bookMetadata[field] = opfMetadata[field]
        }
      }
    }
  }
}

export = new OpfFileScanner()
