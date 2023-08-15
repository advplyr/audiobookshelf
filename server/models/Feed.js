const { DataTypes, Model } = require('sequelize')
const oldFeed = require('../objects/Feed')
const areEquivalent = require('../utils/areEquivalent')

class Feed extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.slug
    /** @type {string} */
    this.entityType
    /** @type {UUIDV4} */
    this.entityId
    /** @type {Date} */
    this.entityUpdatedAt
    /** @type {string} */
    this.serverAddress
    /** @type {string} */
    this.feedURL
    /** @type {string} */
    this.imageURL
    /** @type {string} */
    this.siteURL
    /** @type {string} */
    this.title
    /** @type {string} */
    this.description
    /** @type {string} */
    this.author
    /** @type {string} */
    this.podcastType
    /** @type {string} */
    this.language
    /** @type {string} */
    this.ownerName
    /** @type {string} */
    this.ownerEmail
    /** @type {boolean} */
    this.explicit
    /** @type {boolean} */
    this.preventIndexing
    /** @type {string} */
    this.coverPath
    /** @type {UUIDV4} */
    this.userId
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  static async getOldFeeds() {
    const feeds = await this.findAll({
      include: {
        model: this.sequelize.models.feedEpisode
      }
    })
    return feeds.map(f => this.getOldFeed(f))
  }

  /**
   * Get old feed from Feed and optionally Feed with FeedEpisodes
   * @param {Feed} feedExpanded
   * @returns {oldFeed}
   */
  static getOldFeed(feedExpanded) {
    const episodes = feedExpanded.feedEpisodes?.map((feedEpisode) => feedEpisode.getOldEpisode())
    return new oldFeed({
      id: feedExpanded.id,
      slug: feedExpanded.slug,
      userId: feedExpanded.userId,
      entityType: feedExpanded.entityType,
      entityId: feedExpanded.entityId,
      entityUpdatedAt: feedExpanded.entityUpdatedAt?.valueOf() || null,
      coverPath: feedExpanded.coverPath || null,
      meta: {
        title: feedExpanded.title,
        description: feedExpanded.description,
        author: feedExpanded.author,
        imageUrl: feedExpanded.imageURL,
        feedUrl: feedExpanded.feedURL,
        link: feedExpanded.siteURL,
        explicit: feedExpanded.explicit,
        type: feedExpanded.podcastType,
        language: feedExpanded.language,
        preventIndexing: feedExpanded.preventIndexing,
        ownerName: feedExpanded.ownerName,
        ownerEmail: feedExpanded.ownerEmail
      },
      serverAddress: feedExpanded.serverAddress,
      feedUrl: feedExpanded.feedURL,
      episodes: episodes || [],
      createdAt: feedExpanded.createdAt.valueOf(),
      updatedAt: feedExpanded.updatedAt.valueOf()
    })
  }

  static removeById(feedId) {
    return this.destroy({
      where: {
        id: feedId
      }
    })
  }

  /**
   * Find all library item ids that have an open feed (used in library filter)
   * @returns {Promise<Array<String>>} array of library item ids
   */
  static async findAllLibraryItemIds() {
    const feeds = await this.findAll({
      attributes: ['entityId'],
      where: {
        entityType: 'libraryItem'
      }
    })
    return feeds.map(f => f.entityId).filter(f => f) || []
  }

  /**
   * Find feed where and return oldFeed
   * @param {object} where sequelize where object
   * @returns {Promise<objects.Feed>} oldFeed
   */
  static async findOneOld(where) {
    if (!where) return null
    const feedExpanded = await this.findOne({
      where,
      include: {
        model: this.sequelize.models.feedEpisode
      }
    })
    if (!feedExpanded) return null
    return this.getOldFeed(feedExpanded)
  }

  /**
   * Find feed and return oldFeed
   * @param {string} id
   * @returns {Promise<objects.Feed>} oldFeed
   */
  static async findByPkOld(id) {
    if (!id) return null
    const feedExpanded = await this.findByPk(id, {
      include: {
        model: this.sequelize.models.feedEpisode
      }
    })
    if (!feedExpanded) return null
    return this.getOldFeed(feedExpanded)
  }

  static async fullCreateFromOld(oldFeed) {
    const feedObj = this.getFromOld(oldFeed)
    const newFeed = await this.create(feedObj)

    if (oldFeed.episodes?.length) {
      for (const oldFeedEpisode of oldFeed.episodes) {
        const feedEpisode = this.sequelize.models.feedEpisode.getFromOld(oldFeedEpisode)
        feedEpisode.feedId = newFeed.id
        await this.sequelize.models.feedEpisode.create(feedEpisode)
      }
    }
  }

  static async fullUpdateFromOld(oldFeed) {
    const oldFeedEpisodes = oldFeed.episodes || []
    const feedObj = this.getFromOld(oldFeed)

    const existingFeed = await this.findByPk(feedObj.id, {
      include: this.sequelize.models.feedEpisode
    })
    if (!existingFeed) return false

    let hasUpdates = false
    for (const feedEpisode of existingFeed.feedEpisodes) {
      const oldFeedEpisode = oldFeedEpisodes.find(ep => ep.id === feedEpisode.id)
      // Episode removed
      if (!oldFeedEpisode) {
        feedEpisode.destroy()
      } else {
        let episodeHasUpdates = false
        const oldFeedEpisodeCleaned = this.sequelize.models.feedEpisode.getFromOld(oldFeedEpisode)
        for (const key in oldFeedEpisodeCleaned) {
          if (!areEquivalent(oldFeedEpisodeCleaned[key], feedEpisode[key])) {
            episodeHasUpdates = true
          }
        }
        if (episodeHasUpdates) {
          await feedEpisode.update(oldFeedEpisodeCleaned)
          hasUpdates = true
        }
      }
    }

    let feedHasUpdates = false
    for (const key in feedObj) {
      let existingValue = existingFeed[key]
      if (existingValue instanceof Date) existingValue = existingValue.valueOf()

      if (!areEquivalent(existingValue, feedObj[key])) {
        feedHasUpdates = true
      }
    }

    if (feedHasUpdates) {
      await existingFeed.update(feedObj)
      hasUpdates = true
    }

    return hasUpdates
  }

  static getFromOld(oldFeed) {
    const oldFeedMeta = oldFeed.meta || {}
    return {
      id: oldFeed.id,
      slug: oldFeed.slug,
      entityType: oldFeed.entityType,
      entityId: oldFeed.entityId,
      entityUpdatedAt: oldFeed.entityUpdatedAt,
      serverAddress: oldFeed.serverAddress,
      feedURL: oldFeed.feedUrl,
      coverPath: oldFeed.coverPath || null,
      imageURL: oldFeedMeta.imageUrl,
      siteURL: oldFeedMeta.link,
      title: oldFeedMeta.title,
      description: oldFeedMeta.description,
      author: oldFeedMeta.author,
      podcastType: oldFeedMeta.type || null,
      language: oldFeedMeta.language || null,
      ownerName: oldFeedMeta.ownerName || null,
      ownerEmail: oldFeedMeta.ownerEmail || null,
      explicit: !!oldFeedMeta.explicit,
      preventIndexing: !!oldFeedMeta.preventIndexing,
      userId: oldFeed.userId
    }
  }

  getEntity(options) {
    if (!this.entityType) return Promise.resolve(null)
    const mixinMethodName = `get${this.sequelize.uppercaseFirst(this.entityType)}`
    return this[mixinMethodName](options)
  }

  /**
   * Initialize model
   * 
   * Polymorphic association: Feeds can be created from LibraryItem, Collection, Playlist or Series
   * @see https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
   * 
   * @param {import('../Database').sequelize} sequelize 
   */
  static init(sequelize) {
    super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      slug: DataTypes.STRING,
      entityType: DataTypes.STRING,
      entityId: DataTypes.UUIDV4,
      entityUpdatedAt: DataTypes.DATE,
      serverAddress: DataTypes.STRING,
      feedURL: DataTypes.STRING,
      imageURL: DataTypes.STRING,
      siteURL: DataTypes.STRING,
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      author: DataTypes.STRING,
      podcastType: DataTypes.STRING,
      language: DataTypes.STRING,
      ownerName: DataTypes.STRING,
      ownerEmail: DataTypes.STRING,
      explicit: DataTypes.BOOLEAN,
      preventIndexing: DataTypes.BOOLEAN,
      coverPath: DataTypes.STRING
    }, {
      sequelize,
      modelName: 'feed'
    })

    const { user, libraryItem, collection, series, playlist } = sequelize.models

    user.hasMany(Feed)
    Feed.belongsTo(user)

    libraryItem.hasMany(Feed, {
      foreignKey: 'entityId',
      constraints: false,
      scope: {
        entityType: 'libraryItem'
      }
    })
    Feed.belongsTo(libraryItem, { foreignKey: 'entityId', constraints: false })

    collection.hasMany(Feed, {
      foreignKey: 'entityId',
      constraints: false,
      scope: {
        entityType: 'collection'
      }
    })
    Feed.belongsTo(collection, { foreignKey: 'entityId', constraints: false })

    series.hasMany(Feed, {
      foreignKey: 'entityId',
      constraints: false,
      scope: {
        entityType: 'series'
      }
    })
    Feed.belongsTo(series, { foreignKey: 'entityId', constraints: false })

    playlist.hasMany(Feed, {
      foreignKey: 'entityId',
      constraints: false,
      scope: {
        entityType: 'playlist'
      }
    })
    Feed.belongsTo(playlist, { foreignKey: 'entityId', constraints: false })

    Feed.addHook('afterFind', findResult => {
      if (!findResult) return

      if (!Array.isArray(findResult)) findResult = [findResult]
      for (const instance of findResult) {
        if (instance.entityType === 'libraryItem' && instance.libraryItem !== undefined) {
          instance.entity = instance.libraryItem
          instance.dataValues.entity = instance.dataValues.libraryItem
        } else if (instance.entityType === 'collection' && instance.collection !== undefined) {
          instance.entity = instance.collection
          instance.dataValues.entity = instance.dataValues.collection
        } else if (instance.entityType === 'series' && instance.series !== undefined) {
          instance.entity = instance.series
          instance.dataValues.entity = instance.dataValues.series
        } else if (instance.entityType === 'playlist' && instance.playlist !== undefined) {
          instance.entity = instance.playlist
          instance.dataValues.entity = instance.dataValues.playlist
        }

        // To prevent mistakes:
        delete instance.libraryItem
        delete instance.dataValues.libraryItem
        delete instance.collection
        delete instance.dataValues.collection
        delete instance.series
        delete instance.dataValues.series
        delete instance.playlist
        delete instance.dataValues.playlist
      }
    })
  }
}

module.exports = Feed