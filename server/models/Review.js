const { DataTypes, Model } = require('sequelize')

class Review extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {number} */
    this.rating
    /** @type {string} */
    this.reviewText
    /** @type {UUIDV4} */
    this.userId
    /** @type {UUIDV4} */
    this.libraryItemId
    /** @type {Date} */
    this.updatedAt
    /** @type {Date} */
    this.createdAt
  }

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
