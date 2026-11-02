const { DataTypes, Model } = require('sequelize')

/**
 * Fork addition: a book a user wants but doesn't have yet.
 * Table is created by sequelize.sync() on startup, so no migration is needed.
 */
class WishlistItem extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.title
    /** @type {string} */
    this.author
    /** @type {string} */
    this.series
    /** @type {string} */
    this.asin
    /** @type {string} */
    this.isbn
    /** @type {string} */
    this.url
    /** @type {string} */
    this.coverUrl
    /** @type {string} */
    this.notes
    /** @type {'wanted'|'acquired'} */
    this.status
    /** @type {UUIDV4} */
    this.libraryItemId
    /** @type {UUIDV4} */
    this.userId
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  /** Fields a client may set on create/update */
  static get editableFields() {
    return ['title', 'author', 'series', 'asin', 'isbn', 'url', 'coverUrl', 'notes', 'status', 'libraryItemId']
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
        title: {
          type: DataTypes.STRING,
          allowNull: false
        },
        author: DataTypes.STRING,
        series: DataTypes.STRING,
        asin: DataTypes.STRING,
        isbn: DataTypes.STRING,
        url: DataTypes.STRING,
        coverUrl: DataTypes.STRING,
        notes: DataTypes.TEXT,
        status: {
          type: DataTypes.STRING,
          defaultValue: 'wanted'
        },
        // Set when the wanted book shows up in a library. Plain column, no FK, so
        // removing a library item never touches the wishlist.
        libraryItemId: DataTypes.UUID
      },
      {
        sequelize,
        modelName: 'wishlistItem',
        indexes: [{ fields: ['userId'] }]
      }
    )

    const { user } = sequelize.models

    user.hasMany(WishlistItem, {
      onDelete: 'CASCADE'
    })
    WishlistItem.belongsTo(user)
  }

  toJSONForClient() {
    return {
      id: this.id,
      title: this.title,
      author: this.author,
      series: this.series,
      asin: this.asin,
      isbn: this.isbn,
      url: this.url,
      coverUrl: this.coverUrl,
      notes: this.notes,
      status: this.status,
      libraryItemId: this.libraryItemId,
      createdAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf()
    }
  }
}

module.exports = WishlistItem
