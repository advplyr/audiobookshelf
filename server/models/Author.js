const { DataTypes, Model, Op } = require('sequelize')
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

  /**
   * Remove all punctionation, diacritics, and whitespace and convert to lowercase for searching and matching
   * @param {string} name
   * @returns {string}
   */
  static normalizeSearchName(name) {
    if (!name?.trim()) return null
    return name
      .normalize('NFKC') // Standardize compatibility characters
      .normalize('NFD') // Split accents into combining marks
      .toLocaleLowerCase('und')
      .replace(/[\p{P}\p{Z}\p{M}\s]+/gu, '') // Remove punctuation, whitespace, and diacritics
      .trim()
  }

  /**
   * Calculate derived fields. Returns null if name is empty after normalization
   * @param {string} name
   * @returns { lastFirst: string?, searchName: string? }
   */
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

  /**
   * Check if two author names match after normalization
   * @param {string} leftName
   * @param {string} rightName
   * @returns {boolean}
   */
  static isAuthorNameMatch(leftName, rightName) {
    return this.normalizeSearchName(leftName) === this.normalizeSearchName(rightName)
  }

  /**
   * Check if any derived fields would change to reduce unnecessary database writes
   * @param {Author} author
   * @returns
   */
  static hasDerivedFieldChange(author) {
    const derivedFields = this.buildAuthorDerivedFields(author.name)
    let changed = false

    if (author.lastFirst !== derivedFields.lastFirst) {
      author.setDataValue('lastFirst', derivedFields.lastFirst)
      author.changed('lastFirst', true)
      changed = true
    }

    if (author.searchName !== derivedFields.searchName) {
      author.setDataValue('searchName', derivedFields.searchName)
      author.changed('searchName', true)
      changed = true
    }

    return changed
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
   * @param {string} authorName
   * @param {string} libraryId
   * @param {string} [excludeAuthorId]
   * @returns {Promise<Author>}
   */
  static async getByNameAndLibrary(authorName, libraryId, excludeAuthorId = null) {
    const searchName = this.normalizeSearchName(authorName)
    if (!searchName) return null

    const where = {
      searchName,
      libraryId
    }
    if (excludeAuthorId) {
      where.id = {
        [Op.not]: excludeAuthorId
      }
    }

    return this.findOne({ where })
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
   * Ensure duplicate authors are not created for the same library using the normalized name
   * @param {string} name
   * @param {string} libraryId
   * @returns {Promise<{ author: Author, created: boolean }>}
   */
  static async findOrCreateByNameAndLibrary(name, libraryId) {
    const searchName = this.normalizeSearchName(name)
    if (!searchName) {
      return { author: null, created: false }
    }

    const [author, created] = await this.findCreateFind({
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
