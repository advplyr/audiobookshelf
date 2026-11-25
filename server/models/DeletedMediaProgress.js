const { DataTypes, Model } = require('sequelize')

/**
 * Snapshot of a user's progress for a book / podcast episode that has since been removed from the server.
 * Only written when the server setting `keepDeletedMediaProgress` is enabled (opt-in).
 *
 * Stored in its own table (instead of keeping orphaned mediaProgresses rows) so that
 * user.mediaProgresses and the progress payloads sent to clients/apps are unaffected.
 */
class DeletedMediaProgress extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.id
    /** @type {string} */
    this.userId
    /** @type {'book'|'podcastEpisode'} */
    this.mediaItemType
    /** @type {string} ID the book/episode had before it was deleted */
    this.originalMediaItemId
    /** @type {string} */
    this.libraryId
    /** @type {string} */
    this.title
    /** @type {string} Comma separated author names (books) */
    this.authorName
    /** @type {string} */
    this.asin
    /** @type {string} */
    this.isbn
    /** @type {string} Podcast title (episodes) */
    this.podcastTitle
    /** @type {string} RSS guid (episodes) */
    this.episodeGuid
    /** @type {string} (episodes) */
    this.enclosureURL
    /** @type {Date} (episodes) */
    this.publishedAt
    /** @type {number} */
    this.duration
    /** @type {number} */
    this.currentTime
    /** @type {boolean} */
    this.isFinished
    /** @type {Date} */
    this.finishedAt
    /** @type {Date} When the user started the item (original mediaProgress createdAt) */
    this.startedAt
    /** @type {string} */
    this.ebookLocation
    /** @type {number} */
    this.ebookProgress
    /** @type {Object} */
    this.extraData
    /** @type {Date} */
    this.createdAt // When the item was deleted
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
        mediaItemType: DataTypes.STRING,
        originalMediaItemId: DataTypes.UUID,
        libraryId: DataTypes.UUID,
        title: DataTypes.STRING,
        authorName: DataTypes.STRING,
        asin: DataTypes.STRING,
        isbn: DataTypes.STRING,
        podcastTitle: DataTypes.STRING,
        episodeGuid: DataTypes.STRING,
        enclosureURL: DataTypes.STRING(1000),
        publishedAt: DataTypes.DATE,
        duration: DataTypes.FLOAT,
        currentTime: DataTypes.FLOAT,
        isFinished: DataTypes.BOOLEAN,
        finishedAt: DataTypes.DATE,
        startedAt: DataTypes.DATE,
        ebookLocation: DataTypes.STRING,
        ebookProgress: DataTypes.FLOAT,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'deletedMediaProgress',
        indexes: [
          { fields: ['userId', 'mediaItemType', 'isFinished', 'finishedAt'] },
          { fields: ['asin'] },
          { fields: ['episodeGuid'] }
        ]
      }
    )

    const { user } = sequelize.models
    user.hasMany(DeletedMediaProgress, {
      onDelete: 'CASCADE'
    })
    DeletedMediaProgress.belongsTo(user)
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      mediaItemType: this.mediaItemType,
      originalMediaItemId: this.originalMediaItemId,
      libraryId: this.libraryId,
      title: this.title,
      authorName: this.authorName,
      asin: this.asin,
      isbn: this.isbn,
      podcastTitle: this.podcastTitle,
      duration: this.duration,
      currentTime: this.currentTime,
      progress: this.duration ? Math.min(1, this.currentTime / this.duration) : 0,
      isFinished: !!this.isFinished,
      startedAt: this.startedAt?.valueOf() || null,
      finishedAt: this.finishedAt?.valueOf() || null,
      deletedAt: this.createdAt?.valueOf() || null
    }
  }
}

module.exports = DeletedMediaProgress
