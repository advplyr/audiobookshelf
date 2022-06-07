const FeedMeta = require('./FeedMeta')
const FeedEpisode = require('./FeedEpisode')
const { Podcast } = require('podcast')

class Feed {
  constructor(feed) {
    this.id = null
    this.slug = null
    this.userId = null
    this.entityType = null
    this.entityId = null

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
    this.coverPath = feed.coverPath
    this.serverAddress = feed.serverAddress
    this.feedUrl = feed.feedUrl
    this.meta = new FeedMeta(feed.meta)
    this.episodes = feed.episodes.map(ep => new FeedEpisode(ep))
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
      episodes: this.episodes.map(ep => ep.toJSON()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  getEpisodePath(id) {
    var episode = this.episodes.find(ep => ep.id === id)
    if (!episode) return null
    return episode.fullPath
  }

  setFromItem(userId, slug, libraryItem, serverAddress) {
    const media = libraryItem.media
    const mediaMetadata = media.metadata
    const isPodcast = libraryItem.mediaType === 'podcast'

    const feedUrl = `${serverAddress}/feed/${slug}`
    const author = isPodcast ? mediaMetadata.author : mediaMetadata.authorName

    this.id = slug
    this.slug = slug
    this.userId = userId
    this.entityType = 'item'
    this.entityId = libraryItem.id
    this.coverPath = media.coverPath || null
    this.serverAddress = serverAddress
    this.feedUrl = feedUrl

    this.meta = new FeedMeta()
    this.meta.title = mediaMetadata.title
    this.meta.description = mediaMetadata.description
    this.meta.author = author
    this.meta.imageUrl = media.coverPath ? `${serverAddress}/feed/${slug}/cover` : `${serverAddress}/Logo.png`
    this.meta.feedUrl = feedUrl
    this.meta.link = `${serverAddress}/items/${libraryItem.id}`

    this.episodes = []
    if (isPodcast) { // PODCAST EPISODES
      media.episodes.forEach((episode) => {
        var feedEpisode = new FeedEpisode()
        feedEpisode.setFromPodcastEpisode(libraryItem, serverAddress, slug, episode, this.meta)
        this.episodes.push(feedEpisode)
      })
    } else { // AUDIOBOOK EPISODES
      media.tracks.forEach((audioTrack) => {
        var feedEpisode = new FeedEpisode()
        feedEpisode.setFromAudiobookTrack(libraryItem, serverAddress, slug, audioTrack, this.meta)
        this.episodes.push(feedEpisode)
      })
    }

    this.createdAt = Date.now()
    this.updatedAt = Date.now()
  }

  buildXml() {
    const pod = new Podcast(this.meta.getPodcastMeta())
    this.episodes.forEach((ep) => {
      pod.addItem(ep.getPodcastEpisode())
    })
    return pod.buildXml()
  }
}
module.exports = Feed