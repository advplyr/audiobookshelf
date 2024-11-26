const { DataTypes, Model } = require('sequelize')

/**
 * @typedef MediaItemShareObject
 * @property {UUIDV4} id
 * @property {UUIDV4} mediaItemId
 * @property {string} mediaItemType
 * @property {string} slug
 * @property {string} pash
 * @property {UUIDV4} userId
 * @property {Date} expiresAt
 * @property {Object} extraData
 * @property {Date} createdAt
 * @property {Date} updatedAt
 *
 * @typedef {MediaItemShareObject & MediaItemShare} MediaItemShareModel
 */

/**
 * @typedef MediaItemShareForClient
 * @property {UUIDV4} id
 * @property {UUIDV4} mediaItemId
 * @property {string} mediaItemType
 * @property {string} slug
 * @property {Date} expiresAt
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

class MediaItemShare extends Model {
  constructor(values, options) {
    super(values, options)
  }

  toJSONForClient() {
    return {
      id: this.id,
      mediaItemId: this.mediaItemId,
      mediaItemType: this.mediaItemType,
      slug: this.slug,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  /**
   *
   * @param {string} mediaItemId
   * @param {string} mediaItemType
   * @returns {Promise<import('../objects/LibraryItem')>}
   */
  static async getMediaItemsOldLibraryItem(mediaItemId, mediaItemType) {
    if (mediaItemType === 'book') {
      const book = await this.sequelize.models.book.findByPk(mediaItemId, {
        include: [
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
          },
          {
            model: this.sequelize.models.libraryItem,
            include: {
              model: this.sequelize.models.library,
              attributes: ['settings']
            }
          }
        ]
      })
      const libraryItem = book.libraryItem
      libraryItem.media = book
      delete book.libraryItem
      const oldLibraryItem = this.sequelize.models.libraryItem.getOldLibraryItem(libraryItem)
      oldLibraryItem.librarySettings = libraryItem.library.settings
      return oldLibraryItem
    }
    return null
  }

  /**
   *
   * @param {import('sequelize').FindOptions} options
   * @returns {Promise<import('./Book')|import('./PodcastEpisode')>}
   */
  getMediaItem(options) {
    if (!this.mediaItemType) return Promise.resolve(null)
    const mixinMethodName = `get${this.sequelize.uppercaseFirst(this.mediaItemType)}`
    return this[mixinMethodName](options)
  }

  /**
   * Initialize model
   *
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
        mediaItemId: DataTypes.UUID,
        mediaItemType: DataTypes.STRING,
        slug: DataTypes.STRING,
        pash: DataTypes.STRING,
        expiresAt: DataTypes.DATE,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'mediaItemShare'
      }
    )

    const { user, book, podcastEpisode } = sequelize.models

    user.hasMany(MediaItemShare)
    MediaItemShare.belongsTo(user)

    book.hasMany(MediaItemShare, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'book'
      }
    })
    MediaItemShare.belongsTo(book, { foreignKey: 'mediaItemId', constraints: false })

    podcastEpisode.hasOne(MediaItemShare, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'podcastEpisode'
      }
    })
    MediaItemShare.belongsTo(podcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

    MediaItemShare.addHook('afterFind', (findResult) => {
      if (!findResult) return

      if (!Array.isArray(findResult)) findResult = [findResult]

      for (const instance of findResult) {
        if (instance.mediaItemType === 'book' && instance.book !== undefined) {
          instance.mediaItem = instance.book
          instance.dataValues.mediaItem = instance.dataValues.book
        } else if (instance.mediaItemType === 'podcastEpisode' && instance.podcastEpisode !== undefined) {
          instance.mediaItem = instance.podcastEpisode
          instance.dataValues.mediaItem = instance.dataValues.podcastEpisode
        }
        // To prevent mistakes:
        delete instance.book
        delete instance.dataValues.book
        delete instance.podcastEpisode
        delete instance.dataValues.podcastEpisode
      }
    })
  }
}

module.exports = MediaItemShare
