const { DataTypes, Model } = require('sequelize')

/**
 * @typedef ClientAudibleBook
 * @property {string} id
 * @property {string} audibleAccountId
 * @property {string} asin
 * @property {string} title
 * @property {string|null} subtitle
 * @property {string[]} authors
 * @property {string[]} narrators
 * @property {string|null} seriesName
 * @property {string|null} seriesPosition
 * @property {string|null} releaseDate
 * @property {string|null} coverUrl
 * @property {string|null} publisherName
 * @property {string|null} summary
 * @property {number|null} runtimeLengthMin
 * @property {string} status
 * @property {Date} lastChecked
 */

class AudibleBook extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.id
    /** @type {string} */
    this.audibleAccountId
    /** @type {string} */
    this.asin
    /** @type {string} */
    this.title
    /** @type {string|null} */
    this.subtitle
    /** @type {string[]} */
    this.authors
    /** @type {string[]} */
    this.narrators
    /** @type {string|null} */
    this.seriesName
    /** @type {string|null} */
    this.seriesPosition
    /** @type {string|null} */
    this.releaseDate
    /** @type {string|null} */
    this.coverUrl
    /** @type {string|null} */
    this.publisherName
    /** @type {string|null} */
    this.summary
    /** @type {number|null} */
    this.runtimeLengthMin
    /** @type {'available'|'preorder'|'not_available'} */
    this.status
    /** @type {Date} */
    this.lastChecked
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  /**
   * @returns {ClientAudibleBook}
   */
  toClientJson() {
    return {
      id: this.id,
      audibleAccountId: this.audibleAccountId,
      asin: this.asin,
      title: this.title,
      subtitle: this.subtitle,
      authors: this.authors || [],
      narrators: this.narrators || [],
      seriesName: this.seriesName,
      seriesPosition: this.seriesPosition,
      releaseDate: this.releaseDate,
      coverUrl: this.coverUrl,
      publisherName: this.publisherName,
      summary: this.summary,
      runtimeLengthMin: this.runtimeLengthMin,
      status: this.status,
      lastChecked: this.lastChecked
    }
  }

  /**
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
        asin: {
          type: DataTypes.STRING,
          allowNull: false
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false
        },
        subtitle: DataTypes.STRING,
        authors: {
          type: DataTypes.JSON,
          defaultValue: []
        },
        narrators: {
          type: DataTypes.JSON,
          defaultValue: []
        },
        seriesName: DataTypes.STRING,
        seriesPosition: DataTypes.STRING,
        releaseDate: DataTypes.STRING,
        coverUrl: DataTypes.TEXT,
        publisherName: DataTypes.STRING,
        summary: DataTypes.TEXT,
        runtimeLengthMin: DataTypes.INTEGER,
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'available'
        },
        lastChecked: DataTypes.DATE
      },
      {
        sequelize,
        modelName: 'audibleBook',
        indexes: [
          { fields: ['audibleAccountId'] },
          { unique: true, fields: ['asin', 'audibleAccountId'] }
        ]
      }
    )

    const { audibleAccount } = sequelize.models
    audibleAccount.hasMany(AudibleBook, { onDelete: 'CASCADE' })
    AudibleBook.belongsTo(audibleAccount)
  }
}

module.exports = AudibleBook
