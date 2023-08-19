const Sequelize = require('sequelize')
const Database = require('../../Database')
const libraryItemsBookFilters = require('./libraryItemsBookFilters')
const libraryItemsPodcastFilters = require('./libraryItemsPodcastFilters')

module.exports = {
  /**
   * Get all library items that have tags
   * @param {string[]} tags 
   * @returns {Promise<LibraryItem[]>}
   */
  async getAllLibraryItemsWithTags(tags) {
    const libraryItems = []
    const booksWithTag = await Database.models.book.findAll({
      where: Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:tags))`), {
        [Sequelize.Op.gte]: 1
      }),
      replacements: {
        tags
      },
      include: [
        {
          model: Database.models.libraryItem
        },
        {
          model: Database.models.author,
          through: {
            attributes: []
          }
        },
        {
          model: Database.models.series,
          through: {
            attributes: ['sequence']
          }
        }
      ]
    })
    for (const book of booksWithTag) {
      const libraryItem = book.libraryItem
      libraryItem.media = book
      libraryItems.push(libraryItem)
    }
    const podcastsWithTag = await Database.models.podcast.findAll({
      where: Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(tags) WHERE json_valid(tags) AND json_each.value IN (:tags))`), {
        [Sequelize.Op.gte]: 1
      }),
      replacements: {
        tags
      },
      include: [
        {
          model: Database.models.libraryItem
        },
        {
          model: Database.models.podcastEpisode
        }
      ]
    })
    for (const podcast of podcastsWithTag) {
      const libraryItem = podcast.libraryItem
      libraryItem.media = podcast
      libraryItems.push(libraryItem)
    }
    return libraryItems
  },

  /**
   * Get all library items that have genres
   * @param {string[]} genres 
   * @returns {Promise<LibraryItem[]>}
   */
  async getAllLibraryItemsWithGenres(genres) {
    const libraryItems = []
    const booksWithGenre = await Database.models.book.findAll({
      where: Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(genres) WHERE json_valid(genres) AND json_each.value IN (:genres))`), {
        [Sequelize.Op.gte]: 1
      }),
      replacements: {
        genres
      },
      include: [
        {
          model: Database.models.libraryItem
        },
        {
          model: Database.models.author,
          through: {
            attributes: []
          }
        },
        {
          model: Database.models.series,
          through: {
            attributes: ['sequence']
          }
        }
      ]
    })
    for (const book of booksWithGenre) {
      const libraryItem = book.libraryItem
      libraryItem.media = book
      libraryItems.push(libraryItem)
    }
    const podcastsWithGenre = await Database.models.podcast.findAll({
      where: Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(genres) WHERE json_valid(genres) AND json_each.value IN (:genres))`), {
        [Sequelize.Op.gte]: 1
      }),
      replacements: {
        genres
      },
      include: [
        {
          model: Database.models.libraryItem
        },
        {
          model: Database.models.podcastEpisode
        }
      ]
    })
    for (const podcast of podcastsWithGenre) {
      const libraryItem = podcast.libraryItem
      libraryItem.media = podcast
      libraryItems.push(libraryItem)
    }
    return libraryItems
  },

  /**
 * Get all library items that have narrators
 * @param {string[]} narrators 
 * @returns {Promise<import('../../models/LibraryItem')[]>}
 */
  async getAllLibraryItemsWithNarrators(narrators) {
    const libraryItems = []
    const booksWithGenre = await Database.models.book.findAll({
      where: Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(narrators) WHERE json_valid(narrators) AND json_each.value IN (:narrators))`), {
        [Sequelize.Op.gte]: 1
      }),
      replacements: {
        narrators
      },
      include: [
        {
          model: Database.models.libraryItem
        },
        {
          model: Database.models.author,
          through: {
            attributes: []
          }
        },
        {
          model: Database.models.series,
          through: {
            attributes: ['sequence']
          }
        }
      ]
    })
    for (const book of booksWithGenre) {
      const libraryItem = book.libraryItem
      libraryItem.media = book
      libraryItems.push(libraryItem)
    }
    return libraryItems
  },

  /**
   * Search library items
   * @param {import('../../objects/Library')} oldLibrary 
   * @param {string} query
   * @param {number} limit 
   * @returns {{book:object[], narrators:object[], authors:object[], tags:object[], series:object[], podcast:object[]}}
   */
  search(oldLibrary, query, limit) {
    if (oldLibrary.isBook) {
      return libraryItemsBookFilters.search(oldLibrary, query, limit, 0)
    } else {
      return libraryItemsPodcastFilters.search(oldLibrary, query, limit, 0)
    }
  }
}