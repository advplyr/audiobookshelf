import * as Sequelize from 'sequelize'
import type { CountOptions, FindAndCountOptions, IncludeOptions } from 'sequelize'
import type { Where } from 'sequelize/types/utils'
import type Library from '../../models/Library'
import type LibraryItem from '../../models/LibraryItem'
import type User from '../../models/User'
import type Book from '../../models/Book'
import type { BookExpanded } from '../../models/Book'
import type Podcast from '../../models/Podcast'
import type PodcastEpisode from '../../models/PodcastEpisode'
import type Series from '../../models/Series'
import type BookSeries from '../../models/BookSeries'
import type Author from '../../models/Author'
import type Feed from '../../models/Feed'
import type { MediaItemShareForClient } from '../../models/MediaItemShare'

type FilterOptions = { filterBy?: string | null; sortBy: string; sortDesc: boolean; limit: number; offset: number; collapseseries: boolean; include: string[]; mediaType: string }
type SeriesDetails = { id: string; name: string | null; sequence: string | null }
type BookMinified = ReturnType<Book['toOldJSONMinified']>
type ShelfBookMedia = BookMinified & { metadata: { series?: SeriesDetails } }
type ShelfPodcastMedia = ReturnType<Podcast['toOldJSONMinified']> & { metadata: { series?: SeriesDetails } }
type ShelfJSON = Omit<ReturnType<LibraryItem['toOldJSONMinified']>, 'media'> & {
  media: ShelfBookMedia | ShelfPodcastMedia
  rssFeed?: ReturnType<Feed['toOldJSONMinified']>
  mediaItemShare?: MediaItemShareForClient
  recentEpisode?: ReturnType<PodcastEpisode['toOldJSON']>
  numEpisodesIncomplete?: number
}
type SeriesRow = Series & { feeds?: Feed[]; bookSeries: (BookSeries & { book: Book })[] }
type OldSeries = ReturnType<Series['toOldJSON']> & { rssFeed?: ReturnType<Feed['toOldJSONMinified']>; books?: (ShelfJSON | null)[] }
type FilterData = {
  authors: { id: string; name: string | null }[]; series: { id: string; name: string }[]
  genres: string[]; tags: string[]; narrators: string[]; languages: string[]; publishers: string[]; publishedDecades: string[]
  bookCount: number; authorCount: number; seriesCount: number; podcastCount: number; numIssues: number; loadedAt: number
}
type FilterDataBuilder = Omit<FilterData, 'genres' | 'tags' | 'narrators' | 'languages' | 'publishers' | 'publishedDecades' | 'loadedAt'> & {
  genres: Set<string>; tags: Set<string>; narrators: Set<string>; languages: Set<string>; publishers: Set<string>; publishedDecades: Set<string>
}
import Logger from '../../Logger'
import Database from '../../Database'
import libraryItemsBookFilters from './libraryItemsBookFilters'
import libraryItemsPodcastFilters from './libraryItemsPodcastFilters'
import { createNewSortInstance } from '../../libs/fastSort'
import profiler from '../../utils/profiler'
const { profile } = profiler
const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

const libraryFilters = {
  decode(text: string) {
    try {
      return Buffer.from(decodeURIComponent(text), 'base64').toString()
    } catch (error) {
      Logger.warn(`[libraryFilters] Failed to decode filter value "${text}": ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  },

  /**
   * Get library items using filter and sort
   * @param {string} libraryId
   * @param {import('../../models/User')} user
   * @param {object} options
   * @returns {Promise<{ libraryItems:import('../../models/LibraryItem')[], count:number }>}
   */
  async getFilteredLibraryItems(libraryId: string, user: User, options: FilterOptions) {
    const { filterBy, sortBy, sortDesc, limit, offset, collapseseries, include, mediaType } = options

    let filterValue = null
    let filterGroup = null
    if (filterBy) {
      const searchGroups = ['genres', 'tags', 'series', 'authors', 'progress', 'narrators', 'publishers', 'publishedDecades', 'missing', 'languages', 'tracks', 'ebooks']
      const group = searchGroups.find((_group) => filterBy.startsWith(_group + '.'))
      filterGroup = group || filterBy
      filterValue = group ? this.decode(filterBy.replace(`${group}.`, '')) : null
    }

    if (mediaType === 'book') {
      return libraryItemsBookFilters.getFilteredLibraryItems(libraryId, user, filterGroup, filterValue, sortBy, sortDesc, collapseseries, include, limit, offset)
    } else {
      return libraryItemsPodcastFilters.getFilteredLibraryItems(libraryId, user, filterGroup, filterValue, sortBy, sortDesc, include, limit, offset)
    }
  },

  /**
   * Get library items for continue listening & continue reading shelves
   * @param {import('../../models/Library')} library
   * @param {import('../../models/User')} user
   * @param {string[]} include
   * @param {number} limit
   * @returns {Promise<{ items:import('../../models/LibraryItem')[], count:number }>}
   */
  async getMediaItemsInProgress(library: Library, user: User, include: string[], limit: number) {
    if (library.isBook) {
      const { libraryItems, count } = await libraryItemsBookFilters.getFilteredLibraryItems(library.id, user, 'progress', 'in-progress', 'progress', true, false, include, limit, 0, true)
      return {
        items: libraryItems.map((li) => {
          const oldLibraryItem: ShelfJSON = li.toOldJSONMinified()
          if (li.rssFeed) {
            oldLibraryItem.rssFeed = li.rssFeed.toOldJSONMinified()
          }
          if (li.mediaItemShare) {
            oldLibraryItem.mediaItemShare = li.mediaItemShare
          }
          return oldLibraryItem
        }),
        count
      }
    } else {
      const { libraryItems, count } = await libraryItemsPodcastFilters.getFilteredPodcastEpisodes(library.id, user, 'progress', 'in-progress', 'progress', true, limit, 0, true)
      return {
        count,
        items: libraryItems.map((li) => {
          const oldLibraryItem: ShelfJSON = li.toOldJSONMinified()
          oldLibraryItem.recentEpisode = li.recentEpisode
          return oldLibraryItem
        })
      }
    }
  },

  /**
   * Get library items for most recently added shelf
   * @param {import('../../models/Library')} library
   * @param {import('../../models/User')} user
   * @param {string[]} include
   * @param {number} limit
   * @returns {object} { libraryItems:LibraryItem[], count:number }
   */
  async getLibraryItemsMostRecentlyAdded(library: Library, user: User, include: string[], limit: number) {
    if (library.isBook) {
      const { libraryItems, count } = await libraryItemsBookFilters.getFilteredLibraryItems(library.id, user, 'recent', null, 'addedAt', true, false, include, limit, 0)
      return {
        libraryItems: libraryItems.map((li) => {
          const oldLibraryItem: ShelfJSON = li.toOldJSONMinified()
          if (li.rssFeed) {
            oldLibraryItem.rssFeed = li.rssFeed.toOldJSONMinified()
          }
          if (li.size && !oldLibraryItem.media.size) {
            // The legacy LibraryItem annotation says BigInt; SQLite returns a number.
            oldLibraryItem.media.size = li.size as unknown as number
          }
          if (li.mediaItemShare) {
            oldLibraryItem.mediaItemShare = li.mediaItemShare
          }
          return oldLibraryItem
        }),
        count
      }
    } else {
      const { libraryItems, count } = await libraryItemsPodcastFilters.getFilteredLibraryItems(library.id, user, 'recent', null, 'addedAt', true, include, limit, 0)
      return {
        libraryItems: libraryItems.map((li) => {
          const oldLibraryItem: ShelfJSON = li.toOldJSONMinified()
          if (li.rssFeed) {
            oldLibraryItem.rssFeed = li.rssFeed.toOldJSONMinified()
          }
          if (li.size && !oldLibraryItem.media.size) {
            // The legacy LibraryItem annotation says BigInt; SQLite returns a number.
            oldLibraryItem.media.size = li.size as unknown as number
          }
          if (li.numEpisodesIncomplete) {
            oldLibraryItem.numEpisodesIncomplete = li.numEpisodesIncomplete
          }
          return oldLibraryItem
        }),
        count
      }
    }
  },

  /**
   * Get library items for continue series shelf
   * @param {import('../../models/Library')} library
   * @param {import('../../models/User')} user
   * @param {string[]} include
   * @param {number} limit
   * @returns {object} { libraryItems:LibraryItem[], count:number }
   */
  async getLibraryItemsContinueSeries(library: Library, user: User, include: string[], limit: number) {
    const { libraryItems, count } = await libraryItemsBookFilters.getContinueSeriesLibraryItems(library, user, include, limit, 0)
    return {
      libraryItems: libraryItems.map((li) => {
        const oldLibraryItem: ShelfJSON = li.toOldJSONMinified()
        if (li.rssFeed) {
          oldLibraryItem.rssFeed = li.rssFeed.toOldJSONMinified()
        }
        if (li.series) {
          oldLibraryItem.media.metadata.series = li.series
        }
        if (li.mediaItemShare) {
          oldLibraryItem.mediaItemShare = li.mediaItemShare
        }
        return oldLibraryItem
      }),
      count
    }
  },

  /**
   * Get library items or podcast episodes for the "Listen Again" and "Read Again" shelf
   *
   * @param {import('../../models/Library')} library
   * @param {import('../../models/User')} user
   * @param {string[]} include
   * @param {number} limit
   * @returns {Promise<{ items:oldLibraryItem[], count:number }>}
   */
  async getMediaFinished(library: Library, user: User, include: string[], limit: number) {
    if (library.isBook) {
      const { libraryItems, count } = await libraryItemsBookFilters.getFilteredLibraryItems(library.id, user, 'progress', 'finished', 'progress', true, false, include, limit, 0)
      return {
        items: libraryItems.map((li) => {
          const oldLibraryItem: ShelfJSON = li.toOldJSONMinified()
          if (li.rssFeed) {
            oldLibraryItem.rssFeed = li.rssFeed.toOldJSONMinified()
          }
          if (li.mediaItemShare) {
            oldLibraryItem.mediaItemShare = li.mediaItemShare
          }
          return oldLibraryItem
        }),
        count
      }
    } else {
      const { libraryItems, count } = await libraryItemsPodcastFilters.getFilteredPodcastEpisodes(library.id, user, 'progress', 'finished', 'progress', true, limit, 0)
      return {
        count,
        items: libraryItems.map((li) => {
          const oldLibraryItem: ShelfJSON = li.toOldJSONMinified()
          oldLibraryItem.recentEpisode = li.recentEpisode
          return oldLibraryItem
        })
      }
    }
  },

  /**
   * Get series for recent series shelf
   * @param {import('../../models/Library')} library
   * @param {import('../../models/User')} user
   * @param {string[]} include
   * @param {number} limit
   * @returns {{ series:any[], count:number}}
   */
  async getSeriesMostRecentlyAdded(library: Library, user: User, include: string[], limit: number) {
    if (!library.isBook) return { series: [], count: 0 }

    const seriesIncludes: IncludeOptions[] = []
    if (include.includes('rssfeed')) {
      seriesIncludes.push({
        model: Database.feedModel
      })
    }

    const userPermissionBookWhere = libraryItemsBookFilters.getUserPermissionBookWhereQuery(user)

    const seriesWhere: (Where | Sequelize.WhereAttributeHash)[] = [
      {
        libraryId: library.id,
        createdAt: {
          [Sequelize.Op.gte]: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
        }
      }
    ]

    // Handle library setting to hide single book series
    // TODO: Merge with existing query
    if (library.settings!.hideSingleBookSeries) {
      seriesWhere.push(
        Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM books b, bookSeries bs WHERE bs.seriesId = series.id AND bs.bookId = b.id)`), {
          [Sequelize.Op.gt]: 1
        })
      )
    }

    // Handle user permissions to only include series with at least 1 book
    // TODO: Simplify to a single query
    if (userPermissionBookWhere.bookWhere.length) {
      let attrQuery = 'SELECT count(*) FROM books b, bookSeries bs WHERE bs.seriesId = series.id AND bs.bookId = b.id'
      if (!user.canAccessExplicitContent) {
        attrQuery += ' AND b.explicit = 0'
      }
      if (!user.permissions?.accessAllTags && user.permissions?.itemTagsSelected?.length) {
        if (user.permissions.selectedTagsNotAccessible) {
          attrQuery += ' AND (SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:userTagsSelected)) = 0'
        } else {
          attrQuery += ' AND (SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:userTagsSelected)) > 0'
        }
      }
      seriesWhere.push(
        Sequelize.where(Sequelize.literal(`(${attrQuery})`), {
          [Sequelize.Op.gt]: 0
        })
      )
    }

    const { rows: series, count } = await Database.seriesModel.findAndCountAll({
      where: seriesWhere,
      limit,
      offset: 0,
      distinct: true,
      subQuery: false,
      replacements: userPermissionBookWhere.replacements,
      include: [
        {
          model: Database.bookSeriesModel,
          include: [{
            model: Database.bookModel,
            where: userPermissionBookWhere.bookWhere,
            include: [{
              model: Database.libraryItemModel
            }]
          }],
          separate: true
        },
        ...seriesIncludes
      ],
      order: [['createdAt', 'DESC']]
    })

    const allOldSeries = []
    for (const s of series as SeriesRow[]) {
      const oldSeries: OldSeries = s.toOldJSON()

      if (s.feeds?.length) {
        oldSeries.rssFeed = s.feeds[0].toOldJSONMinified()
      }

      // TODO: Sort books by sequence in query
      s.bookSeries.sort((a, b) => {
        if (!a.sequence) return 1
        if (!b.sequence) return -1
        return a.sequence.localeCompare(b.sequence, undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      })
      oldSeries.books = s.bookSeries
        .map((bs) => {
          const libraryItem = bs.book.libraryItem
          if (!libraryItem) {
            Logger.warn(`Book series book has no libraryItem`, bs, bs.book, 'series=', series)
            return null
          }

          delete bs.book.libraryItem
          bs.book.authors = [] // Not needed
          bs.book.series = [] // Not needed
          // Empty author and series lists above complete the expanded book shape.
          libraryItem.media = bs.book as BookExpanded
          const oldLibraryItem = libraryItem.toOldJSONMinified()
          return oldLibraryItem
        })
        .filter((b) => b)
      allOldSeries.push(oldSeries)
    }

    return {
      series: allOldSeries,
      count
    }
  },

  /**
   * Get most recently created authors for "Newest Authors" shelf
   * Author must be linked to at least 1 book
   *
   * @param {import('../../models/Library')} library
   * @param {import('../../models/User')} user
   * @param {number} limit
   * @returns {Promise<{ authors:oldAuthor[], count:number }>}
   */
  async getNewestAuthors(library: Library, user: User, limit: number) {
    if (library.mediaType !== 'book') return { authors: [], count: 0 }

    const { bookWhere, replacements } = libraryItemsBookFilters.getUserPermissionBookWhereQuery(user)

    const { rows: authors, count } = await Database.authorModel.findAndCountAll({
      where: {
        libraryId: library.id,
        createdAt: {
          [Sequelize.Op.gte]: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
        }
      },
      replacements,
      include: [{
        model: Database.bookModel,
        attributes: ['id', 'tags', 'explicit'],
        where: bookWhere,
        required: true, // Must belong to a book
        through: {
          attributes: []
        }
      }],
      limit,
      distinct: true,
      order: [['createdAt', 'DESC']]
    })

    return {
      authors: authors.map((au) => {
        const numBooks = au.books!.length || 0
        return au.toOldJSONExpanded(numBooks)
      }),
      count
    }
  },

  /**
   * Get book library items for the "Discover" shelf
   * @param {import('../../models/Library')} library
   * @param {import('../../models/User')} user
   * @param {string[]} include
   * @param {number} limit
   * @returns {Promise<{libraryItems:oldLibraryItem[], count:number}>}
   */
  async getLibraryItemsToDiscover(library: Library, user: User, include: string[], limit: number) {
    if (library.mediaType !== 'book') return { libraryItems: [], count: 0 }

    const { libraryItems, count } = await libraryItemsBookFilters.getDiscoverLibraryItems(library.id, user, include, limit)
    return {
      libraryItems: libraryItems.map((li) => {
        const oldLibraryItem: ShelfJSON = li.toOldJSONMinified()
        if (li.rssFeed) {
          oldLibraryItem.rssFeed = li.rssFeed.toOldJSONMinified()
        }
        if (li.mediaItemShare) {
          oldLibraryItem.mediaItemShare = li.mediaItemShare
        }
        return oldLibraryItem
      }),
      count
    }
  },

  /**
   * Get podcast episodes most recently added
   * @param {import('../../models/Library')} library
   * @param {import('../../models/User')} user
   * @param {number} limit
   * @returns {Promise<{libraryItems:oldLibraryItem[], count:number}>}
   */
  async getNewestPodcastEpisodes(library: Library, user: User, limit: number) {
    if (library.mediaType !== 'podcast') return { libraryItems: [], count: 0 }

    const { libraryItems, count } = await libraryItemsPodcastFilters.getFilteredPodcastEpisodes(library.id, user, 'recent', null, 'createdAt', true, limit, 0)
    return {
      count,
      libraryItems: libraryItems.map((li) => {
        const oldLibraryItem: ShelfJSON = li.toOldJSONMinified()
        oldLibraryItem.recentEpisode = li.recentEpisode
        return oldLibraryItem
      })
    }
  },

  /**
   * Get library items for an author, optional use user permissions
   * @param {import('../../models/Author')} author
   * @param {import('../../models/User')} user
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<{ libraryItems:import('../../models/LibraryItem')[], count:number }>}
   */
  async getLibraryItemsForAuthor(author: Author, user: User | null | undefined, limit: number, offset: number) {
    const { libraryItems, count } = await libraryItemsBookFilters.getFilteredLibraryItems(author.libraryId, user, 'authors', author.id, 'addedAt', true, false, [], limit, offset)
    return {
      count,
      libraryItems
    }
  },

  /**
   * Get book library items in a collection
   * @param {oldCollection} collection
   * @returns {Promise<import('../../models/LibraryItem')[]>}
   */
  getLibraryItemsForCollection(collection: { books?: string[] } | null | undefined) {
    return libraryItemsBookFilters.getLibraryItemsForCollection(collection)
  },

  /**
   * Get filter data used in filter menus
   * @param {string} mediaType
   * @param {string} libraryId
   * @returns {Promise<object>}
   */
  async getFilterData(mediaType: string, libraryId: string): Promise<FilterData> {
    // Database initializes this cache once; entries hold the sorted menu data.
    const libraryFilterData = Database.libraryFilterData as Record<string, FilterData | undefined>
    const cachedFilterData = libraryFilterData[libraryId]
    if (cachedFilterData) {
      const cacheElapsed = Date.now() - cachedFilterData.loadedAt
      // Cache library filters for 30 mins
      // TODO: Keep cached filter data up-to-date on updates
      if (cacheElapsed < 1000 * 60 * 30) {
        return cachedFilterData
      }
    }
    const start = Date.now() // Temp for checking load times

    const data: FilterDataBuilder = {
      authors: [],
      genres: new Set(),
      tags: new Set(),
      series: [],
      narrators: new Set(),
      languages: new Set(),
      publishers: new Set(),
      publishedDecades: new Set(),
      bookCount: 0, // How many books returned from database query
      authorCount: 0, // How many authors returned from database query
      seriesCount: 0, // How many series returned from database query
      podcastCount: 0, // How many podcasts returned from database query
      numIssues: 0
    }

    const lastLoadedAt = cachedFilterData ? cachedFilterData.loadedAt : 0

    if (mediaType === 'podcast') {
      // Check how many podcasts are in library to determine if we need to load all of the data
      // This is done to handle the edge case of podcasts having been deleted and not having
      // an updatedAt timestamp to trigger a reload of the filter data
      const podcastModelCount: (options: FindAndCountOptions) => Promise<number> = process.env.QUERY_PROFILING ? profile(Database.podcastModel.count.bind(Database.podcastModel)) : Database.podcastModel.count.bind(Database.podcastModel)
      const podcastCountFromDatabase = await podcastModelCount({
        include: [{
          model: Database.libraryItemModel,
          attributes: [],
          where: {
            libraryId: libraryId
          }
        }]
      })

      // To reduce the cold-start load time, first check if any podcasts
      // have an "updatedAt" timestamp since the last time the filter
      // data was loaded. If so, we can skip loading all of the data.
      // Because many items could change, just check the count of items instead
      // of actually loading the data twice
      const changedPodcasts = await podcastModelCount({
        include: [{
          model: Database.libraryItemModel,
          attributes: [],
          where: {
            libraryId: libraryId,
            updatedAt: {
              [Sequelize.Op.gt]: new Date(lastLoadedAt)
            }
          }
        }],
        where: {
          updatedAt: {
            [Sequelize.Op.gt]: new Date(lastLoadedAt)
          }
        },
        limit: 1
      })

      if (changedPodcasts === 0) {
        // If nothing has changed, check if the number of podcasts in
        // library is still the same as prior check before updating cache creation time

        if (podcastCountFromDatabase === libraryFilterData[libraryId]?.podcastCount) {
          Logger.debug(`Filter data for ${libraryId} has not changed, returning cached data and updating cache time after ${((Date.now() - start) / 1000).toFixed(2)}s`)
          libraryFilterData[libraryId].loadedAt = Date.now()
          // Matching stored counts imply that an earlier cache entry exists.
          return cachedFilterData!
        }
      }

      // Something has changed in the podcasts table, so reload all of the filter data for library
      const findAll = process.env.QUERY_PROFILING ? profile(Database.podcastModel.findAll.bind(Database.podcastModel)) : Database.podcastModel.findAll.bind(Database.podcastModel)
      const podcasts = await findAll({
        include: [{
          model: Database.libraryItemModel,
          attributes: [],
          where: {
            libraryId: libraryId
          }
        }],
        attributes: ['tags', 'genres', 'language']
      })
      for (const podcast of podcasts as Podcast[]) {
        if (podcast.tags?.length) {
          podcast.tags.forEach((tag) => data.tags.add(tag))
        }
        if (podcast.genres?.length) {
          podcast.genres.forEach((genre) => data.genres.add(genre))
        }
        if (podcast.language) {
          data.languages.add(podcast.language)
        }
      }

      // Set podcast count for later comparison
      data.podcastCount = podcastCountFromDatabase
    } else {
      const bookCountFromDatabase = await Database.bookModel.count({
        include: [{
          model: Database.libraryItemModel,
          attributes: [],
          where: {
            libraryId: libraryId
          }
        }]
      } satisfies FindAndCountOptions as CountOptions)

      const seriesCountFromDatabase = await Database.seriesModel.count({
        where: {
          libraryId: libraryId
        }
      } satisfies FindAndCountOptions as CountOptions)

      const authorCountFromDatabase = await Database.authorModel.count({
        where: {
          libraryId: libraryId
        }
      } satisfies FindAndCountOptions as CountOptions)

      // To reduce the cold-start load time, first check if any library items, series,
      // or authors have an "updatedAt" timestamp since the last time the filter
      // data was loaded. If so, we can skip loading all of the data.
      // Because many items could change, just check the count of items instead
      // of actually loading the data twice

      const changedBooks = await Database.bookModel.count({
        include: [{
          model: Database.libraryItemModel,
          attributes: [],
          where: {
            libraryId: libraryId,
            updatedAt: {
              [Sequelize.Op.gt]: new Date(lastLoadedAt)
            }
          }
        }],
        where: {
          updatedAt: {
            [Sequelize.Op.gt]: new Date(lastLoadedAt)
          }
        },
        limit: 1
      } satisfies FindAndCountOptions as CountOptions)

      const changedSeries = await Database.seriesModel.count({
        where: {
          libraryId: libraryId,
          updatedAt: {
            [Sequelize.Op.gt]: new Date(lastLoadedAt)
          }
        },
        limit: 1
      } satisfies FindAndCountOptions as CountOptions)

      const changedAuthors = await Database.authorModel.count({
        where: {
          libraryId: libraryId,
          updatedAt: {
            [Sequelize.Op.gt]: new Date(lastLoadedAt)
          }
        },
        limit: 1
      } satisfies FindAndCountOptions as CountOptions)

      if (changedBooks + changedSeries + changedAuthors === 0) {
        // If nothing has changed, check if the number of authors, series, and books
        // matches the prior check before updating cache creation time
        if (bookCountFromDatabase === libraryFilterData[libraryId]?.bookCount && seriesCountFromDatabase === libraryFilterData[libraryId]?.seriesCount && authorCountFromDatabase === libraryFilterData[libraryId].authorCount) {
          Logger.debug(`Filter data for ${libraryId} has not changed, returning cached data and updating cache time after ${((Date.now() - start) / 1000).toFixed(2)}s`)
          libraryFilterData[libraryId].loadedAt = Date.now()
          // Matching stored counts imply that an earlier cache entry exists.
          return cachedFilterData!
        }
      }

      // Store the counts for later comparison
      data.bookCount = bookCountFromDatabase
      data.seriesCount = seriesCountFromDatabase
      data.authorCount = authorCountFromDatabase

      // Something has changed in one of the tables, so reload all of the filter data for library
      const books = await Database.bookModel.findAll({
        include: [{
          model: Database.libraryItemModel,
          attributes: ['isMissing', 'isInvalid'],
          where: {
            libraryId: libraryId
          }
        }],
        attributes: ['tags', 'genres', 'publisher', 'publishedYear', 'narrators', 'language']
      })
      for (const book of books) {
        if (book.libraryItem!.isMissing || book.libraryItem!.isInvalid) data.numIssues++
        if (book.tags?.length) {
          book.tags.forEach((tag) => data.tags.add(tag))
        }
        if (book.genres?.length) {
          book.genres.forEach((genre) => data.genres.add(genre))
        }
        if (book.narrators?.length) {
          book.narrators.forEach((narrator) => data.narrators.add(narrator))
        }
        if (book.publisher) data.publishers.add(book.publisher)
        // Check if published year exists and is valid
        if (book.publishedYear && !isNaN(Number(book.publishedYear)) && Number(book.publishedYear) > 0 && Number(book.publishedYear) < 3000) {
          const decade = (Math.floor(Number(book.publishedYear) / 10) * 10).toString()
          data.publishedDecades.add(decade)
        }
        if (book.language) data.languages.add(book.language)
      }

      const series = await Database.seriesModel.findAll({
        where: {
          libraryId: libraryId
        },
        attributes: ['id', 'name']
      })
      series.forEach((s) => data.series.push({ id: s.id, name: s.name || 'No Title' }))

      const authors = await Database.authorModel.findAll({
        where: {
          libraryId: libraryId
        },
        attributes: ['id', 'name']
      })
      authors.forEach((a) => data.authors.push({ id: a.id, name: a.name }))
    }

    // Sorting completes the builder in place, preserving the cached object identity.
    const filterData = data as unknown as FilterData
    filterData.authors = naturalSort(data.authors).asc((au) => au.name)
    filterData.genres = naturalSort([...data.genres]).asc()
    filterData.tags = naturalSort([...data.tags]).asc()
    filterData.series = naturalSort(data.series).asc((se) => se.name)
    filterData.narrators = naturalSort([...data.narrators]).asc()
    filterData.publishers = naturalSort([...data.publishers]).asc()
    filterData.publishedDecades = naturalSort([...data.publishedDecades]).asc()
    filterData.languages = naturalSort([...data.languages]).asc()
    filterData.loadedAt = Date.now()
    libraryFilterData[libraryId] = filterData

    Logger.debug(`Loaded filterdata in ${((Date.now() - start) / 1000).toFixed(2)}s`)
    return filterData
  }
}

declare namespace libraryFilters { export type { FilterOptions, FilterData, ShelfJSON } }

export = libraryFilters
