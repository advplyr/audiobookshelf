import { DataTypes, Model, where, fn, col, literal } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'
import type { BookExpanded } from './Book'
import type LibraryItem from './LibraryItem'

import utils from '../utils/index'
import type { BelongsToManyGetAssociationsMixin, Order } from 'sequelize'
import type BookSeries from './BookSeries'

const { getTitlePrefixAtEnd, getTitleIgnorePrefix } = utils

type SeriesAttributes = {
  id: string
  name: string | null
  nameIgnorePrefix: string | null
  description: string | null
  libraryId?: string | null
  createdAt?: Date
  updatedAt?: Date
}

type SeriesCreation = Optional<SeriesAttributes, 'id' | 'name' | 'nameIgnorePrefix' | 'description' | 'libraryId' | 'createdAt' | 'updatedAt'>

type SeriesBook = BookExpanded & { libraryItem?: LibraryItem; bookSeries?: BookSeries }

class Series extends Model<SeriesAttributes, SeriesCreation> {
  // Query methods are used after Database.buildModels initializes the model.
  declare static sequelize: Sequelize
  declare id: string
  declare name: string | null
  declare nameIgnorePrefix: string | null
  declare description: string | null
  declare libraryId: string | null
  declare createdAt: Date
  declare updatedAt: Date
  declare books?: SeriesBook[]
  declare getBooks: BelongsToManyGetAssociationsMixin<SeriesBook>

  constructor(values?: SeriesCreation, options?: BuildOptions) {
    super(values, options)
  }

  /**
   * Check if series exists
   * @param {string} seriesId
   * @returns {Promise<boolean>}
   */
  static async checkExistsById(seriesId: string) {
    return (await this.count({ where: { id: seriesId } })) > 0
  }

  /**
   * Get series by name and libraryId. name case insensitive
   *
   * @param {string} seriesName
   * @param {string} libraryId
   * @returns {Promise<Series>}
   */
  static async getByNameAndLibrary(seriesName: string, libraryId: string) {
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
  static async getExpandedById(seriesId: string) {
    const series = await this.findByPk(seriesId)
    if (!series) return null
    series.books = await series.getBooksExpandedWithLibraryItem()
    return series
  }

  /**
   *
   * @param {string} seriesName
   * @param {string} libraryId
   * @returns {Promise<Series>}
   */
  static async findOrCreateByNameAndLibrary(seriesName: string, libraryId: string) {
    const series = await this.getByNameAndLibrary(seriesName, libraryId)
    if (series) return series
    return this.create({
      name: seriesName,
      nameIgnorePrefix: getTitleIgnorePrefix(seriesName),
      libraryId
    })
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize: Sequelize): void
  // Retain Sequelize's static signature for its polymorphic model methods.
  // Application code uses the single-argument initializer, as before migration.
  static init<MS extends ModelStatic<Model>, M extends InstanceType<MS>>(
    this: MS,
    attributes: ModelAttributes<M, Partial<Attributes<M>>>,
    options: InitOptions<M>
  ): MS
  static init(sequelizeOrAttributes: Sequelize | ModelAttributes): void | ModelStatic<Model> {
    // Database.buildModels supplies a Sequelize instance; the other overload preserves
    // the inherited static contract required by Sequelize's generic query methods.
    const sequelize = sequelizeOrAttributes as Sequelize
    super.init<typeof Series, Series>(
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
      // Sequelize supports a single-literal order tuple, omitted from its type union.
      order: [[literal('CAST(`bookSeries.sequence` AS FLOAT) ASC NULLS LAST')]] as unknown as Order
    })
  }

  toOldJSON() {
    return {
      id: this.id,
      name: this.name,
      nameIgnorePrefix: getTitlePrefixAtEnd(this.name!),
      description: this.description,
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf(),
      libraryId: this.libraryId
    }
  }

  toJSONMinimal(sequence?: string | null) {
    return {
      id: this.id,
      name: this.name,
      sequence
    }
  }
}

export = Series
