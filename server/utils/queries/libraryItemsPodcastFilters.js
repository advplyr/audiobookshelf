const Sequelize = require('sequelize')
const Database = require('../../Database')
const Logger = require('../../Logger')

module.exports = {
  /**
   * User permissions to restrict podcasts for explicit content & tags
   * @param {import('../../models/User')} user
   * @returns {{ podcastWhere:Sequelize.WhereOptions, replacements:object }}
   */
  getUserPermissionPodcastWhereQuery(user) {
    const podcastWhere = []
    const replacements = {}
    if (!user.canAccessExplicitContent) {
      podcastWhere.push({
        explicit: false
      })
    }

    if (!user.permissions?.accessAllTags && user.permissions?.itemTagsSelected?.length) {
      replacements['userTagsSelected'] = user.permissions.itemTagsSelected
      if (user.permissions.selectedTagsNotAccessible) {
        podcastWhere.push(Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:userTagsSelected))`), 0))
      } else {
        podcastWhere.push(
          Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:userTagsSelected))`), {
            [Sequelize.Op.gte]: 1
          })
        )
      }
    }

    return {
      podcastWhere,
      replacements
    }
  },

  /**
   * Get where options for Podcast model
   * @param {string} group
   * @param {[string]} value
   * @returns {object} { Sequelize.WhereOptions, string[] }
   */
  getMediaGroupQuery(group, value) {
    if (!group) return { mediaWhere: {}, replacements: {} }

    let mediaWhere = {}
    const replacements = {}

    if (['genres', 'tags'].includes(group)) {
      mediaWhere[group] = Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(${group}) WHERE json_valid(${group}) AND json_each.value = :filterValue)`), {
        [Sequelize.Op.gte]: 1
      })
      replacements.filterValue = value
    } else if (group === 'languages') {
      mediaWhere['language'] = value
    }

    return {
      mediaWhere,
      replacements
    }
  },

  /**
   * Get sequelize order
   * @param {string} sortBy
   * @param {boolean} sortDesc
   * @returns {Sequelize.order}
   */
  getOrder(sortBy, sortDesc) {
    const dir = sortDesc ? 'DESC' : 'ASC'
    if (sortBy === 'addedAt') {
      return [[Sequelize.literal('libraryItem.createdAt'), dir]]
    } else if (sortBy === 'size') {
      return [[Sequelize.literal('libraryItem.size'), dir]]
    } else if (sortBy === 'birthtimeMs') {
      return [[Sequelize.literal('libraryItem.birthtime'), dir]]
    } else if (sortBy === 'mtimeMs') {
      return [[Sequelize.literal('libraryItem.mtime'), dir]]
    } else if (sortBy === 'media.metadata.author') {
      const nullDir = sortDesc ? 'DESC NULLS FIRST' : 'ASC NULLS LAST'
      return [[Sequelize.literal(`\`podcast\`.\`author\` COLLATE NOCASE ${nullDir}`)]]
    } else if (sortBy === 'media.metadata.title') {
      if (global.ServerSettings.sortingIgnorePrefix) {
        return [[Sequelize.literal('titleIgnorePrefix COLLATE NOCASE'), dir]]
      } else {
        return [[Sequelize.literal('`podcast`.`title` COLLATE NOCASE'), dir]]
      }
    } else if (sortBy === 'media.numTracks') {
      return [['numEpisodes', dir]]
    } else if (sortBy === 'random') {
      return [Database.sequelize.random()]
    }
    return []
  },

  /**
   * Get library items for podcast media type using filter and sort
   * @param {string} libraryId
   * @param {import('../../models/User')} user
   * @param {[string]} filterGroup
   * @param {[string]} filterValue
   * @param {string} sortBy
   * @param {string} sortDesc
   * @param {string[]} include
   * @param {number} limit
   * @param {number} offset
   * @returns {object} { libraryItems:LibraryItem[], count:number }
   */
  async getFilteredLibraryItems(libraryId, user, filterGroup, filterValue, sortBy, sortDesc, include, limit, offset) {
    const includeRSSFeed = include.includes('rssfeed')
    const includeNumEpisodesIncomplete = include.includes('numepisodesincomplete')

    const libraryItemWhere = {
      libraryId
    }
    const libraryItemIncludes = []
    if (includeRSSFeed) {
      libraryItemIncludes.push({
        model: Database.feedModel,
        required: filterGroup === 'feed-open'
      })
    }
    if (filterGroup === 'issues') {
      libraryItemWhere[Sequelize.Op.or] = [
        {
          isMissing: true
        },
        {
          isInvalid: true
        }
      ]
    } else if (filterGroup === 'recent') {
      libraryItemWhere['createdAt'] = {
        [Sequelize.Op.gte]: new Date(new Date() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
      }
    }

    const podcastIncludes = []
    if (includeNumEpisodesIncomplete) {
      podcastIncludes.push([Sequelize.literal(`(SELECT count(*) FROM podcastEpisodes pe LEFT OUTER JOIN mediaProgresses mp ON mp.mediaItemId = pe.id AND mp.userId = :userId WHERE pe.podcastId = podcast.id AND (mp.isFinished = 0 OR mp.isFinished IS NULL))`), 'numEpisodesIncomplete'])
    }

    let { mediaWhere, replacements } = this.getMediaGroupQuery(filterGroup, filterValue)
    replacements.userId = user.id

    const podcastWhere = []
    if (Object.keys(mediaWhere).length) podcastWhere.push(mediaWhere)

    const userPermissionPodcastWhere = this.getUserPermissionPodcastWhereQuery(user)
    replacements = { ...replacements, ...userPermissionPodcastWhere.replacements }
    podcastWhere.push(...userPermissionPodcastWhere.podcastWhere)

    const { rows: podcasts, count } = await Database.podcastModel.findAndCountAll({
      where: podcastWhere,
      replacements,
      distinct: true,
      attributes: {
        include: [[Sequelize.literal(`(SELECT count(*) FROM podcastEpisodes pe WHERE pe.podcastId = podcast.id)`), 'numEpisodes'], ...podcastIncludes]
      },
      include: [
        {
          model: Database.libraryItemModel,
          required: true,
          where: libraryItemWhere,
          include: libraryItemIncludes
        }
      ],
      order: this.getOrder(sortBy, sortDesc),
      subQuery: false,
      limit: limit || null,
      offset
    })

    const libraryItems = podcasts.map((podcastExpanded) => {
      const libraryItem = podcastExpanded.libraryItem.toJSON()
      const podcast = podcastExpanded.toJSON()

      delete podcast.libraryItem

      if (podcastExpanded.libraryItem.feeds?.length) {
        libraryItem.rssFeed = podcastExpanded.libraryItem.feeds[0]
      }
      if (podcast.numEpisodesIncomplete) {
        libraryItem.numEpisodesIncomplete = podcast.numEpisodesIncomplete
      }

      libraryItem.media = podcast

      return libraryItem
    })

    return {
      libraryItems,
      count
    }
  },

  /**
   * Get podcast episodes filtered and sorted
   * @param {string} libraryId
   * @param {import('../../models/User')} user
   * @param {[string]} filterGroup
   * @param {[string]} filterValue
   * @param {string} sortBy
   * @param {string} sortDesc
   * @param {number} limit
   * @param {number} offset
   * @param {boolean} isHomePage for home page shelves
   * @returns {object} {libraryItems:LibraryItem[], count:number}
   */
  async getFilteredPodcastEpisodes(libraryId, user, filterGroup, filterValue, sortBy, sortDesc, limit, offset, isHomePage = false) {
    if (sortBy === 'progress' && filterGroup !== 'progress') {
      Logger.warn('Cannot sort podcast episodes by progress without filtering by progress')
      sortBy = 'createdAt'
    }

    const podcastEpisodeIncludes = []
    let podcastEpisodeWhere = {}
    let libraryItemWhere = {
      libraryId
    }
    if (filterGroup === 'progress') {
      const mediaProgressWhere = {
        userId: user.id
      }
      // Respect hide from continue listening for home page shelf
      if (isHomePage) {
        mediaProgressWhere.hideFromContinueListening = false
      }
      podcastEpisodeIncludes.push({
        model: Database.mediaProgressModel,
        where: mediaProgressWhere,
        attributes: ['id', 'isFinished', 'currentTime', 'updatedAt']
      })

      if (filterValue === 'in-progress') {
        podcastEpisodeWhere = [
          {
            '$mediaProgresses.isFinished$': false
          },
          {
            '$mediaProgresses.currentTime$': {
              [Sequelize.Op.gt]: 0
            }
          }
        ]
      } else if (filterValue === 'finished') {
        podcastEpisodeWhere['$mediaProgresses.isFinished$'] = true
      }
    } else if (filterGroup === 'recent') {
      podcastEpisodeWhere['createdAt'] = {
        [Sequelize.Op.gte]: new Date(new Date() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
      }
    }

    const podcastEpisodeOrder = []
    if (sortBy === 'createdAt') {
      podcastEpisodeOrder.push(['createdAt', sortDesc ? 'DESC' : 'ASC'])
    } else if (sortBy === 'progress') {
      podcastEpisodeOrder.push([Sequelize.literal('mediaProgresses.updatedAt'), sortDesc ? 'DESC' : 'ASC'])
    }

    const userPermissionPodcastWhere = this.getUserPermissionPodcastWhereQuery(user)

    const { rows: podcastEpisodes, count } = await Database.podcastEpisodeModel.findAndCountAll({
      where: podcastEpisodeWhere,
      replacements: userPermissionPodcastWhere.replacements,
      include: [
        {
          model: Database.podcastModel,
          where: userPermissionPodcastWhere.podcastWhere,
          include: [
            {
              model: Database.libraryItemModel,
              where: libraryItemWhere
            }
          ]
        },
        ...podcastEpisodeIncludes
      ],
      distinct: true,
      subQuery: false,
      order: podcastEpisodeOrder,
      limit,
      offset
    })

    const libraryItems = podcastEpisodes.map((ep) => {
      const libraryItem = ep.podcast.libraryItem.toJSON()
      const podcast = ep.podcast.toJSON()
      delete podcast.libraryItem
      libraryItem.media = podcast
      libraryItem.recentEpisode = ep.getOldPodcastEpisode(libraryItem.id).toJSON()
      return libraryItem
    })

    return {
      libraryItems,
      count
    }
  },

  /**
   * Search podcasts
   * @param {import('../../models/User')} user
   * @param {import('../../models/Library')} library
   * @param {string} query
   * @param {number} limit
   * @param {number} offset
   * @returns {{podcast:object[], tags:object[]}}
   */
  async search(user, library, query, limit, offset) {
    const userPermissionPodcastWhere = this.getUserPermissionPodcastWhereQuery(user)

    const textSearchQuery = await Database.createTextSearchQuery(query)

    const matchTitle = textSearchQuery.matchExpression('title')
    const matchAuthor = textSearchQuery.matchExpression('author')

    // Search title, author, itunesId, itunesArtistId
    const podcasts = await Database.podcastModel.findAll({
      where: [
        {
          [Sequelize.Op.or]: [
            Sequelize.literal(matchTitle),
            Sequelize.literal(matchAuthor),
            {
              itunesId: {
                [Sequelize.Op.substring]: query
              }
            },
            {
              itunesArtistId: {
                [Sequelize.Op.substring]: query
              }
            }
          ]
        },
        ...userPermissionPodcastWhere.podcastWhere
      ],
      replacements: userPermissionPodcastWhere.replacements,
      include: [
        {
          model: Database.libraryItemModel,
          where: {
            libraryId: library.id
          }
        }
      ],
      subQuery: false,
      distinct: true,
      limit,
      offset
    })

    const itemMatches = []

    for (const podcast of podcasts) {
      const libraryItem = podcast.libraryItem
      delete podcast.libraryItem
      libraryItem.media = podcast
      itemMatches.push({
        libraryItem: Database.libraryItemModel.getOldLibraryItem(libraryItem).toJSONExpanded()
      })
    }

    const matchJsonValue = textSearchQuery.matchExpression('json_each.value')

    // Search tags
    const tagMatches = []
    const [tagResults] = await Database.sequelize.query(`SELECT value, count(*) AS numItems FROM podcasts p, libraryItems li, json_each(p.tags) WHERE json_valid(p.tags) AND ${matchJsonValue} AND p.id = li.mediaId AND li.libraryId = :libraryId GROUP BY value ORDER BY numItems DESC LIMIT :limit OFFSET :offset;`, {
      replacements: {
        libraryId: library.id,
        limit,
        offset
      },
      raw: true
    })
    for (const row of tagResults) {
      tagMatches.push({
        name: row.value,
        numItems: row.numItems
      })
    }

    // Search genres
    const genreMatches = []
    const [genreResults] = await Database.sequelize.query(`SELECT value, count(*) AS numItems FROM podcasts p, libraryItems li, json_each(p.genres) WHERE json_valid(p.genres) AND ${matchJsonValue} AND p.id = li.mediaId AND li.libraryId = :libraryId GROUP BY value ORDER BY numItems DESC LIMIT :limit OFFSET :offset;`, {
      replacements: {
        libraryId: library.id,
        limit,
        offset
      },
      raw: true
    })
    for (const row of genreResults) {
      genreMatches.push({
        name: row.value,
        numItems: row.numItems
      })
    }

    return {
      podcast: itemMatches,
      tags: tagMatches,
      genres: genreMatches
    }
  },

  /**
   * Most recent podcast episodes not finished
   * @param {import('../../models/User')} user
   * @param {import('../../models/Library')} library
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<object[]>}
   */
  async getRecentEpisodes(user, library, limit, offset) {
    const userPermissionPodcastWhere = this.getUserPermissionPodcastWhereQuery(user)

    const episodes = await Database.podcastEpisodeModel.findAll({
      where: {
        '$mediaProgresses.isFinished$': {
          [Sequelize.Op.or]: [null, false]
        }
      },
      replacements: userPermissionPodcastWhere.replacements,
      include: [
        {
          model: Database.podcastModel,
          where: userPermissionPodcastWhere.podcastWhere,
          required: true,
          include: {
            model: Database.libraryItemModel,
            where: {
              libraryId: library.id
            }
          }
        },
        {
          model: Database.mediaProgressModel,
          where: {
            userId: user.id
          },
          required: false
        }
      ],
      order: [['publishedAt', 'DESC']],
      subQuery: false,
      limit,
      offset
    })

    const episodeResults = episodes.map((ep) => {
      const libraryItem = ep.podcast.libraryItem
      libraryItem.media = ep.podcast
      const oldPodcast = Database.podcastModel.getOldPodcast(libraryItem)
      const oldPodcastEpisode = ep.getOldPodcastEpisode(libraryItem.id).toJSONExpanded()
      oldPodcastEpisode.podcast = oldPodcast
      oldPodcastEpisode.libraryId = libraryItem.libraryId
      return oldPodcastEpisode
    })

    return episodeResults
  },

  /**
   * Get stats for podcast library
   * @param {string} libraryId
   * @returns {Promise<{ totalSize:number, totalDuration:number, numAudioFiles:number, totalItems:number}>}
   */
  async getPodcastLibraryStats(libraryId) {
    const [sizeResults] = await Database.sequelize.query(`SELECT SUM(li.size) AS totalSize FROM libraryItems li WHERE li.mediaType = "podcast" AND li.libraryId = :libraryId;`, {
      replacements: {
        libraryId
      }
    })
    const [statResults] = await Database.sequelize.query(`SELECT SUM(json_extract(pe.audioFile, '$.duration')) AS totalDuration, COUNT(DISTINCT(li.id)) AS totalItems, COUNT(pe.id) AS numAudioFiles FROM libraryItems li, podcasts p LEFT OUTER JOIN podcastEpisodes pe ON pe.podcastId = p.id WHERE p.id = li.mediaId AND li.libraryId = :libraryId;`, {
      replacements: {
        libraryId
      }
    })
    return {
      ...statResults[0],
      totalSize: sizeResults[0].totalSize || 0
    }
  },

  /**
   * Genres with num podcasts
   * @param {string} libraryId
   * @returns {{genre:string, count:number}[]}
   */
  async getGenresWithCount(libraryId) {
    const genres = []
    const [genreResults] = await Database.sequelize.query(`SELECT value, count(*) AS numItems FROM podcasts p, libraryItems li, json_each(p.genres) WHERE json_valid(p.genres) AND p.id = li.mediaId AND li.libraryId = :libraryId GROUP BY value ORDER BY numItems DESC;`, {
      replacements: {
        libraryId
      },
      raw: true
    })
    for (const row of genreResults) {
      genres.push({
        genre: row.value,
        count: row.numItems
      })
    }
    return genres
  },

  /**
   * Get longest podcasts in library
   * @param {string} libraryId
   * @param {number} limit
   * @returns {Promise<{ id:string, title:string, duration:number }[]>}
   */
  async getLongestPodcasts(libraryId, limit) {
    const podcasts = await Database.podcastModel.findAll({
      attributes: ['id', 'title', [Sequelize.literal(`(SELECT SUM(json_extract(pe.audioFile, '$.duration')) FROM podcastEpisodes pe WHERE pe.podcastId = podcast.id)`), 'duration']],
      include: {
        model: Database.libraryItemModel,
        attributes: ['id', 'libraryId'],
        where: {
          libraryId
        }
      },
      order: [['duration', 'DESC']],
      limit
    })
    return podcasts.map((podcast) => {
      return {
        id: podcast.libraryItem.id,
        title: podcast.title,
        duration: podcast.dataValues.duration
      }
    })
  }
}
