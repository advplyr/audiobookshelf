const { DataTypes, Model, where, fn, col, literal } = require('sequelize')

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

    // Expanded properties

    /** @type {import('./Book').BookExpandedWithLibraryItem[]} - only set when expanded */
    this.books
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
   *
   * @param {string} seriesId
   * @returns {Promise<Series>}
   */
  static async getExpandedById(seriesId) {
    const series = await this.findByPk(seriesId)
    if (!series) return null
    series.books = await series.getBooksExpandedWithLibraryItem()
    return series
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
            // unique constraint on name and libraryId
            fields: ['name', 'libraryId'],
            unique: true,
            name: 'unique_series_name_per_library'
          },
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

  /**
   * Get all books in collection expanded with library item
   *
   * @returns {Promise<import('./Book').BookExpandedWithLibraryItem[]>}
   */
  getBooksExpandedWithLibraryItem() {
    return this.getBooks({
      joinTableAttributes: ['sequence'],
      include: [
        {
          model: this.sequelize.models.libraryItem
        },
        {
          model: this.sequelize.models.author,
          through: {
            attributes: []
          }
        },
        {
          model: this.sequelize.models.series,
          through: {
            attributes: ['sequence']
          }
        }
      ],
      order: [[literal('CAST(`bookSeries.sequence` AS FLOAT) ASC NULLS LAST')]]
    })
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
