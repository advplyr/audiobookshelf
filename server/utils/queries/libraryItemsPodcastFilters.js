
const Sequelize = require('sequelize')
const Database = require('../../Database')
const Logger = require('../../Logger')

module.exports = {

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
   * @param {[string]} filterGroup 
   * @param {[string]} filterValue 
   * @param {string} sortBy 
   * @param {string} sortDesc 
   * @param {string[]} include
   * @param {number} limit 
   * @param {number} offset 
   * @returns {object} { libraryItems:LibraryItem[], count:number }
   */
  async getFilteredLibraryItems(libraryId, userId, filterGroup, filterValue, sortBy, sortDesc, include, limit, offset) {
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
    }

    const podcastIncludes = []
    if (includeNumEpisodesIncomplete) {
      podcastIncludes.push([Sequelize.literal(`(SELECT count(*) FROM podcastEpisodes pe LEFT OUTER JOIN mediaProgresses mp ON mp.mediaItemId = pe.id AND mp.userId = :userId WHERE pe.podcastId = podcast.id AND (mp.isFinished = 0 OR mp.isFinished IS NULL))`), 'numEpisodesIncomplete'])
    }

    const { mediaWhere, replacements } = this.getMediaGroupQuery(filterGroup, filterValue)
    replacements.userId = userId

    const { rows: podcasts, count } = await Database.models.podcast.findAndCountAll({
      where: mediaWhere,
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
    Logger.debug('Found', libraryItems.length, 'library items', 'total=', count)
    return {
      libraryItems,
      count
    }
  }
}