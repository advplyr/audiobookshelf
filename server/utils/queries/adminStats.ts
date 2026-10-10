import * as Sequelize from 'sequelize'
import type Book from '../../models/Book'
import Database from '../../Database'
import type PlaybackSession from '../../models/PlaybackSession'
import fsExtra from '../../libs/fsExtra'

type ListeningMetadata = { authors?: { name: string }[]; narrators?: string[]; genres?: string[] }
type BookStatsRow = Omit<Book, 'libraryItem'> & { libraryItem: { id: string; size: number | null } }
type TotalStatsRow = { totalSize: number | null; totalDuration: number | null; totalItems: number }
type MediaTypeStatsRow = { mediaType: string | null; totalSize: number | null; numItems: number }
type SizeObject = { totalSize: number; numItems: number }

const adminStats = {
  /**
   *
   * @param {number} year YYYY
   * @returns {Promise<PlaybackSession[]>}
   */
  async getListeningSessionsForYear(year: number): Promise<PlaybackSession[]> {
    const sessions = await Database.playbackSessionModel.findAll({
      where: {
        createdAt: {
          [Sequelize.Op.gte]: `${year}-01-01`,
          [Sequelize.Op.lt]: `${year + 1}-01-01`
        }
      }
    })
    return sessions
  },

  /**
   *
   * @param {number} year YYYY
   * @returns {Promise<number>}
   */
  async getNumAuthorsAddedForYear(year: number) {
    const count = await Database.authorModel.count({
      where: {
        createdAt: {
          [Sequelize.Op.gte]: `${year}-01-01`,
          [Sequelize.Op.lt]: `${year + 1}-01-01`
        }
      }
    })
    return count
  },

  /**
   *
   * @param {number} year YYYY
   * @returns {Promise<import('../../models/Book')[]>}
   */
  async getBooksAddedForYear(year: number) {
    // Statistics run after Database has initialized its connection.
    const sequelize = Database.sequelize as Sequelize.Sequelize
    const books = await Database.bookModel.findAll({
      attributes: ['id', 'title', 'coverPath', 'duration', 'createdAt'],
      where: {
        createdAt: {
          [Sequelize.Op.gte]: `${year}-01-01`,
          [Sequelize.Op.lt]: `${year + 1}-01-01`
        }
      },
      include: {
        model: Database.libraryItemModel,
        attributes: ['id', 'mediaId', 'mediaType', 'size'],
        required: true
      },
      order: sequelize.random()
    })
    // The required join selects an item ID and SQLite BIGINT size (returned as number).
    return books as unknown as BookStatsRow[]
  },

  /**
   *
   * @param {number} year YYYY
   */
  async getStatsForYear(year: number) {
    // Statistics run after Database has initialized its connection.
    const sequelize = Database.sequelize as Sequelize.Sequelize
    const booksAdded = await this.getBooksAddedForYear(year)

    let totalBooksAddedSize = 0
    let totalBooksAddedDuration = 0
    const booksWithCovers: string[] = []

    for (const book of booksAdded) {
      // Grab first 25 that have a cover
      if (book.coverPath && !booksWithCovers.includes(book.libraryItem.id) && booksWithCovers.length < 25 && (await fsExtra.pathExists(book.coverPath))) {
        booksWithCovers.push(book.libraryItem.id)
      }
      if (book.duration && !isNaN(book.duration)) {
        totalBooksAddedDuration += book.duration
      }
      if (book.libraryItem.size && !isNaN(book.libraryItem.size)) {
        totalBooksAddedSize += book.libraryItem.size
      }
    }

    const numAuthorsAdded = await this.getNumAuthorsAddedForYear(year)

    let authorListeningMap: Record<string, number> = {}
    let narratorListeningMap: Record<string, number> = {}
    let genreListeningMap: Record<string, number> = {}

    const listeningSessions = await this.getListeningSessionsForYear(year)
    let totalListeningTime = 0
    for (const ls of listeningSessions) {
      totalListeningTime += ls.timeListening || 0

      // Legacy playback metadata stores the author/narrator/genre arrays in this shape.
      const metadata = ls.mediaMetadata as ListeningMetadata | null | undefined
      const authors = metadata?.authors || []
      authors.forEach((au) => {
        if (!authorListeningMap[au.name]) authorListeningMap[au.name] = 0
        authorListeningMap[au.name] += ls.timeListening || 0
      })

      const narrators = metadata?.narrators || []
      narrators.forEach((narrator) => {
        if (!narratorListeningMap[narrator]) narratorListeningMap[narrator] = 0
        narratorListeningMap[narrator] += ls.timeListening || 0
      })

      // Filter out bad genres like "audiobook" and "audio book"
      const genres = (metadata?.genres || []).filter((g) => g && !g.toLowerCase().includes('audiobook') && !g.toLowerCase().includes('audio book'))
      genres.forEach((genre) => {
        if (!genreListeningMap[genre]) genreListeningMap[genre] = 0
        genreListeningMap[genre] += ls.timeListening || 0
      })
    }

    let topAuthors = null
    topAuthors = Object.keys(authorListeningMap)
      .map((authorName) => ({
        name: authorName,
        time: Math.round(authorListeningMap[authorName])
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 3)

    let topNarrators = null
    topNarrators = Object.keys(narratorListeningMap)
      .map((narratorName) => ({
        name: narratorName,
        time: Math.round(narratorListeningMap[narratorName])
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 3)

    let topGenres = null
    topGenres = Object.keys(genreListeningMap)
      .map((genre) => ({
        genre,
        time: Math.round(genreListeningMap[genre])
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 3)

    // Stats for total books, size and duration for everything added this year or earlier
    const [totalStatResultsRow] = await sequelize.query(`SELECT SUM(li.size) AS totalSize, SUM(b.duration) AS totalDuration, COUNT(*) AS totalItems FROM libraryItems li, books b WHERE b.id = li.mediaId AND li.mediaType = 'book' AND li.createdAt < ":nextYear-01-01";`, {
      replacements: {
        nextYear: year + 1
      }
    })
    // The SUM/COUNT projection above defines these raw result columns.
    const totalStatResults = (totalStatResultsRow as TotalStatsRow[])[0]

    return {
      numListeningSessions: listeningSessions.length,
      numBooksAdded: booksAdded.length,
      numAuthorsAdded,
      totalBooksAddedSize,
      totalBooksAddedDuration: Math.round(totalBooksAddedDuration),
      booksAddedWithCovers: booksWithCovers,
      totalBooksSize: totalStatResults?.totalSize || 0,
      totalBooksDuration: totalStatResults?.totalDuration || 0,
      totalListeningTime,
      numBooks: totalStatResults?.totalItems || 0,
      topAuthors,
      topNarrators,
      topGenres
    }
  },

  /**
   * Get total file size and number of items for books and podcasts
   *
   * @typedef {Object} SizeObject
   * @property {number} totalSize
   * @property {number} numItems
   *
   * @returns {Promise<{books: SizeObject, podcasts: SizeObject, total: SizeObject}}>}
   */
  async getTotalSize() {
    // Statistics run after Database has initialized its connection.
    const sequelize = Database.sequelize as Sequelize.Sequelize
    const [mediaTypeStats] = await sequelize.query(`SELECT li.mediaType, SUM(li.size) AS totalSize, COUNT(*) AS numItems FROM libraryItems li group by li.mediaType;`)
    const bookStats = (mediaTypeStats as MediaTypeStatsRow[]).find((m) => m.mediaType === 'book')
    const podcastStats = (mediaTypeStats as MediaTypeStatsRow[]).find((m) => m.mediaType === 'podcast')

    return {
      books: {
        totalSize: bookStats?.totalSize || 0,
        numItems: bookStats?.numItems || 0
      },
      podcasts: {
        totalSize: podcastStats?.totalSize || 0,
        numItems: podcastStats?.numItems || 0
      },
      total: {
        totalSize: (bookStats?.totalSize || 0) + (podcastStats?.totalSize || 0),
        numItems: (bookStats?.numItems || 0) + (podcastStats?.numItems || 0)
      }
    }
  },

  /**
   * Get total number of audio files for books and podcasts
   *
   * @returns {Promise<{numBookAudioFiles: number, numPodcastAudioFiles: number, numAudioFiles: number}>}
   */
  async getNumAudioFiles() {
    // Statistics run after Database has initialized its connection.
    const sequelize = Database.sequelize as Sequelize.Sequelize
    const [numBookAudioFilesRow] = await sequelize.query(`SELECT SUM(json_array_length(b.audioFiles)) AS numAudioFiles FROM books b;`)
    const numBookAudioFiles = (numBookAudioFilesRow as { numAudioFiles: number | null }[])[0]?.numAudioFiles || 0
    const numPodcastAudioFiles = await Database.podcastEpisodeModel.count()
    return {
      numBookAudioFiles,
      numPodcastAudioFiles,
      numAudioFiles: numBookAudioFiles + numPodcastAudioFiles
    }
  }
}


declare namespace adminStats {
  export type { SizeObject }
}

export = adminStats
