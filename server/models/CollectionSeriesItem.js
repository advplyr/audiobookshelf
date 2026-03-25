const { DataTypes, Model } = require('sequelize')

class CollectionSeriesItem extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {number} */
    this.order
    /** @type {UUIDV4} */
    this.seriesId
    /** @type {UUIDV4} */
    this.collectionId
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
        order: DataTypes.INTEGER
      },
      {
        sequelize,
        timestamps: true,
        updatedAt: false,
        modelName: 'collectionSeriesItem'
      }
    )

    // Super Many-to-Many
    const { series, collection } = sequelize.models
    series.belongsToMany(collection, { through: CollectionSeriesItem, as: 'seriesCollections' })
    collection.belongsToMany(series, { through: CollectionSeriesItem, as: 'collectionSeries' })

    series.hasMany(CollectionSeriesItem, {
      onDelete: 'CASCADE'
    })
    CollectionSeriesItem.belongsTo(series)

    collection.hasMany(CollectionSeriesItem, {
      onDelete: 'CASCADE'
    })
    CollectionSeriesItem.belongsTo(collection)
  }
}

module.exports = CollectionSeriesItem
