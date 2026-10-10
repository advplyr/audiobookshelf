import * as Sequelize from 'sequelize'
import type Book from '../../models/Book'
import Database from '../../Database'
import type PlaybackSession from '../../models/PlaybackSession'
import type MediaProgress from '../../models/MediaProgress'
import fsExtra from '../../libs/fsExtra'

type ListeningStatsSession = Omit<PlaybackSession, 'mediaItem'> & { mediaItem?: Book | null }
type FinishedStatsProgress = Omit<MediaProgress, 'mediaItem'> & { mediaItem: Book }
type ListeningMetadata = { authors?: { name: string }[]; narrators?: string[]; genres?: string[] }
type LongestAudiobook = { id: string; title: string | null; duration: number; finishedAt: MediaProgress['finishedAt'] }

const userStats = {
  /**
   *
   * @param {string} userId
   * @param {number} year YYYY
   * @returns {Promise<PlaybackSession[]>}
   */
  async getUserListeningSessionsForYear(userId: string, year: number) {
    // Statistics are requested after connection and model initialization.
    const sequelize = Database.sequelize as Sequelize.Sequelize
    const sessions = await Database.playbackSessionModel.findAll({
      where: {
        userId,
        createdAt: {
          [Sequelize.Op.gte]: `${year}-01-01`,
          [Sequelize.Op.lt]: `${year + 1}-01-01`
        }
      },
      include: {
        model: Database.bookModel,
        attributes: ['id', 'coverPath'],
        // Sequelize normalizes single includes to arrays; use that form for strict typings.
        include: [{
          model: Database.libraryItemModel,
          attributes: ['id', 'mediaId', 'mediaType']
        }],
        required: false
      },
      order: sequelize.random()
    })
    // Only books are included; missing book associations remain null.
    return sessions as ListeningStatsSession[]
  },

  /**
   *
   * @param {string} userId
   * @param {number} year YYYY
   * @returns {Promise<MediaProgress[]>}
   */
  async getBookMediaProgressFinishedForYear(userId: string, year: number) {
    // Statistics are requested after connection and model initialization.
    const sequelize = Database.sequelize as Sequelize.Sequelize
    const progresses = await Database.mediaProgressModel.findAll({
      where: {
        userId,
        mediaItemType: 'book',
        finishedAt: {
          [Sequelize.Op.gte]: `${year}-01-01`,
          [Sequelize.Op.lt]: `${year + 1}-01-01`
        }
      },
      include: {
        model: Database.bookModel,
        attributes: ['id', 'title', 'coverPath'],
        // Sequelize normalizes single includes to arrays; use that form for strict typings.
        include: [{
          model: Database.libraryItemModel,
          attributes: ['id', 'mediaId', 'mediaType']
        }],
        required: true
      },
      order: sequelize.random()
    })
    // The required book join guarantees a populated mediaItem for these rows.
    return progresses as FinishedStatsProgress[]
  },

  /**
   * @param {string} userId
   * @param {number} year YYYY
   */
  async getStatsForYear(userId: string, year: number) {
    const listeningSessions = await this.getUserListeningSessionsForYear(userId, year)
    const bookProgressesFinished = await this.getBookMediaProgressFinishedForYear(userId, year)

    let totalBookListeningTime = 0
    let totalPodcastListeningTime = 0
    let totalListeningTime = 0

    let authorListeningMap: Record<string, number> = {}
    let genreListeningMap: Record<string, number> = {}
    let narratorListeningMap: Record<string, number> = {}
    let monthListeningMap: Record<string, number> = {}
    let bookListeningMap: Record<string, number> = {}

    const booksWithCovers: string[] = []
    const finishedBooksWithCovers: string[] = []

    // Get finished book stats
    const numBooksFinished = bookProgressesFinished.length
    let longestAudiobookFinished: LongestAudiobook | null = null
    for (const mediaProgress of bookProgressesFinished) {
      // Grab first 5 that have a cover
      if (mediaProgress.mediaItem?.coverPath && !finishedBooksWithCovers.includes(mediaProgress.mediaItem.libraryItem!.id) && finishedBooksWithCovers.length < 5 && (await fsExtra.pathExists(mediaProgress.mediaItem.coverPath))) {
        finishedBooksWithCovers.push(mediaProgress.mediaItem.libraryItem!.id)
      }

      if (mediaProgress.duration && (!longestAudiobookFinished?.duration || mediaProgress.duration > longestAudiobookFinished.duration)) {
        longestAudiobookFinished = {
          id: mediaProgress.mediaItem.id,
          title: mediaProgress.mediaItem.title,
          duration: Math.round(mediaProgress.duration),
          finishedAt: mediaProgress.finishedAt
        }
      }
    }

    // Get listening session stats
    for (const ls of listeningSessions) {
      // Grab first 25 that have a cover
      if (ls.mediaItem?.coverPath && !booksWithCovers.includes(ls.mediaItem.libraryItem!.id) && !finishedBooksWithCovers.includes(ls.mediaItem.libraryItem!.id) && booksWithCovers.length < 25 && (await fsExtra.pathExists(ls.mediaItem.coverPath))) {
        booksWithCovers.push(ls.mediaItem.libraryItem!.id)
      }

      const listeningSessionListeningTime = ls.timeListening || 0

      const lsMonth = ls.createdAt.getMonth()
      if (!monthListeningMap[lsMonth]) monthListeningMap[lsMonth] = 0
      monthListeningMap[lsMonth] += listeningSessionListeningTime

      totalListeningTime += listeningSessionListeningTime
      if (ls.mediaItemType === 'book') {
        totalBookListeningTime += listeningSessionListeningTime

        if (ls.displayTitle && !bookListeningMap[ls.displayTitle]) {
          bookListeningMap[ls.displayTitle] = listeningSessionListeningTime
        } else if (ls.displayTitle) {
          bookListeningMap[ls.displayTitle] += listeningSessionListeningTime
        }

        // Playback metadata retains the legacy author/narrator/genre array shape.
        const metadata = ls.mediaMetadata as ListeningMetadata | null | undefined
        const authors = metadata?.authors || []
        authors.forEach((au) => {
          if (!authorListeningMap[au.name]) authorListeningMap[au.name] = 0
          authorListeningMap[au.name] += listeningSessionListeningTime
        })

        const narrators = metadata?.narrators || []
        narrators.forEach((narrator) => {
          if (!narratorListeningMap[narrator]) narratorListeningMap[narrator] = 0
          narratorListeningMap[narrator] += listeningSessionListeningTime
        })

        // Filter out bad genres like "audiobook" and "audio book"
        const genres = (metadata?.genres || []).filter((g) => g && !g.toLowerCase().includes('audiobook') && !g.toLowerCase().includes('audio book'))
        genres.forEach((genre) => {
          if (!genreListeningMap[genre]) genreListeningMap[genre] = 0
          genreListeningMap[genre] += listeningSessionListeningTime
        })
      } else {
        totalPodcastListeningTime += listeningSessionListeningTime
      }
    }

    totalListeningTime = Math.round(totalListeningTime)
    totalBookListeningTime = Math.round(totalBookListeningTime)
    totalPodcastListeningTime = Math.round(totalPodcastListeningTime)

    let topAuthors = null
    topAuthors = Object.keys(authorListeningMap)
      .map((authorName) => ({
        name: authorName,
        time: Math.round(authorListeningMap[authorName])
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 3)

    let mostListenedNarrator: { name: string; time: number } | null = null
    for (const narrator in narratorListeningMap) {
      if (!mostListenedNarrator?.time || narratorListeningMap[narrator] > mostListenedNarrator.time) {
        mostListenedNarrator = {
          time: Math.round(narratorListeningMap[narrator]),
          name: narrator
        }
      }
    }

    let topGenres = null
    topGenres = Object.keys(genreListeningMap)
      .map((genre) => ({
        genre,
        time: Math.round(genreListeningMap[genre])
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 3)

    let mostListenedMonth: { month: number; time: number } | null = null
    for (const month in monthListeningMap) {
      if (!mostListenedMonth?.time || monthListeningMap[month] > mostListenedMonth.time) {
        mostListenedMonth = {
          month: Number(month),
          time: Math.round(monthListeningMap[month])
        }
      }
    }

    return {
      totalListeningSessions: listeningSessions.length,
      totalListeningTime,
      totalBookListeningTime,
      totalPodcastListeningTime,
      topAuthors,
      topGenres,
      mostListenedNarrator,
      mostListenedMonth,
      numBooksFinished,
      numBooksListened: Object.keys(bookListeningMap).length,
      longestAudiobookFinished,
      booksWithCovers,
      finishedBooksWithCovers
    }
  }
}


export = userStats
