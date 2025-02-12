const { Request, Response } = require('express')
const Path = require('path')

const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const fs = require('../libs/fsExtra')

class RssFeedManager {
  constructor() {}

  /**
   * Remove invalid feeds (invalid if the entity does not exist)
   */
  async init() {
    const feeds = await Database.feedModel.findAll({
      attributes: ['id', 'entityId', 'entityType', 'title'],
      include: [
        {
          model: Database.libraryItemModel,
          attributes: ['id']
        },
        {
          model: Database.collectionModel,
          attributes: ['id']
        },
        {
          model: Database.seriesModel,
          attributes: ['id']
        }
      ]
    })

    const feedIdsToRemove = []
    for (const feed of feeds) {
      if (!feed.entity) {
        Logger.error(`[RssFeedManager] Removing feed "${feed.title}". Entity not found`)
        feedIdsToRemove.push(feed.id)
      }
    }

    if (feedIdsToRemove.length) {
      Logger.info(`[RssFeedManager] Removing ${feedIdsToRemove.length} invalid feeds`)
      await Database.feedModel.destroy({
        where: {
          id: feedIdsToRemove
        }
      })
    }
  }

  /**
   * Find open feed for an entity (e.g. collection id, playlist id, library item id)
   * @param {string} entityId
   * @returns {Promise<import('../models/Feed')>}
   */
  findFeedForEntityId(entityId) {
    return Database.feedModel.findOne({
      where: {
        entityId
      }
    })
  }

  /**
   *
   * @param {string} slug
   * @returns {Promise<boolean>}
   */
  checkExistsBySlug(slug) {
    return Database.feedModel
      .count({
        where: {
          slug
        }
      })
      .then((count) => count > 0)
  }

  /**
   * Feed requires update if the entity (or child entities) has been updated since the feed was last updated
   *
   * @param {import('../models/Feed')} feed
   * @returns {Promise<boolean>}
   */
  async checkFeedRequiresUpdate(feed) {
    if (feed.entityType === 'libraryItem') {
      feed.entity = await feed.getEntity({
        attributes: ['id', 'updatedAt', 'mediaId', 'mediaType']
      })

      let newEntityUpdatedAt = feed.entity.updatedAt

      if (feed.entity.mediaType === 'podcast') {
        const mostRecentPodcastEpisode = await Database.podcastEpisodeModel.findOne({
          where: {
            podcastId: feed.entity.mediaId
          },
          attributes: ['id', 'updatedAt'],
          order: [['updatedAt', 'DESC']]
        })

        if (mostRecentPodcastEpisode && mostRecentPodcastEpisode.updatedAt > newEntityUpdatedAt) {
          newEntityUpdatedAt = mostRecentPodcastEpisode.updatedAt
        }
      } else {
        const book = await Database.bookModel.findOne({
          where: {
            id: feed.entity.mediaId
          },
          attributes: ['id', 'updatedAt']
        })
        if (book && book.updatedAt > newEntityUpdatedAt) {
          newEntityUpdatedAt = book.updatedAt
        }
      }

      return newEntityUpdatedAt > feed.entityUpdatedAt
    } else if (feed.entityType === 'collection' || feed.entityType === 'series') {
      feed.entity = await feed.getEntity({
        attributes: ['id', 'updatedAt'],
        include: {
          model: Database.bookModel,
          attributes: ['id', 'audioFiles', 'updatedAt'],
          through: {
            attributes: []
          },
          include: {
            model: Database.libraryItemModel,
            attributes: ['id', 'updatedAt']
          }
        }
      })

      const totalBookTracks = feed.entity.books.reduce((total, book) => total + book.includedAudioFiles.length, 0)
      if (feed.feedEpisodes.length !== totalBookTracks) {
        return true
      }

      let newEntityUpdatedAt = feed.entity.updatedAt

      const mostRecentItemUpdatedAt = feed.entity.books.reduce((mostRecent, book) => {
        let updatedAt = book.libraryItem.updatedAt > book.updatedAt ? book.libraryItem.updatedAt : book.updatedAt
        return updatedAt > mostRecent ? updatedAt : mostRecent
      }, 0)

      if (mostRecentItemUpdatedAt > newEntityUpdatedAt) {
        newEntityUpdatedAt = mostRecentItemUpdatedAt
      }

      return newEntityUpdatedAt > feed.entityUpdatedAt
    } else {
      throw new Error('Invalid feed entity type')
    }
  }

  /**
   * GET: /feed/:slug
   *
   * @param {Request} req
   * @param {Response} res
   */
  async getFeed(req, res) {
    let feed = await Database.feedModel.findOne({
      where: {
        slug: req.params.slug
      },
      include: {
        model: Database.feedEpisodeModel
      }
    })
    if (!feed) {
      Logger.warn(`[RssFeedManager] Feed not found ${req.params.slug}`)
      res.sendStatus(404)
      return
    }

    const feedRequiresUpdate = await this.checkFeedRequiresUpdate(feed)
    if (feedRequiresUpdate) {
      Logger.info(`[RssFeedManager] Feed "${feed.title}" requires update - updating feed`)
      feed = await feed.updateFeedForEntity()
    }

    const xml = feed.buildXml(req.originalHostPrefix)
    res.set('Content-Type', 'text/xml')
    res.send(xml)
  }

  /**
   * GET: /feed/:slug/item/:episodeId/*
   *
   * @param {Request} req
   * @param {Response} res
   */
  async getFeedItem(req, res) {
    const feed = await Database.feedModel.findOne({
      where: {
        slug: req.params.slug
      },
      attributes: ['id', 'slug'],
      include: {
        model: Database.feedEpisodeModel,
        attributes: ['id', 'filePath']
      }
    })

    if (!feed) {
      Logger.debug(`[RssFeedManager] Feed not found ${req.params.slug}`)
      res.sendStatus(404)
      return
    }
    const episodePath = feed.getEpisodePath(req.params.episodeId)
    if (!episodePath) {
      Logger.error(`[RssFeedManager] Feed episode not found ${req.params.episodeId}`)
      res.sendStatus(404)
      return
    }
    res.sendFile(episodePath)
  }

  /**
   * GET: /feed/:slug/cover*
   *
   * @param {Request} req
   * @param {Response} res
   */
  async getFeedCover(req, res) {
    const feed = await Database.feedModel.findOne({
      where: {
        slug: req.params.slug
      },
      attributes: ['coverPath']
    })
    if (!feed) {
      Logger.debug(`[RssFeedManager] Feed not found ${req.params.slug}`)
      res.sendStatus(404)
      return
    }

    if (!feed.coverPath) {
      res.sendStatus(404)
      return
    }

    const extname = Path.extname(feed.coverPath).toLowerCase().slice(1)
    res.type(`image/${extname}`)
    const readStream = fs.createReadStream(feed.coverPath)

    readStream.on('error', (error) => {
      Logger.error(`[RssFeedManager] Error streaming cover image: ${error.message}`)
      // Only send error if headers haven't been sent yet
      if (!res.headersSent) {
        res.sendStatus(404)
      }
    })

    readStream.pipe(res)
  }

  /**
   *
   * @param {*} options
   * @returns {import('../models/Feed').FeedOptions}
   */
  getFeedOptionsFromReqOptions(options) {
    const metadataDetails = options.metadataDetails || {}

    if (metadataDetails.preventIndexing !== false) {
      metadataDetails.preventIndexing = true
    }

    return {
      preventIndexing: metadataDetails.preventIndexing,
      ownerName: metadataDetails.ownerName && typeof metadataDetails.ownerName === 'string' ? metadataDetails.ownerName : null,
      ownerEmail: metadataDetails.ownerEmail && typeof metadataDetails.ownerEmail === 'string' ? metadataDetails.ownerEmail : null
    }
  }

  /**
   *
   * @param {string} userId
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {*} options
   * @returns {Promise<import('../models/Feed').FeedExpanded>}
   */
  async openFeedForItem(userId, libraryItem, options) {
    const serverAddress = options.serverAddress
    const slug = options.slug
    const feedOptions = this.getFeedOptionsFromReqOptions(options)

    Logger.info(`[RssFeedManager] Creating RSS feed for item ${libraryItem.id} "${libraryItem.media.title}"`)
    const feedExpanded = await Database.feedModel.createFeedForLibraryItem(userId, libraryItem, slug, serverAddress, feedOptions)
    if (feedExpanded) {
      Logger.info(`[RssFeedManager] Opened RSS feed "${feedExpanded.feedURL}"`)
      SocketAuthority.emitter('rss_feed_open', feedExpanded.toOldJSONMinified())
    }
    return feedExpanded
  }

  /**
   *
   * @param {string} userId
   * @param {import('../models/Collection')} collectionExpanded
   * @param {*} options
   * @returns {Promise<import('../models/Feed').FeedExpanded>}
   */
  async openFeedForCollection(userId, collectionExpanded, options) {
    const serverAddress = options.serverAddress
    const slug = options.slug
    const feedOptions = this.getFeedOptionsFromReqOptions(options)

    Logger.info(`[RssFeedManager] Creating RSS feed for collection "${collectionExpanded.name}"`)
    const feedExpanded = await Database.feedModel.createFeedForCollection(userId, collectionExpanded, slug, serverAddress, feedOptions)
    if (feedExpanded) {
      Logger.info(`[RssFeedManager] Opened RSS feed "${feedExpanded.feedURL}"`)
      SocketAuthority.emitter('rss_feed_open', feedExpanded.toOldJSONMinified())
    }
    return feedExpanded
  }

  /**
   *
   * @param {string} userId
   * @param {import('../models/Series')} seriesExpanded
   * @param {*} options
   * @returns {Promise<import('../models/Feed').FeedExpanded>}
   */
  async openFeedForSeries(userId, seriesExpanded, options) {
    const serverAddress = options.serverAddress
    const slug = options.slug
    const feedOptions = this.getFeedOptionsFromReqOptions(options)

    Logger.info(`[RssFeedManager] Creating RSS feed for series "${seriesExpanded.name}"`)
    const feedExpanded = await Database.feedModel.createFeedForSeries(userId, seriesExpanded, slug, serverAddress, feedOptions)
    if (feedExpanded) {
      Logger.info(`[RssFeedManager] Opened RSS feed "${feedExpanded.feedURL}"`)
      SocketAuthority.emitter('rss_feed_open', feedExpanded.toOldJSONMinified())
    }
    return feedExpanded
  }

  /**
   * Close Feed and emit Socket event
   *
   * @param {import('../models/Feed')} feed
   * @returns {Promise<boolean>} - true if feed was closed
   */
  async handleCloseFeed(feed) {
    if (!feed) return false
    const wasRemoved = await Database.feedModel.removeById(feed.id)
    SocketAuthority.emitter('rss_feed_closed', feed.toOldJSONMinified())
    Logger.info(`[RssFeedManager] Closed RSS feed "${feed.feedURL}"`)
    return wasRemoved
  }

  /**
   *
   * @param {string} entityId
   * @returns {Promise<boolean>} - true if feed was closed
   */
  async closeFeedForEntityId(entityId) {
    const feed = await Database.feedModel.findOne({
      where: {
        entityId
      }
    })
    if (!feed) {
      return false
    }
    return this.handleCloseFeed(feed)
  }

  /**
   *
   * @param {string[]} entityIds
   */
  async closeFeedsForEntityIds(entityIds) {
    const feeds = await Database.feedModel.findAll({
      where: {
        entityId: entityIds
      }
    })
    for (const feed of feeds) {
      await this.handleCloseFeed(feed)
    }
  }

  /**
   *
   * @returns {Promise<import('../models/Feed').FeedExpanded[]>}
   */
  getFeeds() {
    return Database.feedModel.findAll({
      include: {
        model: Database.feedEpisodeModel
      }
    })
  }
}
module.exports = new RssFeedManager()
