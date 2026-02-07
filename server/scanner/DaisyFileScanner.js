const { parseDaisyMetadata } = require('../utils/parsers/parseDaisyMetadata')
const { readTextFile } = require('../utils/fileUtils')
const Path = require('path')

class DaisyFileScanner {
  constructor() {}

  /**
   * Parse metadata from DAISY ncc.html file found in library scan and update bookMetadata
   *
   * @param {import('../models/LibraryItem').LibraryFileObject} daisyLibraryFileObj
   * @param {Object} bookMetadata
   */
  async scanBookDaisyFile(daisyLibraryFileObj, bookMetadata, audioFiles = []) {
    const htmlText = await readTextFile(daisyLibraryFileObj.metadata.path, { detectEncoding: true, isHtml: true })
    const daisyMetadata = htmlText ? parseDaisyMetadata(htmlText) : null
    if (daisyMetadata) {
      for (const key in daisyMetadata) {
        if (key === 'tags') {
          if (daisyMetadata.tags.length) {
            bookMetadata.tags = daisyMetadata.tags
          }
        } else if (key === 'genres') {
          if (daisyMetadata.genres.length) {
            bookMetadata.genres = daisyMetadata.genres
          }
        } else if (key === 'authors') {
          if (daisyMetadata.authors?.length) {
            bookMetadata.authors = daisyMetadata.authors
          }
        } else if (key === 'narrators') {
          if (daisyMetadata.narrators?.length) {
            bookMetadata.narrators = daisyMetadata.narrators
          }
        } else if (key === 'chapters') {
          if (!daisyMetadata.chapters?.length) continue

          // DAISY ncc.html provides chapter names; preserve existing timings if available.
          if (bookMetadata.chapters?.length) {
            const updatedChapters = bookMetadata.chapters.map((chapter, index) => {
              const daisyChapter = daisyMetadata.chapters[index]
              if (!daisyChapter?.title) return chapter
              return {
                ...chapter,
                id: chapter.id ?? index,
                title: daisyChapter.title
              }
            })
            bookMetadata.chapters = updatedChapters
          } else {
            const chaptersFromFiles = this.buildChaptersFromAudioFiles(audioFiles, daisyMetadata.chapters)
            if (chaptersFromFiles.length) {
              bookMetadata.chapters = chaptersFromFiles
            }
          }
        } else if (daisyMetadata[key]) {
          bookMetadata[key] = daisyMetadata[key]
        }
      }
    }
  }

  /**
   * Build chapter timings from ordered audio files while applying DAISY chapter titles.
   * Falls back to file basenames if DAISY has fewer titles than files.
   *
   * @param {import('../models/Book').AudioFileObject[]} audioFiles
   * @param {{title:string}[]} daisyChapters
   * @returns {import('../models/Book').ChapterObject[]}
   */
  buildChaptersFromAudioFiles(audioFiles, daisyChapters) {
    if (!audioFiles?.length) return []

    const chapters = []
    let currentStartTime = 0
    let chapterId = 0

    audioFiles.forEach((audioFile) => {
      if (!audioFile.duration) return

      const fallbackTitle = audioFile.metadata?.filename
        ? Path.basename(audioFile.metadata.filename, Path.extname(audioFile.metadata.filename))
        : `Chapter ${chapterId + 1}`
      const title = daisyChapters[chapterId]?.title || fallbackTitle

      chapters.push({
        id: chapterId++,
        start: currentStartTime,
        end: currentStartTime + audioFile.duration,
        title
      })

      currentStartTime += audioFile.duration
    })

    return chapters
  }
}
module.exports = new DaisyFileScanner()
