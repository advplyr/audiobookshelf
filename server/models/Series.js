const { DataTypes, Model, where, fn, col } = require('sequelize')

const oldSeries = require('../objects/entities/Series')

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

  static async getAllOldSeries() {
    const series = await this.findAll()
    return series.map(se => se.getOldSeries())
  }

  getOldSeries() {
    return new oldSeries({
      id: this.id,
      name: this.name.trim(),
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

  static createFromOld(oldSeries) {
    const series = this.getFromOld(oldSeries)
    return this.create(series)
  }

  static createBulkFromOld(oldSeriesObjs) {
    const series = oldSeriesObjs.map(this.getFromOld)
    return this.bulkCreate(series)
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

  static removeById(seriesId) {
    return this.destroy({
      where: {
        id: seriesId
      }
    })
  }

  /**
   * Get oldSeries by id
   * @param {string} seriesId 
   * @returns {Promise<oldSeries>}
   */
  static async getOldById(seriesId) {
    const series = await this.findByPk(seriesId)
    if (!series) return null
    return series.getOldSeries()
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
   * Get old series by name and libraryId. name case insensitive
   * 
   * @param {string} seriesName 
   * @param {string} libraryId 
   * @returns {Promise<oldSeries>}
   */
  static async getOldByNameAndLibrary(seriesName, libraryId) {
    const series = (await this.findOne({
      where: [
        where(fn('lower', col('name')), seriesName.toLowerCase()),
        {
          libraryId
        }
      ]
    }))?.getOldSeries()
    return series
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
      nameIgnorePrefix: DataTypes.STRING,
      description: DataTypes.TEXT
    }, {
      sequelize,
      modelName: 'series',
      indexes: [
        {
          fields: [{
            name: 'name',
            collate: 'NOCASE'
          }]
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
    })

    const { library } = sequelize.models
    library.hasMany(Series, {
      onDelete: 'CASCADE'
    })
    Series.belongsTo(library)
  }
}

module.exports = Series