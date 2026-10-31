import { DataTypes, Model, where, fn, col } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'
import type { BookExpanded } from './Book'
import type LibraryItem from './LibraryItem'
import * as parseNameString from '../utils/parsers/parseNameString'

type AuthorAttributes = {
  id: string
  name: string | null
  lastFirst: string | null
  asin: string | null
  description: string | null
  imagePath: string | null
  libraryId?: string | null
  updatedAt?: Date
  createdAt?: Date
}

type AuthorCreation = Optional<AuthorAttributes, 'id' | 'name' | 'lastFirst' | 'asin' | 'description' | 'imagePath' | 'libraryId' | 'updatedAt' | 'createdAt'>

type AuthorBook = BookExpanded & { libraryItem?: LibraryItem }

class Author extends Model<AuthorAttributes, AuthorCreation> {
  // Query methods are used after Database.buildModels initializes the model.
  declare static sequelize: Sequelize
  declare id: string
  declare name: string | null
  declare lastFirst: string | null
  declare asin: string | null
  declare description: string | null
  declare imagePath: string | null
  declare libraryId: string | null
  declare updatedAt: Date
  declare createdAt: Date
  declare books?: AuthorBook[]

  constructor(values?: AuthorCreation, options?: BuildOptions) {
    super(values, options)
  }

  /**
   *
   * @param {string} name
   * @returns {string}
   */
  static getLastFirst(name: string | null | undefined) {
    if (!name) return null
    return parseNameString.nameToLastFirst(name)
  }

  /**
   * Check if author exists
   * @param {string} authorId
   * @returns {Promise<boolean>}
   */
  static async checkExistsById(authorId: string) {
    return (await this.count({ where: { id: authorId } })) > 0
  }

  /**
   * Get author by name and libraryId. name case insensitive
   * TODO: Look for authors ignoring punctuation
   *
   * @param {string} authorName
   * @param {string} libraryId
   * @returns {Promise<Author>}
   */
  static async getByNameAndLibrary(authorName: string, libraryId: string) {
    return this.findOne({
      where: [
        where(fn('lower', col('name')), authorName.toLowerCase()),
        {
          libraryId
        }
      ]
    })
  }

  /**
   *
   * @param {string} authorId
   * @returns {Promise<import('./LibraryItem')[]>}
   */
  static async getAllLibraryItemsForAuthor(authorId: string): Promise<LibraryItem[]> {
    const author = await this.findByPk(authorId, {
      include: [
        {
          model: this.sequelize.models.book,
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
          ]
        }
      ]
    })

    const libraryItems: LibraryItem[] = []
    // The existing contract requires a matching author and an included library item.
    if (author!.books) {
      for (const book of author!.books) {
        const libraryItem = book.libraryItem!
        libraryItem.media = book
        delete book.libraryItem
        libraryItems.push(libraryItem)
      }
    }

    return libraryItems
  }

  /**
   *
   * @param {string} name
   * @param {string} libraryId
   * @returns {Promise<{ author: Author, created: boolean }>}
   */
  static async findOrCreateByNameAndLibrary(name: string, libraryId: string) {
    const author = await this.getByNameAndLibrary(name, libraryId)
    if (author) return { author, created: false }
    const newAuthor = await this.create({
      name,
      lastFirst: this.getLastFirst(name),
      libraryId
    })
    return { author: newAuthor, created: true }
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
    super.init<typeof Author, Author>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: DataTypes.STRING,
        lastFirst: DataTypes.STRING,
        asin: DataTypes.STRING,
        description: DataTypes.TEXT,
        imagePath: DataTypes.STRING
      },
      {
        sequelize,
        modelName: 'author',
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
          //     name: 'lastFirst',
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
    library.hasMany(Author, {
      onDelete: 'CASCADE'
    })
    Author.belongsTo(library)
  }

  toOldJSON() {
    return {
      id: this.id,
      asin: this.asin,
      name: this.name,
      description: this.description,
      imagePath: this.imagePath,
      libraryId: this.libraryId,
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf()
    }
  }

  /**
   *
   * @param {number} numBooks
   * @returns
   */
  toOldJSONExpanded(numBooks = 0) {
    const oldJson: ReturnType<Author['toOldJSON']> & { numBooks?: number } = this.toOldJSON()
    oldJson.numBooks = numBooks
    return oldJson
  }

  toJSONMinimal() {
    return {
      id: this.id,
      name: this.name
    }
  }
}
export = Author
