const FeedMeta = require('./FeedMeta')
const FeedEpisode = require('./FeedEpisode')

class Feed {
  constructor(feed) {
    this.id = null
    this.slug = null
    this.userId = null
    this.entityType = null
    this.entityId = null
    this.entityUpdatedAt = null

    this.coverPath = null
    this.serverAddress = null
    this.feedUrl = null

    this.meta = null
    this.episodes = null

    this.createdAt = null
    this.updatedAt = null

    if (feed) {
      this.construct(feed)
    }
  }

  construct(feed) {
    this.id = feed.id
    this.slug = feed.slug
    this.userId = feed.userId
    this.entityType = feed.entityType
    this.entityId = feed.entityId
    this.entityUpdatedAt = feed.entityUpdatedAt
    this.coverPath = feed.coverPath
    this.serverAddress = feed.serverAddress
    this.feedUrl = feed.feedUrl
    this.meta = new FeedMeta(feed.meta)
    this.episodes = feed.episodes.map((ep) => new FeedEpisode(ep))
    this.createdAt = feed.createdAt
    this.updatedAt = feed.updatedAt
  }

  toJSON() {
    return {
      id: this.id,
      slug: this.slug,
      userId: this.userId,
      entityType: this.entityType,
      entityId: this.entityId,
      coverPath: this.coverPath,
      serverAddress: this.serverAddress,
      feedUrl: this.feedUrl,
      meta: this.meta.toJSON(),
      episodes: this.episodes.map((ep) => ep.toJSON()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  toJSONMinified() {
    return {
      id: this.id,
      entityType: this.entityType,
      entityId: this.entityId,
      feedUrl: this.feedUrl,
      meta: this.meta.toJSONMinified()
    }
  }

  getEpisodePath(id) {
    var episode = this.episodes.find((ep) => ep.id === id)
    if (!episode) return null
    return episode.fullPath
  }
}
module.exports = Feed
