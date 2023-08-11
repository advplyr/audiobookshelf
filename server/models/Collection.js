const { DataTypes, Model } = require('sequelize')

const oldCollection = require('../objects/Collection')
const { areEquivalent } = require('../utils/index')

module.exports = (sequelize) => {
  class Collection extends Model {
    /**
     * Get all old collections
     * @returns {Promise<oldCollection[]>}
     */
    static async getOldCollections() {
      const collections = await this.findAll({
        include: {
          model: sequelize.models.book,
          include: sequelize.models.libraryItem
        },
        order: [[sequelize.models.book, sequelize.models.collectionBook, 'order', 'ASC']]
      })
      return collections.map(c => this.getOldCollection(c))
    }

    /**
     * Get all old collections toJSONExpanded, items filtered for user permissions
     * @param {[oldUser]} user
     * @param {[string]} libraryId
     * @param {[string[]]} include
     * @returns {Promise<object[]>} oldCollection.toJSONExpanded
     */
    static async getOldCollectionsJsonExpanded(user, libraryId, include) {
      let collectionWhere = null
      if (libraryId) {
        collectionWhere = {
          libraryId
        }
      }

      // Optionally include rssfeed for collection
      const collectionIncludes = []
      if (include.includes('rssfeed')) {
        collectionIncludes.push({
          model: sequelize.models.feed
        })
      }

      const collections = await this.findAll({
        where: collectionWhere,
        include: [
          {
            model: sequelize.models.book,
            include: [
              {
                model: sequelize.models.libraryItem
              },
              {
                model: sequelize.models.author,
                through: {
                  attributes: []
                }
              },
              {
                model: sequelize.models.series,
                through: {
                  attributes: ['sequence']
                }
              },

            ]
          },
          ...collectionIncludes
        ],
        order: [[sequelize.models.book, sequelize.models.collectionBook, 'order', 'ASC']]
      })
      // TODO: Handle user permission restrictions on initial query
      return collections.map(c => {
        const oldCollection = this.getOldCollection(c)

        // Filter books using user permissions
        const books = c.books?.filter(b => {
          if (user) {
            if (b.tags?.length && !user.checkCanAccessLibraryItemWithTags(b.tags)) {
              return false
            }
            if (b.explicit === true && !user.canAccessExplicitContent) {
              return false
            }
          }
          return true
        }) || []

        // Map to library items
        const libraryItems = books.map(b => {
          const libraryItem = b.libraryItem
          delete b.libraryItem
          libraryItem.media = b
          return sequelize.models.libraryItem.getOldLibraryItem(libraryItem)
        })

        // Users with restricted permissions will not see this collection
        if (!books.length && oldCollection.books.length) {
          return null
        }

        const collectionExpanded = oldCollection.toJSONExpanded(libraryItems)

        // Map feed if found
        if (c.feeds?.length) {
          collectionExpanded.rssFeed = sequelize.models.feed.getOldFeed(c.feeds[0])
        }

        return collectionExpanded
      }).filter(c => c)
    }

    /**
     * Get old collection from Collection
     * @param {Collection} collectionExpanded 
     * @returns {oldCollection}
     */
    static getOldCollection(collectionExpanded) {
      const libraryItemIds = collectionExpanded.books?.map(b => b.libraryItem?.id || null).filter(lid => lid) || []
      return new oldCollection({
        id: collectionExpanded.id,
        libraryId: collectionExpanded.libraryId,
        name: collectionExpanded.name,
        description: collectionExpanded.description,
        books: libraryItemIds,
        lastUpdate: collectionExpanded.updatedAt.valueOf(),
        createdAt: collectionExpanded.createdAt.valueOf()
      })
    }

    static createFromOld(oldCollection) {
      const collection = this.getFromOld(oldCollection)
      return this.create(collection)
    }

    static async fullUpdateFromOld(oldCollection, collectionBooks) {
      const existingCollection = await this.findByPk(oldCollection.id, {
        include: sequelize.models.collectionBook
      })
      if (!existingCollection) return false

      let hasUpdates = false
      const collection = this.getFromOld(oldCollection)

      for (const cb of collectionBooks) {
        const existingCb = existingCollection.collectionBooks.find(i => i.bookId === cb.bookId)
        if (!existingCb) {
          await sequelize.models.collectionBook.create(cb)
          hasUpdates = true
        } else if (existingCb.order != cb.order) {
          await existingCb.update({ order: cb.order })
          hasUpdates = true
        }
      }
      for (const cb of existingCollection.collectionBooks) {
        // collectionBook was removed
        if (!collectionBooks.some(i => i.bookId === cb.bookId)) {
          await cb.destroy()
          hasUpdates = true
        }
      }

      let hasCollectionUpdates = false
      for (const key in collection) {
        let existingValue = existingCollection[key]
        if (existingValue instanceof Date) existingValue = existingValue.valueOf()
        if (!areEquivalent(collection[key], existingValue)) {
          hasCollectionUpdates = true
        }
      }
      if (hasCollectionUpdates) {
        existingCollection.update(collection)
        hasUpdates = true
      }
      return hasUpdates
    }

    static getFromOld(oldCollection) {
      return {
        id: oldCollection.id,
        name: oldCollection.name,
        description: oldCollection.description,
        libraryId: oldCollection.libraryId
      }
    }

    static removeById(collectionId) {
      return this.destroy({
        where: {
          id: collectionId
        }
      })
    }

    /**
     * Get collection by id
     * @param {string} collectionId 
     * @returns {Promise<oldCollection|null>} returns null if not found
     */
    static async getById(collectionId) {
      if (!collectionId) return null
      const collection = await this.findByPk(collectionId, {
        include: {
          model: sequelize.models.book,
          include: sequelize.models.libraryItem
        },
        order: [[sequelize.models.book, sequelize.models.collectionBook, 'order', 'ASC']]
      })
      if (!collection) return null
      return this.getOldCollection(collection)
    }

    /**
     * Remove all collections belonging to library
     * @param {string} libraryId 
     * @returns {Promise<number>} number of collections destroyed
     */
    static async removeAllForLibrary(libraryId) {
      if (!libraryId) return 0
      return this.destroy({
        where: {
          libraryId
        }
      })
    }

    /**
     * Get all collections for a library
     * @param {string} libraryId 
     * @returns {Promise<oldCollection[]>}
     */
    static async getAllForLibrary(libraryId) {
      if (!libraryId) return []
      const collections = await this.findAll({
        where: {
          libraryId
        },
        include: {
          model: sequelize.models.book,
          include: sequelize.models.libraryItem
        },
        order: [[sequelize.models.book, sequelize.models.collectionBook, 'order', 'ASC']]
      })
      return collections.map(c => this.getOldCollection(c))
    }

    static async getAllForBook(bookId) {
      const collections = await this.findAll({
        include: {
          model: sequelize.models.book,
          where: {
            id: bookId
          },
          required: true,
          include: sequelize.models.libraryItem
        },
        order: [[sequelize.models.book, sequelize.models.collectionBook, 'order', 'ASC']]
      })
      return collections.map(c => this.getOldCollection(c))
    }
  }

  Collection.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'collection'
  })

  const { library } = sequelize.models

  library.hasMany(Collection)
  Collection.belongsTo(library)

  return Collection
}