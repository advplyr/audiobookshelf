const { DataTypes, Model, Sequelize } = require('sequelize')

class CustomMetadataProvider extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.name
    /** @type {string} */
    this.url
    /** @type {string} */
    this.apiKey
  }

  getSlug() {
    return `custom-${this.id}`
  }

  toUserJson() {
    return {
      name: this.name,
      id: this.id,
      slug: this.getSlug()
    }
  }

  static findByPk(id) {
    return this.findOne({
      where: {
        id,
      }
    })
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
      url: DataTypes.STRING,
      apiKey: DataTypes.STRING
    }, {
      sequelize,
      modelName: 'customMetadataProvider'
    })
  }
}

module.exports = CustomMetadataProvider