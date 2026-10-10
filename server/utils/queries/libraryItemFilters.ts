import * as Sequelize from 'sequelize'
import type { ModelStatic } from 'sequelize'
import type LibraryItem from '../../models/LibraryItem'
import type Library from '../../models/Library'
import type User from '../../models/User'
import type { BookExpandedWithLibraryItem } from '../../models/Book'
import type { PodcastExpanded } from '../../models/Podcast'
import Database from '../../Database'
import libraryItemsBookFilters from './libraryItemsBookFilters'
import libraryItemsPodcastFilters from './libraryItemsPodcastFilters'

// Search serializers are owned by the media-specific query modules.
// Their legacy JSDoc omits Promise and some returned groups.
type BookSearch = { book: unknown[]; narrators: unknown[]; authors: unknown[]; tags: unknown[]; genres: unknown[]; series: unknown[] }
type PodcastSearch = { podcast: unknown[]; tags: unknown[]; genres: unknown[]; episodes: unknown[] }
type LargestItem = { id: string; title: string | null; size: number | null }
type LargestItemRow = Omit<LibraryItem, 'size' | 'media'> & LargestItem & { media: { title: string | null } }

const libraryItemFilters = {
  /**
   * Get all library items that have tags
   * @param {string[]} tags
   * @returns {Promise<import('../../models/LibraryItem')[]>}
   */
  async getAllLibraryItemsWithTags(tags: string[]) {
    const libraryItems: LibraryItem[] = []
    const booksWithTag = await Database.bookModel.findAll({
      where: Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:tags))`), {
        [Sequelize.Op.gte]: 1
      }),
      replacements: {
        tags
      },
      include: [
        {
          model: Database.libraryItemModel
        },
        {
          model: Database.authorModel,
          through: {
            attributes: []
          }
        },
        {
          model: Database.seriesModel,
          through: {
            attributes: ['sequence']
          }
        }
      ],
      order: [
        [Database.authorModel, Database.bookAuthorModel, 'createdAt', 'ASC'],
        [Database.seriesModel, 'bookSeries', 'createdAt', 'ASC']
      ]
    })
    // The includes above load authors, series and the owning library item.
    for (const book of booksWithTag as BookExpandedWithLibraryItem[]) {
      const libraryItem = book.libraryItem
      libraryItem.media = book
      libraryItems.push(libraryItem)
    }
    const podcastsWithTag = await Database.podcastModel.findAll({
      where: Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:tags))`), {
        [Sequelize.Op.gte]: 1
      }),
      replacements: {
        tags
      },
      include: [
        {
          model: Database.libraryItemModel
        },
        {
          model: Database.podcastEpisodeModel
        }
      ]
    })
    // The includes above load episodes and the owning library item.
    for (const podcast of podcastsWithTag as (PodcastExpanded & { libraryItem: LibraryItem })[]) {
      const libraryItem = podcast.libraryItem
      libraryItem.media = podcast
      libraryItems.push(libraryItem)
    }
    return libraryItems
  },

  /**
   * Get all library items that have genres
   * @param {string[]} genres
   * @returns {Promise<import('../../models/LibraryItem')[]>}
   */
  async getAllLibraryItemsWithGenres(genres: string[]) {
    const libraryItems: LibraryItem[] = []
    const booksWithGenre = await Database.bookModel.findAll({
      where: Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(genres) WHERE json_valid(genres) AND json_each.value IN (:genres))`), {
        [Sequelize.Op.gte]: 1
      }),
      replacements: {
        genres
      },
      include: [
        {
          model: Database.libraryItemModel
        },
        {
          model: Database.authorModel,
          through: {
            attributes: []
          }
        },
        {
          model: Database.seriesModel,
          through: {
            attributes: ['sequence']
          }
        }
      ]
    })
    // The includes above load authors, series and the owning library item.
    for (const book of booksWithGenre as BookExpandedWithLibraryItem[]) {
      const libraryItem = book.libraryItem
      libraryItem.media = book
      libraryItems.push(libraryItem)
    }
    const podcastsWithGenre = await Database.podcastModel.findAll({
      where: Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(genres) WHERE json_valid(genres) AND json_each.value IN (:genres))`), {
        [Sequelize.Op.gte]: 1
      }),
      replacements: {
        genres
      },
      include: [
        {
          model: Database.libraryItemModel
        },
        {
          model: Database.podcastEpisodeModel
        }
      ]
    })
    // The includes above load episodes and the owning library item.
    for (const podcast of podcastsWithGenre as (PodcastExpanded & { libraryItem: LibraryItem })[]) {
      const libraryItem = podcast.libraryItem
      libraryItem.media = podcast
      libraryItems.push(libraryItem)
    }
    return libraryItems
  },

  /**
   * Get all library items that have narrators
   * @param {string[]} narrators
   * @param {string} libraryId
   * @returns {Promise<import('../../models/LibraryItem')[]>}
   */
  async getAllLibraryItemsWithNarrators(narrators: string[], libraryId: string) {
    const libraryItems: LibraryItem[] = []
    const booksWithGenre = await Database.bookModel.findAll({
      where: Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(narrators) WHERE json_valid(narrators) AND json_each.value IN (:narrators))`), {
        [Sequelize.Op.gte]: 1
      }),
      replacements: {
        narrators
      },
      include: [
        {
          model: Database.libraryItemModel,
          where: { libraryId }
        },
        {
          model: Database.authorModel,
          through: {
            attributes: []
          }
        },
        {
          model: Database.seriesModel,
          through: {
            attributes: ['sequence']
          }
        }
      ]
    })
    // The includes above load authors, series and the owning library item.
    for (const book of booksWithGenre as BookExpandedWithLibraryItem[]) {
      const libraryItem = book.libraryItem
      libraryItem.media = book
      libraryItems.push(libraryItem)
    }
    return libraryItems
  },

  /**
   * Search library items
   * @param {import('../../models/User')} user
   * @param {import('../../models/Library')} library
   * @param {string} query
   * @param {number} limit
   * @returns {{book:object[], narrators:object[], authors:object[], tags:object[], series:object[], podcast:object[]}}
   */
  search(user: User, library: Library, query: string, limit: number): Promise<BookSearch | PodcastSearch> {
    if (library.isBook) {
      return libraryItemsBookFilters.search(user, library, query, limit, 0) as unknown as Promise<BookSearch>
    } else {
      return libraryItemsPodcastFilters.search(user, library, query, limit, 0) as unknown as Promise<PodcastSearch>
    }
  },

  /**
   * Get largest items in library
   * @param {string} libraryId
   * @param {number} limit
   * @returns {Promise<{ id:string, title:string, size:number }[]>}
   */
  async getLargestItems(libraryId: string, limit: number): Promise<LargestItem[]> {
    // The legacy model overrides init with its one-argument database initializer.
    const libraryItemModel = Database.libraryItemModel as unknown as ModelStatic<LibraryItem>
    const libraryItems = await libraryItemModel.findAll({
      attributes: ['id', 'mediaId', 'mediaType', 'size'],
      where: {
        libraryId
      },
      include: [
        {
          model: Database.bookModel,
          attributes: ['id', 'title']
        },
        {
          model: Database.podcastModel,
          attributes: ['id', 'title']
        }
      ],
      order: [['size', 'DESC']],
      limit
    })
    // SQLite BIGINT values are numbers; afterFind normalizes the included media.
    return (libraryItems as unknown as LargestItemRow[]).map((libraryItem) => {
      return {
        id: libraryItem.id,
        title: libraryItem.media.title,
        size: libraryItem.size
      }
    })
  }
}

export = libraryItemFilters
