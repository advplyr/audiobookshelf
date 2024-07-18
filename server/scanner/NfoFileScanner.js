const { parseNfoMetadata } = require('../utils/parsers/parseNfoMetadata')
const { readTextFile } = require('../utils/fileUtils')

class NfoFileScanner {
  constructor() {}

  /**
   * Parse metadata from .nfo file found in library scan and update bookMetadata
   *
   * @param {import('../models/LibraryItem').LibraryFileObject} nfoLibraryFileObj
   * @param {Object} bookMetadata
   */
  async scanBookNfoFile(nfoLibraryFileObj, bookMetadata) {
    const nfoText = await readTextFile(nfoLibraryFileObj.metadata.path)
    const nfoMetadata = nfoText ? await parseNfoMetadata(nfoText) : null
    if (nfoMetadata) {
      for (const key in nfoMetadata) {
        if (key === 'tags') {
          // Add tags only if tags are empty
          if (nfoMetadata.tags.length) {
            bookMetadata.tags = nfoMetadata.tags
          }
        } else if (key === 'genres') {
          // Add genres only if genres are empty
          if (nfoMetadata.genres.length) {
            bookMetadata.genres = nfoMetadata.genres
          }
        } else if (key === 'authors') {
          if (nfoMetadata.authors?.length) {
            bookMetadata.authors = nfoMetadata.authors
          }
        } else if (key === 'narrators') {
          if (nfoMetadata.narrators?.length) {
            bookMetadata.narrators = nfoMetadata.narrators
          }
        } else if (key === 'series') {
          if (nfoMetadata.series) {
            bookMetadata.series = [
              {
                name: nfoMetadata.series,
                sequence: nfoMetadata.sequence || null
              }
            ]
          }
        } else if (nfoMetadata[key] && key !== 'sequence') {
          bookMetadata[key] = nfoMetadata[key]
        }
      }
    }
  }
}
module.exports = new NfoFileScanner()
