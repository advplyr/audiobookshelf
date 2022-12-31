const FeedMeta = require('./FeedMeta')
const FeedEpisode = require('./FeedEpisode')
const RSS = require('../libs/rss')

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

    // Cached xml
    this.xml = null

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

  toJSONMinified() {
    return {
      id: this.id,
      entityType: this.entityType,
      entityId: this.entityId,
      feedUrl: this.feedUrl
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
    this.entityType = 'libraryItem'
    this.entityId = libraryItem.id
    this.entityUpdatedAt = libraryItem.updatedAt
    this.coverPath = media.coverPath || null
    this.serverAddress = serverAddress
    this.feedUrl = feedUrl

    this.meta = new FeedMeta()
    this.meta.title = mediaMetadata.title
    this.meta.description = mediaMetadata.description
    this.meta.author = author
    this.meta.imageUrl = media.coverPath ? `${serverAddress}/feed/${slug}/cover` : `${serverAddress}/Logo.png`
    this.meta.feedUrl = feedUrl
    this.meta.link = `${serverAddress}/item/${libraryItem.id}`
    this.meta.explicit = !!mediaMetadata.explicit

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

  updateFromItem(libraryItem) {
    const media = libraryItem.media
    const mediaMetadata = media.metadata
    const isPodcast = libraryItem.mediaType === 'podcast'
    const author = isPodcast ? mediaMetadata.author : mediaMetadata.authorName

    this.entityUpdatedAt = libraryItem.updatedAt
    this.coverPath = media.coverPath || null

    this.meta.title = mediaMetadata.title
    this.meta.description = mediaMetadata.description
    this.meta.author = author
    this.meta.imageUrl = media.coverPath ? `${this.serverAddress}/feed/${this.slug}/cover` : `${this.serverAddress}/Logo.png`
    this.meta.explicit = !!mediaMetadata.explicit

    this.episodes = []
    if (isPodcast) { // PODCAST EPISODES
      media.episodes.forEach((episode) => {
        var feedEpisode = new FeedEpisode()
        feedEpisode.setFromPodcastEpisode(libraryItem, this.serverAddress, this.slug, episode, this.meta)
        this.episodes.push(feedEpisode)
      })
    } else { // AUDIOBOOK EPISODES
      media.tracks.forEach((audioTrack) => {
        var feedEpisode = new FeedEpisode()
        feedEpisode.setFromAudiobookTrack(libraryItem, this.serverAddress, this.slug, audioTrack, this.meta)
        this.episodes.push(feedEpisode)
      })
    }

    this.updatedAt = Date.now()
    this.xml = null
  }

  setFromCollection(userId, slug, collectionExpanded, serverAddress) {
    const feedUrl = `${serverAddress}/feed/${slug}`

    const itemsWithTracks = collectionExpanded.books.filter(libraryItem => libraryItem.media.tracks.length)
    const firstItemWithCover = itemsWithTracks.find(item => item.media.coverPath)

    this.id = slug
    this.slug = slug
    this.userId = userId
    this.entityType = 'collection'
    this.entityId = collectionExpanded.id
    this.entityUpdatedAt = collectionExpanded.lastUpdate // This will be set to the most recently updated library item
    this.coverPath = firstItemWithCover?.coverPath || null
    this.serverAddress = serverAddress
    this.feedUrl = feedUrl

    this.meta = new FeedMeta()
    this.meta.title = collectionExpanded.name
    this.meta.description = collectionExpanded.description || ''
    this.meta.author = this.getAuthorsStringFromLibraryItems(itemsWithTracks)
    this.meta.imageUrl = this.coverPath ? `${serverAddress}/feed/${slug}/cover` : `${serverAddress}/Logo.png`
    this.meta.feedUrl = feedUrl
    this.meta.link = `${serverAddress}/collection/${collectionExpanded.id}`
    this.meta.explicit = !!itemsWithTracks.some(li => li.media.metadata.explicit) // explicit if any item is explicit

    this.episodes = []

    itemsWithTracks.forEach((item, index) => {
      if (item.updatedAt > this.entityUpdatedAt) this.entityUpdatedAt = item.updatedAt

      item.media.tracks.forEach((audioTrack) => {
        const feedEpisode = new FeedEpisode()
        feedEpisode.setFromAudiobookTrack(item, serverAddress, slug, audioTrack, this.meta, index)
        this.episodes.push(feedEpisode)
      })
    })

    this.createdAt = Date.now()
    this.updatedAt = Date.now()
  }

  updateFromCollection(collectionExpanded) {
    const itemsWithTracks = collectionExpanded.books.filter(libraryItem => libraryItem.media.tracks.length)
    const firstItemWithCover = itemsWithTracks.find(item => item.media.coverPath)

    this.entityUpdatedAt = collectionExpanded.lastUpdate
    this.coverPath = firstItemWithCover?.coverPath || null

    this.meta.title = collectionExpanded.name
    this.meta.description = collectionExpanded.description || ''
    this.meta.author = this.getAuthorsStringFromLibraryItems(itemsWithTracks)
    this.meta.imageUrl = this.coverPath ? `${this.serverAddress}/feed/${this.slug}/cover` : `${this.serverAddress}/Logo.png`
    this.meta.explicit = !!itemsWithTracks.some(li => li.media.metadata.explicit) // explicit if any item is explicit

    this.episodes = []

    itemsWithTracks.forEach((item, index) => {
      if (item.updatedAt > this.entityUpdatedAt) this.entityUpdatedAt = item.updatedAt

      item.media.tracks.forEach((audioTrack) => {
        const feedEpisode = new FeedEpisode()
        feedEpisode.setFromAudiobookTrack(item, this.serverAddress, this.slug, audioTrack, this.meta, index)
        this.episodes.push(feedEpisode)
      })
    })

    this.updatedAt = Date.now()
    this.xml = null
  }

  buildXml() {
    if (this.xml) return this.xml

    var rssfeed = new RSS(this.meta.getRSSData())
    this.episodes.forEach((ep) => {
      rssfeed.item(ep.getRSSData())
    })
    this.xml = rssfeed.xml()
    return this.xml
  }

  getAuthorsStringFromLibraryItems(libraryItems) {
    let itemAuthors = []
    libraryItems.forEach((item) => itemAuthors.push(...item.media.metadata.authors.map(au => au.name)))
    itemAuthors = [...new Set(itemAuthors)] // Filter out dupes
    let author = itemAuthors.slice(0, 3).join(', ')
    if (itemAuthors.length > 3) {
      author += ' & more'
    }
    return author
  }
}
module.exports = Feed