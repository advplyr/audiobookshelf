const { DataTypes, Model } = require('sequelize')

class UserSeriesFollow extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {UUIDV4} */
    this.userId
    /** @type {UUIDV4} */
    this.seriesId
    /** @type {Date} */
    this.createdAt
  }

  /**
   * Get array of series IDs that a user is following
   * @param {string} userId
   * @returns {Promise<string[]>}
   */
  static async getFollowedSeriesIdsForUser(userId) {
    const follows = await this.findAll({
      where: { userId },
      attributes: ['seriesId']
    })
    return follows.map((f) => f.seriesId)
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
        }
      },
      {
        sequelize,
        modelName: 'userSeriesFollow',
        timestamps: true,
        updatedAt: false,
        indexes: [
          {
            name: 'user_series_follows_userId',
            fields: ['userId']
          },
          {
            name: 'user_series_follows_unique',
            fields: ['userId', 'seriesId'],
            unique: true
          },
          {
            name: 'user_series_follows_seriesId',
            fields: ['seriesId']
          }
        ]
      }
    )

    // Super Many-to-Many
    // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
    const { user, series } = sequelize.models
    user.belongsToMany(series, { through: UserSeriesFollow, as: 'followedSeries' })
    series.belongsToMany(user, { through: UserSeriesFollow, as: 'followers' })

    user.hasMany(UserSeriesFollow, {
      onDelete: 'CASCADE'
    })
    UserSeriesFollow.belongsTo(user)

    series.hasMany(UserSeriesFollow, {
      onDelete: 'CASCADE'
    })
    UserSeriesFollow.belongsTo(series)
  }
}

module.exports = UserSeriesFollow
