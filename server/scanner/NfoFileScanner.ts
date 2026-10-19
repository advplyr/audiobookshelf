import { parseNfoMetadata } from '../utils/parsers/parseNfoMetadata'
import { readTextFile } from '../utils/fileUtils'
import type LibraryItem from '../models/LibraryItem'

type NfoMetadata = NonNullable<Awaited<ReturnType<typeof parseNfoMetadata>>>

class NfoFileScanner {
  constructor() {}

  /**
   * Parse metadata from .nfo file found in library scan and update bookMetadata
   */
  async scanBookNfoFile(nfoLibraryFileObj: Pick<LibraryItem.LibraryFileObject, 'metadata'>, bookMetadata: Record<string, unknown>) {
    const nfoText = await readTextFile(nfoLibraryFileObj.metadata.path)
    const nfoMetadata = nfoText ? parseNfoMetadata(nfoText) : null
    if (nfoMetadata) {
      for (const key in nfoMetadata) {
        const field = key as keyof NfoMetadata
        if (field === 'tags') {
          // Add tags only if tags are empty
          if (nfoMetadata.tags?.length) {
            bookMetadata.tags = nfoMetadata.tags
          }
        } else if (field === 'genres') {
          // Add genres only if genres are empty
          if (nfoMetadata.genres?.length) {
            bookMetadata.genres = nfoMetadata.genres
          }
        } else if (field === 'authors') {
          if (nfoMetadata.authors?.length) {
            bookMetadata.authors = nfoMetadata.authors
          }
        } else if (field === 'narrators') {
          if (nfoMetadata.narrators?.length) {
            bookMetadata.narrators = nfoMetadata.narrators
          }
        } else if (field === 'series') {
          if (nfoMetadata.series) {
            bookMetadata.series = [
              {
                name: nfoMetadata.series,
                sequence: nfoMetadata.sequence || null
              }
            ]
          }
        } else if (nfoMetadata[field] && field !== 'sequence') {
          bookMetadata[field] = nfoMetadata[field]
        }
      }
    }
  }
}

export = new NfoFileScanner()
