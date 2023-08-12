
const Sequelize = require('sequelize')
const Database = require('../../Database')
const Logger = require('../../Logger')

module.exports = {
  /**
   * User permissions to restrict podcasts for explicit content & tags
   * @param {oldUser} user 
   * @returns {object} { podcastWhere:Sequelize.WhereOptions, replacements:string[] }
   */
  getUserPermissionPodcastWhereQuery(user) {
    const podcastWhere = []
    const replacements = {}
    if (!user.canAccessExplicitContent) {
      podcastWhere.push({
        explicit: false
      })
    }
    if (!user.permissions.accessAllTags && user.itemTagsSelected.length) {
      replacements['userTagsSelected'] = user.itemTagsSelected
      if (user.permissions.selectedTagsNotAccessible) {
        podcastWhere.push(Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:userTagsSelected))`), 0))
      } else {
        podcastWhere.push(Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:userTagsSelected))`), {
          [Sequelize.Op.gte]: 1
        }))
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
        return [[Sequelize.literal('title COLLATE NOCASE'), dir]]
      }
    } else if (sortBy === 'media.numTracks') {
      return [['numEpisodes', dir]]
    }
    return []
  },

  /**
   * Get library items for podcast media type using filter and sort
   * @param {string} libraryId 
   * @param {oldUser} user
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
        model: Database.models.feed,
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
        [Sequelize.Op.gte]: new Date(new Date() - (60 * 24 * 60 * 60 * 1000)) // 60 days ago
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

    const { rows: podcasts, count } = await Database.models.podcast.findAndCountAll({
      where: podcastWhere,
      replacements,
      distinct: true,
      attributes: {
        include: [
          [Sequelize.literal(`(SELECT count(*) FROM podcastEpisodes pe WHERE pe.podcastId = podcast.id)`), 'numEpisodes'],
          ...podcastIncludes
        ]
      },
      include: [
        {
          model: Database.models.libraryItem,
          required: true,
          where: libraryItemWhere,
          include: libraryItemIncludes
        }
      ],
      order: this.getOrder(sortBy, sortDesc),
      subQuery: false,
      limit,
      offset
    })

    const libraryItems = podcasts.map((podcastExpanded) => {
      const libraryItem = podcastExpanded.libraryItem.toJSON()
      const podcast = podcastExpanded.toJSON()

      delete podcast.libraryItem

      if (libraryItem.feeds?.length) {
        libraryItem.rssFeed = libraryItem.feeds[0]
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
   * @param {oldUser} user 
   * @param {[string]} filterGroup 
   * @param {[string]} filterValue 
   * @param {string} sortBy 
   * @param {string} sortDesc 
   * @param {number} limit 
   * @param {number} offset 
   * @returns {object} {libraryItems:LibraryItem[], count:number}
   */
  async getFilteredPodcastEpisodes(libraryId, user, filterGroup, filterValue, sortBy, sortDesc, limit, offset) {
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
      podcastEpisodeIncludes.push({
        model: Database.models.mediaProgress,
        where: {
          userId: user.id
        },
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
      libraryItemWhere['createdAt'] = {
        [Sequelize.Op.gte]: new Date(new Date() - (60 * 24 * 60 * 60 * 1000)) // 60 days ago
      }
    }

    const podcastEpisodeOrder = []
    if (sortBy === 'createdAt') {
      podcastEpisodeOrder.push(['createdAt', sortDesc ? 'DESC' : 'ASC'])
    } else if (sortBy === 'progress') {
      podcastEpisodeOrder.push([Sequelize.literal('mediaProgresses.updatedAt'), sortDesc ? 'DESC' : 'ASC'])
    }

    const userPermissionPodcastWhere = this.getUserPermissionPodcastWhereQuery(user)

    const { rows: podcastEpisodes, count } = await Database.models.podcastEpisode.findAndCountAll({
      where: podcastEpisodeWhere,
      replacements: userPermissionPodcastWhere.replacements,
      include: [
        {
          model: Database.models.podcast,
          where: userPermissionPodcastWhere.podcastWhere,
          include: [
            {
              model: Database.models.libraryItem,
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
      libraryItem.recentEpisode = ep.getOldPodcastEpisode(libraryItem.id)
      return libraryItem
    })

    return {
      libraryItems,
      count
    }
  }
}