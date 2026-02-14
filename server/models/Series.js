const { DataTypes, Model, where, fn, col, literal } = require('sequelize')

const { getTitlePrefixAtEnd, getTitleIgnorePrefix } = require('../utils/index')

/**
 * Normalize and validate Audible Series ASIN.
 * - null/undefined/empty → null
 * - Extracts ASIN from Audible series URLs
 * - Validates 10 alphanumeric chars
 * - Uppercases
 *
 * @param {*} value
 * @returns {string|null} Normalized ASIN or null
 * @throws {Error} If value is invalid format
 */
function normalizeAudibleSeriesAsin(value) {
  if (value == null) return null
  if (typeof value !== 'string') {
    throw new Error('audibleSeriesAsin must be a string or null')
  }

  const raw = value.trim()
  if (!raw) return null

  // Extract ASIN from Audible series URL if provided
  // e.g., https://www.audible.com/series/Harry-Potter/B0182NWM9I or /series/B0182NWM9I
  const urlMatch = raw.match(/\/series\/(?:[^/]+\/)?([A-Z0-9]{10})(?:[/?#]|$)/i)
  const candidate = (urlMatch ? urlMatch[1] : raw).toUpperCase()

  if (!/^[A-Z0-9]{10}$/.test(candidate)) {
    throw new Error('Invalid ASIN format. Must be exactly 10 alphanumeric characters.')
  }
  return candidate
}

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
    /** @type {string} */
    this.audibleSeriesAsin
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
   *
   * @param {string} seriesName
   * @param {string} libraryId
   * @param {string} [asin] - Optional Audible series ASIN
   * @returns {Promise<Series>}
   */
  static async findOrCreateByNameAndLibrary(seriesName, libraryId, asin = null) {
    const series = await this.getByNameAndLibrary(seriesName, libraryId)
    if (series) {
      // Update ASIN if provided and not already set
      if (asin && !series.audibleSeriesAsin) {
        series.audibleSeriesAsin = asin
        await series.save()
        const SocketAuthority = require('../SocketAuthority')
        SocketAuthority.emitter('series_updated', series.toOldJSON())
      }
      return series
    }
    return this.create({
      name: seriesName,
      nameIgnorePrefix: getTitleIgnorePrefix(seriesName),
      libraryId,
      audibleSeriesAsin: asin || null
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
        description: DataTypes.TEXT,
        audibleSeriesAsin: DataTypes.STRING
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

    // Hook to normalize/validate audibleSeriesAsin before save
    // This ensures ALL routes get the same validation
    Series.beforeValidate((series) => {
      if (series.changed('audibleSeriesAsin')) {
        series.audibleSeriesAsin = normalizeAudibleSeriesAsin(series.audibleSeriesAsin)
      }
    })

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
      audibleSeriesAsin: this.audibleSeriesAsin,
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
module.exports.normalizeAudibleSeriesAsin = normalizeAudibleSeriesAsin
