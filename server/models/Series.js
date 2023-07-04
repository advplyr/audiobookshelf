const { DataTypes, Model } = require('sequelize')

const oldSeries = require('../objects/entities/Series')

module.exports = (sequelize) => {
  class Series extends Model {
    static async getAllOldSeries() {
      const series = await this.findAll()
      return series.map(se => se.getOldSeries())
    }

    getOldSeries() {
      return new oldSeries({
        id: this.id,
        name: this.name,
        description: this.description,
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
        description: oldSeries.description
      }
    }

    static removeById(seriesId) {
      return this.destroy({
        where: {
          id: seriesId
        }
      })
    }
  }

  Series.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'series'
  })

  return Series
}