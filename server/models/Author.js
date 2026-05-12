const { DataTypes, Model } = require('sequelize')
const parseNameString = require('../utils/parsers/parseNameString')

class Author extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.name
    /** @type {string} */
    this.lastFirst
    /** @type {string} */
    this.searchName
    /** @type {string} */
    this.asin
    /** @type {string} */
    this.description
    /** @type {string} */
    this.imagePath
    /** @type {UUIDV4} */
    this.libraryId
    /** @type {Date} */
    this.updatedAt
    /** @type {Date} */
    this.createdAt
  }

  /**
   *
   * @param {string} name
   * @returns {string}
   */
  static getLastFirst(name) {
    if (!name) return null
    return parseNameString.nameToLastFirst(name)
  }

  static normalizeSearchName(name) {
    if (!name?.trim()) return null
    return name
      .normalize('NFKC') // Standardize compatibility characters
      .normalize('NFD') // Split accents into combining marks
      .toLocaleLowerCase('und')
      .replace(/[\p{P}\p{Z}\p{M}\s]+/gu, '') // Remove punctuation, whitespace, and diacritics
      .trim()
  }

  static buildAuthorDerivedFields(name) {
    const searchName = this.normalizeSearchName(name)
    if (!searchName) {
      return {
        lastFirst: null,
        searchName: null
      }
    }

    return {
      lastFirst: parseNameString.nameToLastFirst(name),
      searchName
    }
  }

  static isAuthorNameMatch(leftName, rightName) {
    return this.normalizeSearchName(leftName) === this.normalizeSearchName(rightName)
  }

  /**
   * Check if author exists
   * @param {string} authorId
   * @returns {Promise<boolean>}
   */
  static async checkExistsById(authorId) {
    return (await this.count({ where: { id: authorId } })) > 0
  }

  /**
   * Get author by name and libraryId. name case insensitive
   * TODO: Look for authors ignoring punctuation
   *
   * @param {string} authorName
   * @param {string} libraryId
   * @returns {Promise<Author>}
   */
  static async getByNameAndLibrary(authorName, libraryId) {
    const searchName = this.normalizeSearchName(authorName)
    if (!searchName) return null
    return this.findOne({
      where: {
        searchName,
        libraryId
      }
    })
  }

  /**
   *
   * @param {string} authorId
   * @returns {Promise<import('./LibraryItem')[]>}
   */
  static async getAllLibraryItemsForAuthor(authorId) {
    const author = await this.findByPk(authorId, {
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
      ]
    })

    const libraryItems = []
    if (author.books) {
      for (const book of author.books) {
        const libraryItem = book.libraryItem
        libraryItem.media = book
        delete book.libraryItem
        libraryItems.push(libraryItem)
      }
    }

    return libraryItems
  }

  /**
   *
   * @param {string} name
   * @param {string} libraryId
   * @returns {Promise<{ author: Author, created: boolean }>}
   */
  static async findOrCreateByNameAndLibrary(name, libraryId) {
    const searchName = this.normalizeSearchName(name)
    if (!searchName) {
      return { author: null, created: false }
    }

    const [author, created] = await this.findOrCreate({
      where: {
        searchName,
        libraryId
      },
      defaults: {
        name,
        libraryId,
        ...this.buildAuthorDerivedFields(name)
      }
    })
    return { author, created }
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
        lastFirst: DataTypes.STRING,
        searchName: DataTypes.STRING,
        asin: DataTypes.STRING,
        description: DataTypes.TEXT,
        imagePath: DataTypes.STRING
      },
      {
        sequelize,
        modelName: 'author',
        indexes: [
          {
            fields: [
              {
                name: 'name',
                collate: 'NOCASE'
              }
            ]
          },
          // {
          //   fields: [{
          //     name: 'lastFirst',
          //     collate: 'NOCASE'
          //   }]
          // },
          {
            fields: [
              {
                name: 'searchName',
                collate: 'NOCASE'
              }
            ]
          },
          {
            fields: ['searchName', 'libraryId'],
            unique: true,
            name: 'unique_author_search_name_per_library'
          },
          {
            fields: ['libraryId']
          }
        ]
      }
    )

    Author.beforeSave((author) => {
      Object.assign(author, Author.buildAuthorDerivedFields(author.name))
    })

    const { library } = sequelize.models
    library.hasMany(Author, {
      onDelete: 'CASCADE'
    })
    Author.belongsTo(library)
  }

  toOldJSON() {
    return {
      id: this.id,
      asin: this.asin,
      name: this.name,
      description: this.description,
      imagePath: this.imagePath,
      libraryId: this.libraryId,
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf()
    }
  }

  /**
   *
   * @param {number} numBooks
   * @returns
   */
  toOldJSONExpanded(numBooks = 0) {
    const oldJson = this.toOldJSON()
    oldJson.numBooks = numBooks
    return oldJson
  }

  toJSONMinimal() {
    return {
      id: this.id,
      name: this.name
    }
  }
}
module.exports = Author
