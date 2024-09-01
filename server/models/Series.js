const { DataTypes, Model, where, fn, col } = require('sequelize')

const oldSeries = require('../objects/entities/Series')
const { getTitlePrefixAtEnd } = require('../utils/index')

class Series extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.name
    /** @type {string} */
    this.nameIgnorePrefix
    /** @type {string} */
    this.description
    /** @type {UUIDV4} */
    this.libraryId
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  getOldSeries() {
    return new oldSeries({
      id: this.id,
      name: this.name,
      description: this.description,
      libraryId: this.libraryId,
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf()
    })
  }

  static updateFromOld(oldSeries) {
    const series = this.getFromOld(oldSeries)
    return this.update(series, {
      where: {
        id: series.id
      }
    })
  }

  static getFromOld(oldSeries) {
    return {
      id: oldSeries.id,
      name: oldSeries.name,
      nameIgnorePrefix: oldSeries.nameIgnorePrefix,
      description: oldSeries.description,
      libraryId: oldSeries.libraryId
    }
  }

  /**
   * Check if series exists
   * @param {string} seriesId
   * @returns {Promise<boolean>}
   */
  static async checkExistsById(seriesId) {
    return (await this.count({ where: { id: seriesId } })) > 0
  }

  /**
   * Get series by name and libraryId. name case insensitive
   *
   * @param {string} seriesName
   * @param {string} libraryId
   * @returns {Promise<Series>}
   */
  static async getByNameAndLibrary(seriesName, libraryId) {
    return this.findOne({
      where: [
        where(fn('lower', col('name')), seriesName.toLowerCase()),
        {
          libraryId
        }
      ]
    })
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
        nameIgnorePrefix: DataTypes.STRING,
        description: DataTypes.TEXT
      },
      {
        sequelize,
        modelName: 'series',
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
          //     name: 'nameIgnorePrefix',
          //     collate: 'NOCASE'
          //   }]
          // },
          {
            fields: ['libraryId']
          }
        ]
      }
    )

    const { library } = sequelize.models
    library.hasMany(Series, {
      onDelete: 'CASCADE'
    })
    Series.belongsTo(library)
  }

  toOldJSON() {
    return {
      id: this.id,
      name: this.name,
      nameIgnorePrefix: getTitlePrefixAtEnd(this.name),
      description: this.description,
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf(),
      libraryId: this.libraryId
    }
  }

  toJSONMinimal(sequence) {
    return {
      id: this.id,
      name: this.name,
      sequence
    }
  }
}

module.exports = Series
