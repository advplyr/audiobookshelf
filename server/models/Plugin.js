const { DataTypes, Model } = require('sequelize')

class Plugin extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.name
    /** @type {string} */
    this.version
    /** @type {boolean} */
    this.isMissing
    /** @type {Object} */
    this.config
    /** @type {Object} */
    this.extraData
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
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
        version: DataTypes.STRING,
        isMissing: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        config: DataTypes.JSON,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'plugin'
      }
    )
  }
}

module.exports = Plugin
