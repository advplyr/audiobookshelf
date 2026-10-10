const Path = require('path')
const { DataTypes, Model } = require('sequelize')
const uuidv4 = require('uuid').v4
const Logger = require('../Logger')
const date = require('../libs/dateAndTime')
const { secondsToTimestamp } = require('../utils')

class FeedEpisode extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.title
    /** @type {string} */
    this.author
    /** @type {string} */
    this.description
    /** @type {string} */
    this.siteURL
    /** @type {string} */
    this.enclosureURL
    /** @type {string} */
    this.enclosureType
    /** @type {BigInt} */
    this.enclosureSize
    /** @type {string} */
    this.pubDate
    /** @type {string} */
    this.season
    /** @type {string} */
    this.episode
    /** @type {string} */
    this.episodeType
    /** @type {number} */
    this.duration
    /** @type {string} */
    this.filePath
    /** @type {boolean} */
    this.explicit
    /** @type {UUIDV4} */
    this.feedId
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  /**
   *
   * @param {import('./LibraryItem').LibraryItemExpanded} libraryItemExpanded
   * @param {import('./Feed')} feed
   * @param {string} slug
   * @param {import('./PodcastEpisode')} episode
   * @param {string} [existingEpisodeId]
   */
  static getFeedEpisodeObjFromPodcastEpisode(libraryItemExpanded, feed, slug, episode, existingEpisodeId = null) {
    const episodeId = existingEpisodeId || uuidv4()
    return {
      id: episodeId,
      title: episode.title,
      author: feed.author,
      description: episode.description,
      siteURL: feed.siteURL,
      enclosureURL: `/feed/${slug}/item/${episodeId}/media${Path.extname(episode.audioFile.metadata.filename)}`,
      enclosureType: episode.audioFile.mimeType,
      enclosureSize: episode.audioFile.metadata.size,
      pubDate: episode.pubDate,
      season: episode.season,
      episode: episode.episode,
      episodeType: episode.episodeType,
      duration: episode.audioFile.duration,
      filePath: episode.audioFile.metadata.path,
      explicit: libraryItemExpanded.media.explicit,
      feedId: feed.id
    }
  }

  /**
   *
   * @param {import('./LibraryItem').LibraryItemExpanded} libraryItemExpanded
   * @param {import('./Feed')} feed
   * @param {string} slug
   * @param {import('sequelize').Transaction} transaction
   * @returns {Promise<FeedEpisode[]>}
   */
  static async createFromPodcastEpisodes(libraryItemExpanded, feed, slug, transaction) {
    const feedEpisodeObjs = []

    // Sort podcastEpisodes by pubDate. episodic is newest to oldest. serial is oldest to newest.
    if (feed.podcastType === 'episodic') {
      libraryItemExpanded.media.podcastEpisodes.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    } else {
      libraryItemExpanded.media.podcastEpisodes.sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate))
    }

    let numExisting = 0
    for (const episode of libraryItemExpanded.media.podcastEpisodes) {
      // Check for existing episode by filepath
      const existingEpisode = feed.feedEpisodes?.find((feedEpisode) => {
        return feedEpisode.filePath === episode.audioFile.metadata.path
      })
      numExisting = existingEpisode ? numExisting + 1 : numExisting

      feedEpisodeObjs.push(this.getFeedEpisodeObjFromPodcastEpisode(libraryItemExpanded, feed, slug, episode, existingEpisode?.id))
    }
    Logger.info(`[FeedEpisode] Upserting ${feedEpisodeObjs.length} episodes for feed ${feed.id} (${numExisting} existing)`)
    return this.bulkCreate(feedEpisodeObjs, { transaction, updateOnDuplicate: ['title', 'author', 'description', 'siteURL', 'enclosureURL', 'enclosureType', 'enclosureSize', 'pubDate', 'season', 'episode', 'episodeType', 'duration', 'filePath', 'explicit'] })
  }

  /**
   * If chapters for an audiobook match the audio tracks then use chapter titles instead of audio file names
   *
   * @param {import('./Book').AudioTrack[]} trackList
   * @param {import('./Book')} book
   * @returns {boolean}
   */
  static checkUseChapterTitlesForEpisodes(trackList, book) {
    const chapters = book.chapters || []
    if (trackList.length !== chapters.length) return false
    for (let i = 0; i < trackList.length; i++) {
      if (Math.abs(chapters[i].start - trackList[i].startOffset) >= 1) {
        return false
      }
    }
    return true
  }

  /**
   *
   * @param {import('./Book')} book
   * @param {Date} pubDateStart
   * @param {import('./Feed')} feed
   * @param {string} slug
   * @param {import('./Book').AudioFileObject} audioTrack
   * @param {boolean} useChapterTitles
   * @param {number} offsetIndex
   * @param {string} [existingEpisodeId]
   */
  static getFeedEpisodeObjFromAudiobookTrack(book, pubDateStart, feed, slug, audioTrack, useChapterTitles, offsetIndex, existingEpisodeId = null) {
    // Example: <pubDate>Fri, 04 Feb 2015 00:00:00 GMT</pubDate>
    // Offset pubdate in 1 minute intervals to ensure correct order
    const timeOffset = offsetIndex * 60000
    const episodeId = existingEpisodeId || uuidv4()

    // e.g. Track 1 will have a pub date before Track 2
    const audiobookPubDate = date.format(new Date(pubDateStart.valueOf() + timeOffset), 'ddd, DD MMM YYYY HH:mm:ss [GMT]')

    const contentUrl = `/feed/${slug}/item/${episodeId}/media${Path.extname(audioTrack.metadata.filename)}`

    let title = Path.basename(audioTrack.metadata.filename, Path.extname(audioTrack.metadata.filename))
    if (book.includedAudioFiles.length == 1) {
      // If audiobook is a single file, use book title instead of chapter/file title
      title = book.title
    } else {
      if (useChapterTitles) {
        // If audio track start and chapter start are within 1 seconds of eachother then use the chapter title
        const matchingChapter = book.chapters.find((ch) => Math.abs(ch.start - audioTrack.startOffset) < 1)
        if (matchingChapter?.title) title = matchingChapter.title
      }
    }

    return {
      id: episodeId,
      title,
      author: feed.author,
      description: book.description || '',
      siteURL: feed.siteURL,
      enclosureURL: contentUrl,
      enclosureType: audioTrack.mimeType,
      enclosureSize: audioTrack.metadata.size,
      pubDate: audiobookPubDate,
      duration: audioTrack.duration,
      filePath: audioTrack.metadata.path,
      explicit: book.explicit,
      feedId: feed.id
    }
  }

  /**
   *
   * @param {import('./LibraryItem').LibraryItemExpanded} libraryItemExpanded
   * @param {import('./Feed')} feed
   * @param {string} slug
   * @param {import('sequelize').Transaction} transaction
   * @returns {Promise<FeedEpisode[]>}
   */
  static async createFromAudiobookTracks(libraryItemExpanded, feed, slug, transaction) {
    const trackList = libraryItemExpanded.getTrackList()
    const useChapterTitles = this.checkUseChapterTitlesForEpisodes(trackList, libraryItemExpanded.media)

    const feedEpisodeObjs = []
    let numExisting = 0
    for (let i = 0; i < trackList.length; i++) {
      const track = trackList[i]
      // Check for existing episode by filepath
      const existingEpisode = feed.feedEpisodes?.find((episode) => {
        return episode.filePath === track.metadata.path
      })
      numExisting = existingEpisode ? numExisting + 1 : numExisting

      feedEpisodeObjs.push(this.getFeedEpisodeObjFromAudiobookTrack(libraryItemExpanded.media, libraryItemExpanded.createdAt, feed, slug, track, useChapterTitles, i, existingEpisode?.id))
    }
    Logger.info(`[FeedEpisode] Upserting ${feedEpisodeObjs.length} episodes for feed ${feed.id} (${numExisting} existing)`)
    return this.bulkCreate(feedEpisodeObjs, { transaction, updateOnDuplicate: ['title', 'author', 'description', 'siteURL', 'enclosureURL', 'enclosureType', 'enclosureSize', 'pubDate', 'season', 'episode', 'episodeType', 'duration', 'filePath', 'explicit'] })
  }

  /**
   *
   * @param {import('./Book').BookExpandedWithLibraryItem[]} books
   * @param {import('./Feed')} feed
   * @param {string} slug
   * @param {import('sequelize').Transaction} transaction
   * @returns {Promise<FeedEpisode[]>}
   */
  static async createFromBooks(books, feed, slug, transaction) {
    // This is never null unless the books array is empty, as this method is not invoked when no books. Reduce needs an initial item
    const earliestLibraryItemCreatedAt =
      books.length > 0
        ? books.reduce((earliest, book) => {
            return book.libraryItem.createdAt < earliest.libraryItem.createdAt ? book : earliest
          }).libraryItem.createdAt
        : null

    const feedEpisodeObjs = []
    let numExisting = 0
    let offsetIndex = 0
    for (const book of books) {
      const trackList = book.getTracklist(book.libraryItem.id)
      const useChapterTitles = this.checkUseChapterTitlesForEpisodes(trackList, book)
      for (const track of trackList) {
        // Check for existing episode by filepath
        const existingEpisode = feed.feedEpisodes?.find((episode) => {
          return episode.filePath === track.metadata.path
        })
        numExisting = existingEpisode ? numExisting + 1 : numExisting

        feedEpisodeObjs.push(this.getFeedEpisodeObjFromAudiobookTrack(book, earliestLibraryItemCreatedAt, feed, slug, track, useChapterTitles, offsetIndex++, existingEpisode?.id))
      }
    }
    Logger.info(`[FeedEpisode] Upserting ${feedEpisodeObjs.length} episodes for feed ${feed.id} (${numExisting} existing)`)
    return this.bulkCreate(feedEpisodeObjs, { transaction, updateOnDuplicate: ['title', 'author', 'description', 'siteURL', 'enclosureURL', 'enclosureType', 'enclosureSize', 'pubDate', 'season', 'episode', 'episodeType', 'duration', 'filePath', 'explicit'] })
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize) {
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        title: DataTypes.STRING,
        author: DataTypes.STRING,
        description: DataTypes.TEXT,
        siteURL: DataTypes.STRING,
        enclosureURL: DataTypes.STRING,
        enclosureType: DataTypes.STRING,
        enclosureSize: DataTypes.BIGINT,
        pubDate: DataTypes.STRING,
        season: DataTypes.STRING,
        episode: DataTypes.STRING,
        episodeType: DataTypes.STRING,
        duration: DataTypes.FLOAT,
        filePath: DataTypes.STRING,
        explicit: DataTypes.BOOLEAN
      },
      {
        sequelize,
        modelName: 'feedEpisode'
      }
    )

    const { feed } = sequelize.models

    feed.hasMany(FeedEpisode, {
      onDelete: 'CASCADE'
    })
    FeedEpisode.belongsTo(feed)
  }

  getOldEpisode() {
    const enclosure = {
      url: this.enclosureURL,
      size: this.enclosureSize,
      type: this.enclosureType
    }
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      enclosure,
      pubDate: this.pubDate,
      link: this.siteURL,
      author: this.author,
      explicit: this.explicit,
      duration: this.duration,
      season: this.season,
      episode: this.episode,
      episodeType: this.episodeType,
      fullPath: this.filePath
    }
  }

  /**
   *
   * @param {string} hostPrefix
   */
  getRSSData(hostPrefix) {
    const customElements = [
      { 'itunes:author': this.author || null },
      { 'itunes:duration': Math.round(Number(this.duration)) },
      {
        'itunes:explicit': !!this.explicit
      },
      { 'itunes:episodeType': this.episodeType || null },
      { 'itunes:season': this.season || null },
      { 'itunes:episode': this.episode || null }
    ].filter((element) => {
      // Remove empty custom elements
      return Object.values(element)[0] !== null
    })
    if (this.description) {
      customElements.push({ 'itunes:summary': { _cdata: this.description } })
    }

    return {
      title: this.title,
      description: this.description || '',
      url: `${hostPrefix}${this.siteURL}`,
      guid: `${hostPrefix}${this.enclosureURL}`,
      author: this.author,
      date: this.pubDate,
      enclosure: {
        url: `${hostPrefix}${this.enclosureURL}`,
        type: this.enclosureType,
        size: this.enclosureSize
      },
      custom_elements: customElements
    }
  }
}

module.exports = FeedEpisode
