const { DataTypes, Model, Sequelize } = require('sequelize')

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

    // Expanded properties

    /** @type {import('./Book').BookExpandedWithLibraryItem[]} - only set when expanded */
    this.books
  }

  /**
   * Whether the user is allowed to see a book inside a collection
   *
   * @param {import('./User')|null} user
   * @param {{ tags?: string[], explicit?: boolean }} book
   * @returns {boolean}
   */
  static canUserAccessBook(user, book) {
    if (!user) return true
    if (book.tags?.length && !user.checkCanAccessLibraryItemWithTags(book.tags)) return false
    if (book.explicit === true && !user.canAccessExplicitContent) return false
    return true
  }

  /**
   * Find the collections the user can see, along with the ids of the books they can see in each.
   * Only loads the columns needed for the permission checks, so this stays cheap for large libraries.
   * Collections whose books are all hidden from the user are left out.
   *
   * @param {import('./User')|null} user
   * @param {string} [libraryId]
   * @returns {Promise<{ id: string, bookIds: Set<string> }[]>}
   */
  static async getAccessibleCollectionBookIds(user, libraryId) {
    const collections = await this.findAll({
      attributes: ['id'],
      where: libraryId ? { libraryId } : null,
      include: [
        {
          model: this.sequelize.models.book,
          attributes: ['id', 'tags', 'explicit'],
          through: { attributes: [] }
        }
      ],
      order: [['createdAt', 'ASC']]
    })

    const accessible = []
    for (const collection of collections) {
      const allBooks = collection.books || []
      const bookIds = new Set(allBooks.filter((b) => this.canUserAccessBook(user, b)).map((b) => b.id))

      // Users with restricted permissions will not see this collection
      if (!bookIds.size && allBooks.length) continue

      accessible.push({ id: collection.id, bookIds })
    }
    return accessible
  }

  /**
   * Get toOldJSONExpanded for the given collections, with books filtered to the ones the user can access
   *
   * @param {{ id: string, bookIds: Set<string> }[]} accessible
   * @param {string[]} [include]
   * @returns {Promise<Object[]>}
   */
  static async expandAccessibleCollections(accessible, include) {
    if (!accessible.length) return []

    // Optionally include rssfeed for collection
    const collectionIncludes = []
    if (include?.includes('rssfeed')) {
      collectionIncludes.push({
        model: this.sequelize.models.feed
      })
    }

    const collections = await this.findAll({
      where: { id: accessible.map((a) => a.id) },
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
      order: [
        ['createdAt', 'ASC'],
        [this.sequelize.models.book, this.sequelize.models.collectionBook, 'order', 'ASC']
      ]
    })

    const bookIdsByCollectionId = new Map(accessible.map((a) => [a.id, a.bookIds]))
    return collections.map((c) => {
      const bookIds = bookIdsByCollectionId.get(c.id)
      c.books = (c.books || []).filter((b) => bookIds.has(b.id))

      const collectionExpanded = c.toOldJSONExpanded()

      // Map feed if found
      if (c.feeds?.length) {
        collectionExpanded.rssFeed = c.feeds[0].toOldJSON()
      }

      return collectionExpanded
    })
  }

  /**
   * Get all toOldJSONExpanded, items filtered for user permissions
   *
   * @param {import('./User')} user
   * @param {string} [libraryId]
   * @param {string[]} [include]
   * @async
   */
  static async getOldCollectionsJsonExpanded(user, libraryId, include) {
    const accessible = await this.getAccessibleCollectionBookIds(user, libraryId)
    return this.expandAccessibleCollections(accessible, include)
  }

  /**
   * Get one page of toOldJSONExpanded collections, items filtered for user permissions.
   * Only the collections on the requested page are loaded in full.
   *
   * @param {import('./User')} user
   * @param {string} libraryId
   * @param {string[]} include
   * @param {number} limit - 0 returns every collection
   * @param {number} page
   * @returns {Promise<{ collections: Object[], total: number }>}
   */
  static async getOldCollectionsJsonExpandedPage(user, libraryId, include, limit, page) {
    let accessible = await this.getAccessibleCollectionBookIds(user, libraryId)
    const total = accessible.length

    if (limit > 0) {
      const startIndex = page * limit
      accessible = accessible.slice(startIndex, startIndex + limit)
    }

    return { collections: await this.expandAccessibleCollections(accessible, include), total }
  }

  /**
   *
   * @param {string} collectionId
   * @returns {Promise<Collection>}
   */
  static async getExpandedById(collectionId) {
    return this.findByPk(collectionId, {
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
        }
      ],
      order: [[this.sequelize.models.book, this.sequelize.models.collectionBook, 'order', 'ASC']]
    })
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
   * Get all books in collection expanded with library item
   *
   * @returns {Promise<import('./Book').BookExpandedWithLibraryItem[]>}
   */
  getBooksExpandedWithLibraryItem() {
    return this.getBooks({
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
    })
  }

  /**
   * Get toOldJSONExpanded, items filtered for user permissions
   *
   * @param {import('./User')|null} user
   * @param {string[]} [include]
   * @async
   */
  async getOldJsonExpanded(user, include) {
    this.books = await this.getBooksExpandedWithLibraryItem()

    // Filter books using user permissions
    // TODO: Handle user permission restrictions on initial query
    if (user) {
      const books = this.books.filter((b) => {
        if (b.tags?.length && !user.checkCanAccessLibraryItemWithTags(b.tags)) {
          return false
        }
        if (b.explicit === true && !user.canAccessExplicitContent) {
          return false
        }
        return true
      })

      // Users with restricted permissions will not see this collection
      if (!books.length && this.books.length) {
        return null
      }

      this.books = books
    }

    const collectionExpanded = this.toOldJSONExpanded()

    if (include?.includes('rssfeed')) {
      const feeds = await this.getFeeds()
      if (feeds?.length) {
        collectionExpanded.rssFeed = feeds[0].toOldJSON()
      }
    }

    return collectionExpanded
  }

  /**
   *
   * @param {string[]} [libraryItemIds=[]]
   * @returns
   */
  toOldJSON(libraryItemIds = []) {
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

  toOldJSONExpanded() {
    if (!this.books) {
      throw new Error('Books are required to expand Collection')
    }

    const json = this.toOldJSON()
    json.books = this.books.map((book) => {
      const libraryItem = book.libraryItem
      delete book.libraryItem
      libraryItem.media = book
      return libraryItem.toOldJSONExpanded()
    })

    return json
  }
}

module.exports = Collection
