const { DataTypes, Model, Op } = require('sequelize')

class ApiToken extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.name
    /** @type {string} */
    this.tokenHash
    /** @type {Date} */
    this.expiresAt
    /** @type {Date} */
    this.lastUsedAt
    /** @type {boolean} */
    this.isActive
    /** @type {Object} */
    this.permissions
    /** @type {Date} */
    this.createdAt
    /** @type {UUIDV4} */
    this.userId

    // Expanded properties

    /** @type {import('./User').User} */
    this.user
  }

  /**
   * Clean up expired api tokens from the database
   * @returns {Promise<number>} Number of api tokens deleted
   */
  static async cleanupExpiredApiTokens() {
    const deletedCount = await ApiToken.destroy({
      where: {
        expiresAt: {
          [Op.lt]: new Date()
        }
      }
    })
    return deletedCount
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
        tokenHash: {
          type: DataTypes.STRING,
          allowNull: false
        },
        expiresAt: DataTypes.DATE,
        lastUsedAt: DataTypes.DATE,
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        permissions: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'apiToken'
      }
    )

    const { user } = sequelize.models
    user.hasMany(ApiToken, {
      onDelete: 'CASCADE',
      foreignKey: {
        allowNull: false
      }
    })
    ApiToken.belongsTo(user)
  }
}

module.exports = ApiToken
