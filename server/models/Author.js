const { DataTypes, Model, literal } = require('sequelize')

const oldAuthor = require('../objects/entities/Author')

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

  static async getOldAuthors() {
    const authors = await this.findAll()
    return authors.map(au => au.getOldAuthor())
  }

  getOldAuthor() {
    return new oldAuthor({
      id: this.id,
      asin: this.asin,
      name: this.name,
      description: this.description,
      imagePath: this.imagePath,
      libraryId: this.libraryId,
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf()
    })
  }

  static updateFromOld(oldAuthor) {
    const author = this.getFromOld(oldAuthor)
    return this.update(author, {
      where: {
        id: author.id
      }
    })
  }

  static createFromOld(oldAuthor) {
    const author = this.getFromOld(oldAuthor)
    return this.create(author)
  }

  static createBulkFromOld(oldAuthors) {
    const authors = oldAuthors.map(this.getFromOld)
    return this.bulkCreate(authors)
  }

  static getFromOld(oldAuthor) {
    return {
      id: oldAuthor.id,
      name: oldAuthor.name,
      lastFirst: oldAuthor.lastFirst,
      asin: oldAuthor.asin,
      description: oldAuthor.description,
      imagePath: oldAuthor.imagePath,
      libraryId: oldAuthor.libraryId
    }
  }

  static removeById(authorId) {
    return this.destroy({
      where: {
        id: authorId
      }
    })
  }

  /**
   * Get oldAuthor by id
   * @param {string} authorId 
   * @returns {Promise<oldAuthor>}
   */
  static async getOldById(authorId) {
    const author = await this.findByPk(authorId)
    if (!author) return null
    return author.getOldAuthor()
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
   * Get old author by name and libraryId. name case insensitive
   * TODO: Look for authors ignoring punctuation
   * 
   * @param {string} authorName 
   * @param {string} libraryId 
   * @returns {Promise<oldAuthor>}
   */
  static async getOldByNameAndLibrary(authorName, libraryId) {
    const author = (await this.findOne({
      where: [
        literal(`name = '${authorName}' COLLATE NOCASE`),
        {
          libraryId
        }
      ]
    }))?.getOldAuthor()
    return author
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize 
   */
  static init(sequelize) {
    super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: DataTypes.STRING,
      lastFirst: DataTypes.STRING,
      asin: DataTypes.STRING,
      description: DataTypes.TEXT,
      imagePath: DataTypes.STRING
    }, {
      sequelize,
      modelName: 'author',
      indexes: [
        {
          fields: [{
            name: 'name',
            collate: 'NOCASE'
          }]
        },
        // {
        //   fields: [{
        //     name: 'lastFirst',
        //     collate: 'NOCASE'
        //   }]
        // },
        {
          fields: ['libraryId']
        }
      ]
    })

    const { library } = sequelize.models
    library.hasMany(Author, {
      onDelete: 'CASCADE'
    })
    Author.belongsTo(library)
  }
}
module.exports = Author
