const { DataTypes, Model, Sequelize } = require('sequelize')

const oldCollection = require('../objects/Collection')

class Collection extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.name
    /** @type {string} */
    this.description
    /** @type {UUIDV4} */
    this.libraryId
    /** @type {Date} */
    this.updatedAt
    /** @type {Date} */
    this.createdAt
  }

  /**
   * Get all old collections toJSONExpanded, items filtered for user permissions
   *
   * @param {import('./User')} user
   * @param {string} [libraryId]
   * @param {string[]} [include]
   * @returns {Promise<oldCollection[]>} oldCollection.toJSONExpanded
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
    if (include?.includes('rssfeed')) {
      collectionIncludes.push({
        model: this.sequelize.models.feed
      })
    }

    const collections = await this.findAll({
      where: collectionWhere,
      include: [
        {
          model: this.sequelize.models.book,
          include: [
            {
              model: this.sequelize.models.libraryItem
            },
            {
              model: this.sequelize.models.author,
              through: {
                attributes: []
              }
            },
            {
              model: this.sequelize.models.series,
              through: {
                attributes: ['sequence']
              }
            }
          ]
        },
        ...collectionIncludes
      ],
      order: [[this.sequelize.models.book, this.sequelize.models.collectionBook, 'order', 'ASC']]
    })
    // TODO: Handle user permission restrictions on initial query
    return collections
      .map((c) => {
        const oldCollection = this.getOldCollection(c)

        // Filter books using user permissions
        const books =
          c.books?.filter((b) => {
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
        const libraryItems = books.map((b) => {
          const libraryItem = b.libraryItem
          delete b.libraryItem
          libraryItem.media = b
          return this.sequelize.models.libraryItem.getOldLibraryItem(libraryItem)
        })

        // Users with restricted permissions will not see this collection
        if (!books.length && oldCollection.books.length) {
          return null
        }

        const collectionExpanded = oldCollection.toJSONExpanded(libraryItems)

        // Map feed if found
        if (c.feeds?.length) {
          collectionExpanded.rssFeed = this.sequelize.models.feed.getOldFeed(c.feeds[0])
        }

        return collectionExpanded
      })
      .filter((c) => c)
  }

  /**
   * Get old collection from Collection
   * @param {Collection} collectionExpanded
   * @returns {oldCollection}
   */
  static getOldCollection(collectionExpanded) {
    const libraryItemIds = collectionExpanded.books?.map((b) => b.libraryItem?.id || null).filter((lid) => lid) || []
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

  /**
   *
   * @param {oldCollection} oldCollection
   * @returns {Promise<Collection>}
   */
  static createFromOld(oldCollection) {
    const collection = this.getFromOld(oldCollection)
    return this.create(collection)
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
   * Get old collection by id
   * @param {string} collectionId
   * @returns {Promise<oldCollection|null>} returns null if not found
   */
  static async getOldById(collectionId) {
    if (!collectionId) return null
    const collection = await this.findByPk(collectionId, {
      include: {
        model: this.sequelize.models.book,
        include: this.sequelize.models.libraryItem
      },
      order: [[this.sequelize.models.book, this.sequelize.models.collectionBook, 'order', 'ASC']]
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
        name: DataTypes.STRING,
        description: DataTypes.TEXT
      },
      {
        sequelize,
        modelName: 'collection'
      }
    )

    const { library } = sequelize.models

    library.hasMany(Collection)
    Collection.belongsTo(library)
  }

  /**
   * Get old collection toJSONExpanded, items filtered for user permissions
   *
   * @param {import('./User')|null} user
   * @param {string[]} [include]
   * @returns {Promise<oldCollection>} oldCollection.toJSONExpanded
   */
  async getOldJsonExpanded(user, include) {
    this.books =
      (await this.getBooks({
        include: [
          {
            model: this.sequelize.models.libraryItem
          },
          {
            model: this.sequelize.models.author,
            through: {
              attributes: []
            }
          },
          {
            model: this.sequelize.models.series,
            through: {
              attributes: ['sequence']
            }
          }
        ],
        order: [Sequelize.literal('`collectionBook.order` ASC')]
      })) || []

    // Filter books using user permissions
    // TODO: Handle user permission restrictions on initial query
    const books =
      this.books?.filter((b) => {
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
    const libraryItems = books.map((b) => {
      const libraryItem = b.libraryItem
      delete b.libraryItem
      libraryItem.media = b
      return this.sequelize.models.libraryItem.getOldLibraryItem(libraryItem)
    })

    // Users with restricted permissions will not see this collection
    if (!books.length && this.books.length) {
      return null
    }

    const collectionExpanded = this.toOldJSONExpanded(libraryItems)

    if (include?.includes('rssfeed')) {
      const feeds = await this.getFeeds()
      if (feeds?.length) {
        collectionExpanded.rssFeed = this.sequelize.models.feed.getOldFeed(feeds[0])
      }
    }

    return collectionExpanded
  }

  /**
   *
   * @param {string[]} libraryItemIds
   * @returns
   */
  toOldJSON(libraryItemIds) {
    return {
      id: this.id,
      libraryId: this.libraryId,
      name: this.name,
      description: this.description,
      books: [...libraryItemIds],
      lastUpdate: this.updatedAt.valueOf(),
      createdAt: this.createdAt.valueOf()
    }
  }

  /**
   *
   * @param {import('../objects/LibraryItem')} oldLibraryItems
   * @returns
   */
  toOldJSONExpanded(oldLibraryItems) {
    const json = this.toOldJSON(oldLibraryItems.map((li) => li.id))
    json.books = json.books
      .map((libraryItemId) => {
        const book = oldLibraryItems.find((li) => li.id === libraryItemId)
        return book ? book.toJSONExpanded() : null
      })
      .filter((b) => !!b)
    return json
  }
}

module.exports = Collection
