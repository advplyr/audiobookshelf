const { DataTypes, Model } = require('sequelize')

/**
 * @typedef ReviewJSON
 * @property {string} id
 * @property {number} rating
 * @property {string} reviewText
 * @property {string} userId
 * @property {string} libraryItemId
 * @property {number} updatedAt
 * @property {number} createdAt
 * @property {Object} [user]
 * @property {string} user.id
 * @property {string} user.username
 */

class Review extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.id
    /** @type {number} */
    this.rating
    /** @type {string} */
    this.reviewText
    /** @type {string} */
    this.userId
    /** @type {string} */
    this.libraryItemId
    /** @type {Date} */
    this.updatedAt
    /** @type {Date} */
    this.createdAt
  }

  /**
   * Initialize the Review model and associations.
   * A user can have only one review per library item.
   * 
   * @param {import('sequelize').Sequelize} sequelize 
   */
  static init(sequelize) {
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        rating: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: 1,
            max: 5
          }
        },
        reviewText: {
          type: DataTypes.TEXT,
          allowNull: true
        }
      },
      {
        sequelize,
        modelName: 'review',
        indexes: [
          {
            unique: true,
            fields: ['userId', 'libraryItemId']
          }
        ]
      }
    )

    const { user, libraryItem } = sequelize.models

    user.hasMany(Review, { onDelete: 'CASCADE' })
    Review.belongsTo(user)

    libraryItem.hasMany(Review, { onDelete: 'CASCADE' })
    Review.belongsTo(libraryItem)
  }

  /**
   * Convert to the old JSON format for the browser.
   * 
   * @returns {ReviewJSON}
   */
  toOldJSON() {
    return {
      id: this.id,
      rating: this.rating,
      reviewText: this.reviewText,
      userId: this.userId,
      libraryItemId: this.libraryItemId,
      updatedAt: this.updatedAt.valueOf(),
      createdAt: this.createdAt.valueOf(),
      user: this.user ? {
        id: this.user.id,
        username: this.user.username
      } : undefined
    }
  }
}

module.exports = Review