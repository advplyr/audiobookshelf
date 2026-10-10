import * as Sequelize from 'sequelize'
import type { CountOptions, FindAndCountOptions, FindOptions, IncludeOptions, Model, ModelStatic, Order, OrderItem, ProjectionAlias, WhereOptions } from 'sequelize'
import type { Where } from 'sequelize/types/utils'
import type User from '../../models/User'
import type Library from '../../models/Library'
import type LibraryItem from '../../models/LibraryItem'
import type Podcast from '../../models/Podcast'
import type PodcastEpisode from '../../models/PodcastEpisode'
import type Feed from '../../models/Feed'

type Predicate = Where | Sequelize.WhereAttributeHash
type Replacements = Record<string, string | string[] | null>
// List queries load the owning item without requiring every episode.
// Omit the reverse link to avoid narrowing its media back to a fully expanded podcast.
type PodcastItem = Omit<LibraryItem, 'media'> & { media: Omit<Podcast, 'libraryItem'>; feeds?: Feed[]; rssFeed?: Feed; numEpisodesIncomplete?: number; recentEpisode?: ReturnType<PodcastEpisode['toOldJSON']> }
type PodcastRow = Omit<Podcast, 'libraryItem'> & { libraryItem: PodcastItem; dataValues: { duration: number | null } }
type EpisodeRow = Omit<PodcastEpisode, 'podcast'> & { podcast: PodcastRow }
// Sequelize treats a null limit as unbounded; its declarations only accept numbers.
type PaginationOptions = Omit<FindOptions, 'limit'> & { limit?: number | null }
type CountRow = { value: string; numItems: number }
type StatsRow = { totalSize?: number | null; totalDuration?: number | null; totalItems?: number; numAudioFiles?: number }
type ExpandedItemJSON = Omit<ReturnType<LibraryItem['toOldJSONExpanded']>, 'size'> & { recentEpisode?: ReturnType<PodcastEpisode['toOldJSONExpanded']> }
import Database from '../../Database'
import Logger from '../../Logger'
import profiler from '../../utils/profiler'
const { profile } = profiler
import stringifySequelizeQuery from '../stringifySequelizeQuery'

const countCache = new Map<string | undefined, number>()

const libraryItemsPodcastFilters = {
  /**
   * User permissions to restrict podcasts for explicit content & tags
   * @param {import('../../models/User')} user
   * @returns {{ podcastWhere:Sequelize.WhereOptions, replacements:object }}
   */
  getUserPermissionPodcastWhereQuery(user: User) {
    const podcastWhere: Predicate[] = []
    const replacements: Replacements = {}
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
  getMediaGroupQuery(group: string | null | undefined, value: string | null) {
    if (!group) return { mediaWhere: {}, replacements: {} }

    const mediaWhere: Sequelize.WhereAttributeHash = {}
    const replacements: Replacements = {}

    if (['genres', 'tags'].includes(group)) {
      mediaWhere[group] = Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(${group}) WHERE json_valid(${group}) AND json_each.value = :filterValue)`), {
        [Sequelize.Op.gte]: 1
      })
      replacements.filterValue = value
    } else if (group === 'languages') {
      mediaWhere['language'] = value
    } else if (group === 'explicit') {
      mediaWhere['explicit'] = true
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
  getOrder(sortBy: string, sortDesc: boolean): Order {
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
      // Sequelize accepts a literal-only order tuple at runtime.
      return [[Sequelize.literal(`\`podcast\`.\`author\` COLLATE NOCASE ${nullDir}`)]] as unknown as Order
    } else if (sortBy === 'media.metadata.title') {
      if (global.ServerSettings.sortingIgnorePrefix) {
        return [[Sequelize.literal('`libraryItem`.`titleIgnorePrefix` COLLATE NOCASE'), dir]]
      } else {
        return [[Sequelize.literal('`libraryItem`.`title` COLLATE NOCASE'), dir]]
      }
    } else if (sortBy === 'media.numTracks') {
      return [['numEpisodes', dir]]
    } else if (sortBy === 'random') {
      return [(Database.sequelize as Sequelize.Sequelize).random()]
    }
    return []
  },

  clearCountCache(this: void, model: string, hook: string) {
    Logger.debug(`[LibraryItemsPodcastFilters] ${model}.${hook}: Clearing count cache`)
    countCache.clear()
  },

  async findAndCountAll<M extends Model>(this: void, findOptions: PaginationOptions, model: ModelStatic<M>, limit: number, offset: number, useCountCache: boolean) {
    const queryOptions = findOptions as FindOptions
    if (useCountCache) {
      const countCacheKey = stringifySequelizeQuery(findOptions)
      Logger.debug(`[LibraryItemsPodcastFilters] countCacheKey: ${countCacheKey}`)
      if (!countCache.has(countCacheKey)) {
        const count = await model.count(queryOptions as CountOptions)
        countCache.set(countCacheKey, count)
      }

      findOptions.limit = limit || null
      findOptions.offset = offset

      const rows = await model.findAll(queryOptions)

      return { rows, count: countCache.get(countCacheKey)! }
    }

    findOptions.limit = limit || null
    findOptions.offset = offset

    return await model.findAndCountAll(queryOptions)
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
   * @returns {Promise<{ libraryItems: import('../../models/LibraryItem')[], count: number }>}
   */
  async getFilteredLibraryItems(libraryId: string, user: User, filterGroup: string | null, filterValue: string | null, sortBy: string, sortDesc: boolean, include: string[], limit: number, offset: number) {
    const includeRSSFeed = include.includes('rssfeed')
    const includeNumEpisodesIncomplete = include.includes('numepisodesincomplete')

    const libraryItemWhere: Sequelize.WhereAttributeHash & { [Sequelize.Op.or]?: Predicate[] } = {
      libraryId
    }
    const libraryItemIncludes: IncludeOptions[] = []
    if (filterGroup === 'feed-open' || includeRSSFeed) {
      const rssFeedRequired = filterGroup === 'feed-open'
      libraryItemIncludes.push({
        model: Database.feedModel,
        required: rssFeedRequired,
        separate: !rssFeedRequired
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
        [Sequelize.Op.gte]: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
      }
    }

    const podcastIncludes: ProjectionAlias[] = []

    let { mediaWhere, replacements } = this.getMediaGroupQuery(filterGroup, filterValue)
    replacements.userId = user.id

    const podcastWhere: Predicate[] = []
    if (Object.keys(mediaWhere).length) podcastWhere.push(mediaWhere)

    const userPermissionPodcastWhere = this.getUserPermissionPodcastWhereQuery(user)
    replacements = { ...replacements, ...userPermissionPodcastWhere.replacements }
    podcastWhere.push(...userPermissionPodcastWhere.podcastWhere)

    const findOptions: FindAndCountOptions = {
      where: podcastWhere,
      replacements,
      distinct: true,
      attributes: {
        include: [...podcastIncludes]
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
      subQuery: false
    }

    const findAndCountAll = process.env.QUERY_PROFILING ? profile(this.findAndCountAll) : this.findAndCountAll

    const { rows: podcasts, count } = await findAndCountAll(findOptions, Database.podcastModel, limit, offset, !filterGroup && !userPermissionPodcastWhere.podcastWhere.length)

    const libraryItems = (podcasts as PodcastRow[]).map((podcastExpanded) => {
      const libraryItem = podcastExpanded.libraryItem
      const podcast = podcastExpanded

      delete (podcast as Partial<PodcastRow>).libraryItem

      if (libraryItem.feeds?.length) {
        libraryItem.rssFeed = libraryItem.feeds[0]
      }

      // Shelf requests use an extended user with progress loaded; null counts retain JS arithmetic.
      if (includeNumEpisodesIncomplete) {
        const numEpisodesComplete = user.mediaProgresses!.reduce((acc, mp) => {
          if (mp.podcastId === podcast.id && mp.isFinished) {
            acc += 1
          }
          return acc
        }, 0)
        libraryItem.numEpisodesIncomplete = podcast.numEpisodes! - numEpisodesComplete
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
   * @returns {Promise<{ libraryItems: import('../../models/LibraryItem')[], count: number }>}
   */
  async getFilteredPodcastEpisodes(libraryId: string, user: User, filterGroup: string | null, filterValue: string | null, sortBy: string, sortDesc: boolean, limit: number, offset: number, isHomePage = false) {
    if (sortBy === 'progress' && filterGroup !== 'progress') {
      Logger.warn('Cannot sort podcast episodes by progress without filtering by progress')
      sortBy = 'createdAt'
    }

    const podcastEpisodeIncludes: IncludeOptions[] = []
    let podcastEpisodeWhere: WhereOptions = {}
    const libraryItemWhere: Sequelize.WhereAttributeHash & { [Sequelize.Op.or]?: Predicate[] } = {
      libraryId
    }
    if (filterGroup === 'progress') {
      const mediaProgressWhere: { userId: string; hideFromContinueListening?: boolean } = {
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
        [Sequelize.Op.gte]: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
      }
    }

    const podcastEpisodeOrder: OrderItem[] = []
    if (sortBy === 'createdAt') {
      podcastEpisodeOrder.push(['createdAt', sortDesc ? 'DESC' : 'ASC'])
    } else if (sortBy === 'progress') {
      podcastEpisodeOrder.push([Sequelize.literal('mediaProgresses.updatedAt'), sortDesc ? 'DESC' : 'ASC'])
    }

    const userPermissionPodcastWhere = this.getUserPermissionPodcastWhereQuery(user)

    const findOptions: FindAndCountOptions = {
      where: podcastEpisodeWhere,
      replacements: userPermissionPodcastWhere.replacements,
      include: [
        {
          model: Database.podcastModel,
          required: true,
          where: userPermissionPodcastWhere.podcastWhere,
          include: [
            {
              model: Database.libraryItemModel,
              required: true,
              where: libraryItemWhere
            }
          ]
        },
        ...podcastEpisodeIncludes
      ],
      subQuery: false,
      order: podcastEpisodeOrder
    }

    const findAndCountAll = process.env.QUERY_PROFILING ? profile(this.findAndCountAll) : this.findAndCountAll

    const { rows: podcastEpisodes, count } = await findAndCountAll(findOptions, Database.podcastEpisodeModel, limit, offset, !filterGroup)

    const libraryItems = (podcastEpisodes as EpisodeRow[]).map((ep) => {
      const libraryItem = ep.podcast.libraryItem
      const podcast = ep.podcast
      delete (podcast as Partial<PodcastRow>).libraryItem
      libraryItem.media = podcast

      libraryItem.recentEpisode = ep.toOldJSON(libraryItem.id)
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
  async search(user: User, library: Library, query: string, limit: number, offset: number) {
    const userPermissionPodcastWhere = this.getUserPermissionPodcastWhereQuery(user)

    const textSearchQuery = await Database.createTextSearchQuery(query)

    const matchTitle = textSearchQuery.matchExpression('podcast.title')
    const matchAuthor = textSearchQuery.matchExpression('podcast.author')

    // Search title, author, itunesId, itunesArtistId
    const podcastFindOptions: FindAndCountOptions = {
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
    }
    const podcasts = await Database.podcastModel.findAll(podcastFindOptions)

    const itemMatches = []

    for (const podcast of podcasts as PodcastRow[]) {
      const libraryItem = podcast.libraryItem
      delete (podcast as Partial<PodcastRow>).libraryItem
      libraryItem.media = podcast
      libraryItem.media.podcastEpisodes = []
      itemMatches.push({
        libraryItem: libraryItem.toOldJSONExpanded()
      })
    }

    // Search podcast episode title
    const episodeFindOptions: FindAndCountOptions = {
      where: [
        Sequelize.literal(textSearchQuery.matchExpression('podcastEpisode.title')),
        {
          '$podcast.libraryItem.libraryId$': library.id
        }
      ],
      replacements: userPermissionPodcastWhere.replacements,
      include: [
        {
          model: Database.podcastModel,
          where: [...userPermissionPodcastWhere.podcastWhere],
          include: [
            {
              model: Database.libraryItemModel
            }
          ]
        }
      ],
      distinct: true,
      offset,
      limit
    }
    const podcastEpisodes = await Database.podcastEpisodeModel.findAll(episodeFindOptions)
    const episodeMatches = []
    for (const episode of podcastEpisodes as EpisodeRow[]) {
      const libraryItem = episode.podcast.libraryItem
      libraryItem.media = episode.podcast
      libraryItem.media.podcastEpisodes = []
      const oldPodcastEpisodeJson = episode.toOldJSONExpanded(libraryItem.id)
      const libraryItemJson: ExpandedItemJSON = libraryItem.toOldJSONExpanded()
      libraryItemJson.recentEpisode = oldPodcastEpisodeJson
      episodeMatches.push({
        libraryItem: libraryItemJson
      })
    }

    const matchJsonValue = textSearchQuery.matchExpression('json_each.value')

    // Search tags
    const tagMatches = []
    const [tagResults] = await (Database.sequelize as Sequelize.Sequelize).query(`SELECT value, count(*) AS numItems FROM podcasts p, libraryItems li, json_each(p.tags) WHERE json_valid(p.tags) AND ${matchJsonValue} AND p.id = li.mediaId AND li.libraryId = :libraryId GROUP BY value ORDER BY numItems DESC LIMIT :limit OFFSET :offset;`, {
      replacements: {
        libraryId: library.id,
        limit,
        offset
      },
      raw: true
    })
    for (const row of tagResults as CountRow[]) {
      tagMatches.push({
        name: row.value,
        numItems: row.numItems
      })
    }

    // Search genres
    const genreMatches = []
    const [genreResults] = await (Database.sequelize as Sequelize.Sequelize).query(`SELECT value, count(*) AS numItems FROM podcasts p, libraryItems li, json_each(p.genres) WHERE json_valid(p.genres) AND ${matchJsonValue} AND p.id = li.mediaId AND li.libraryId = :libraryId GROUP BY value ORDER BY numItems DESC LIMIT :limit OFFSET :offset;`, {
      replacements: {
        libraryId: library.id,
        limit,
        offset
      },
      raw: true
    })
    for (const row of genreResults as CountRow[]) {
      genreMatches.push({
        name: row.value,
        numItems: row.numItems
      })
    }

    return {
      podcast: itemMatches,
      tags: tagMatches,
      genres: genreMatches,
      episodes: episodeMatches
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
  async getRecentEpisodes(user: User, library: Library, limit: number, offset: number) {
    const userPermissionPodcastWhere = this.getUserPermissionPodcastWhereQuery(user)

    const findOptions: FindAndCountOptions = {
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
          include: [{
            model: Database.libraryItemModel,
            where: {
              libraryId: library.id
            }
          }]
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
    }

    const findtAll = process.env.QUERY_PROFILING ? profile(Database.podcastEpisodeModel.findAll.bind(Database.podcastEpisodeModel)) : Database.podcastEpisodeModel.findAll.bind(Database.podcastEpisodeModel)

    const episodes = await findtAll(findOptions)

    const episodeResults = (episodes as EpisodeRow[]).map((ep) => {
      ep.podcast.podcastEpisodes = [] // Not needed
      const oldPodcastJson = ep.podcast.toOldJSON(ep.podcast.libraryItem.id)

      const oldPodcastEpisodeJson: ReturnType<PodcastEpisode['toOldJSONExpanded']> & {
        podcast?: ReturnType<Podcast['toOldJSON']>; libraryId?: string
      } = ep.toOldJSONExpanded(ep.podcast.libraryItem.id)

      oldPodcastEpisodeJson.podcast = oldPodcastJson
      oldPodcastEpisodeJson.libraryId = ep.podcast.libraryItem.libraryId
      return oldPodcastEpisodeJson
    })

    return episodeResults
  },

  /**
   * Get stats for podcast library
   * @param {string} libraryId
   * @returns {Promise<{ totalSize:number, totalDuration:number, numAudioFiles:number, totalItems:number}>}
   */
  async getPodcastLibraryStats(libraryId: string) {
    const [sizeRows] = await (Database.sequelize as Sequelize.Sequelize).query(`SELECT SUM(li.size) AS totalSize FROM libraryItems li WHERE li.mediaType = "podcast" AND li.libraryId = :libraryId;`, {
      replacements: {
        libraryId
      }
    })
    const [statRows] = await (Database.sequelize as Sequelize.Sequelize).query(`SELECT SUM(json_extract(pe.audioFile, '$.duration')) AS totalDuration, COUNT(DISTINCT(li.id)) AS totalItems, COUNT(pe.id) AS numAudioFiles FROM libraryItems li, podcasts p LEFT OUTER JOIN podcastEpisodes pe ON pe.podcastId = p.id WHERE p.id = li.mediaId AND li.libraryId = :libraryId;`, {
      replacements: {
        libraryId
      }
    })
    const sizeResults = sizeRows as StatsRow[]
    const statResults = statRows as StatsRow[]
    return {
      totalDuration: statResults?.[0]?.totalDuration || 0,
      numAudioFiles: statResults?.[0]?.numAudioFiles || 0,
      totalItems: statResults?.[0]?.totalItems || 0,
      totalSize: sizeResults?.[0]?.totalSize || 0
    }
  },

  /**
   * Genres with num podcasts
   * @param {string} libraryId
   * @returns {{genre:string, count:number}[]}
   */
  async getGenresWithCount(libraryId: string) {
    const genres = []
    const [genreResults] = await (Database.sequelize as Sequelize.Sequelize).query(`SELECT value, count(*) AS numItems FROM podcasts p, libraryItems li, json_each(p.genres) WHERE json_valid(p.genres) AND p.id = li.mediaId AND li.libraryId = :libraryId GROUP BY value ORDER BY numItems DESC;`, {
      replacements: {
        libraryId
      },
      raw: true
    })
    for (const row of genreResults as CountRow[]) {
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
  async getLongestPodcasts(libraryId: string, limit: number) {
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
    return (podcasts as PodcastRow[]).map((podcast) => {
      return {
        id: podcast.libraryItem.id,
        title: podcast.title,
        duration: podcast.dataValues.duration
      }
    })
  }
}

export = libraryItemsPodcastFilters
