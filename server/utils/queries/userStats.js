const Sequelize = require('sequelize')
const Database = require('../../Database')
const PlaybackSession = require('../../models/PlaybackSession')
const MediaProgress = require('../../models/MediaProgress')
const fsExtra = require('../../libs/fsExtra')

module.exports = {
  /**
   * Library ids with the library setting that excludes them from listening stats
   * @returns {Promise<Set<string>>}
   */
  async getStatsExcludedLibraryIds() {
    const libraries = await Database.libraryModel.findAll({ attributes: ['id', 'settings'] })
    return new Set(libraries.filter((lib) => lib.librarySettings?.excludeFromStats).map((lib) => lib.id))
  },

  /**
   * Library item ids and book ids that are excluded from listening stats
   * @returns {Promise<{ libraryItemIds: Set<string>, bookIds: Set<string> }>}
   */
  async getStatsExcludedLibraryItemIds() {
    const libraryItems = await Database.libraryItemModel.findAll({ where: { excludeFromStats: true }, attributes: ['id', 'mediaId', 'mediaType'] })
    return {
      libraryItemIds: new Set(libraryItems.map((li) => li.id)),
      bookIds: new Set(libraryItems.filter((li) => li.mediaType === 'book').map((li) => li.mediaId))
    }
  },

  /**
   * Check if an entity (playback session or media progress) is excluded from listening stats
   * @param {{ libraryId?: string, mediaItemId?: string, libraryItemId?: string, extraData?: Object, mediaItem?: { libraryItem?: { excludeFromStats?: boolean } } }} entity
   * @param {Set<string>} excludedLibraryIds
   * @param {{ libraryItemIds: Set<string>, bookIds: Set<string> }} excludedLibraryItems
   * @returns {boolean}
   */
  isExcludedFromStats(entity, excludedLibraryIds, excludedLibraryItems) {
    if (entity.libraryId && excludedLibraryIds.has(entity.libraryId)) return true
    if (entity.mediaItem?.libraryItem?.excludeFromStats) return true
    if (excludedLibraryItems.libraryItemIds.has(entity.libraryItemId || entity.extraData?.libraryItemId)) return true
    if (excludedLibraryItems.bookIds.has(entity.mediaItemId)) return true
    return false
  },

  /**
   *
   * @param {string} userId
   * @param {number} year YYYY
   * @returns {Promise<PlaybackSession[]>}
   */
  async getUserListeningSessionsForYear(userId, year) {
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
        include: {
          model: Database.libraryItemModel,
          attributes: ['id', 'mediaId', 'mediaType', 'excludeFromStats']
        },
        required: false
      },
      order: Database.sequelize.random()
    })
    const excludedLibraryIds = await this.getStatsExcludedLibraryIds()
    const excludedLibraryItems = await this.getStatsExcludedLibraryItemIds()
    return sessions.filter((session) => !this.isExcludedFromStats(session, excludedLibraryIds, excludedLibraryItems))
  },

  /**
   *
   * @param {string} userId
   * @param {number} year YYYY
   * @returns {Promise<MediaProgress[]>}
   */
  async getBookMediaProgressFinishedForYear(userId, year) {
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
        include: {
          model: Database.libraryItemModel,
          attributes: ['id', 'mediaId', 'mediaType', 'excludeFromStats']
        },
        required: true
      },
      order: Database.sequelize.random()
    })
    const excludedLibraryIds = await this.getStatsExcludedLibraryIds()
    const excludedLibraryItems = await this.getStatsExcludedLibraryItemIds()
    return progresses.filter((progress) => !this.isExcludedFromStats(progress, excludedLibraryIds, excludedLibraryItems))
  },

  /**
   * @param {string} userId
   * @param {number} year YYYY
   */
  async getStatsForYear(userId, year) {
    const listeningSessions = await this.getUserListeningSessionsForYear(userId, year)
    const bookProgressesFinished = await this.getBookMediaProgressFinishedForYear(userId, year)

    let totalBookListeningTime = 0
    let totalPodcastListeningTime = 0
    let totalListeningTime = 0

    let authorListeningMap = {}
    let genreListeningMap = {}
    let narratorListeningMap = {}
    let monthListeningMap = {}
    let bookListeningMap = {}

    const booksWithCovers = []
    const finishedBooksWithCovers = []

    // Get finished book stats
    const numBooksFinished = bookProgressesFinished.length
    let longestAudiobookFinished = null
    for (const mediaProgress of bookProgressesFinished) {
      // Grab first 5 that have a cover
      if (mediaProgress.mediaItem?.coverPath && !finishedBooksWithCovers.includes(mediaProgress.mediaItem.libraryItem.id) && finishedBooksWithCovers.length < 5 && (await fsExtra.pathExists(mediaProgress.mediaItem.coverPath))) {
        finishedBooksWithCovers.push(mediaProgress.mediaItem.libraryItem.id)
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
      if (ls.mediaItem?.coverPath && !booksWithCovers.includes(ls.mediaItem.libraryItem.id) && !finishedBooksWithCovers.includes(ls.mediaItem.libraryItem.id) && booksWithCovers.length < 25 && (await fsExtra.pathExists(ls.mediaItem.coverPath))) {
        booksWithCovers.push(ls.mediaItem.libraryItem.id)
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

        const authors = ls.mediaMetadata?.authors || []
        authors.forEach((au) => {
          if (!authorListeningMap[au.name]) authorListeningMap[au.name] = 0
          authorListeningMap[au.name] += listeningSessionListeningTime
        })

        const narrators = ls.mediaMetadata?.narrators || []
        narrators.forEach((narrator) => {
          if (!narratorListeningMap[narrator]) narratorListeningMap[narrator] = 0
          narratorListeningMap[narrator] += listeningSessionListeningTime
        })

        // Filter out bad genres like "audiobook" and "audio book"
        const genres = (ls.mediaMetadata?.genres || []).filter((g) => g && !g.toLowerCase().includes('audiobook') && !g.toLowerCase().includes('audio book'))
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

    let mostListenedNarrator = null
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

    let mostListenedMonth = null
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
