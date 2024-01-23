const Path = require('path')
const uuidv4 = require("uuid").v4
const FeedMeta = require('./FeedMeta')
const FeedEpisode = require('./FeedEpisode')
const RSS = require('../libs/rss')
const { createNewSortInstance } = require('../libs/fastSort')
const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

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
    this.entityUpdatedAt = feed.entityUpdatedAt
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
      feedUrl: this.feedUrl,
      meta: this.meta.toJSONMinified(),
    }
  }

  getEpisodePath(id) {
    var episode = this.episodes.find(ep => ep.id === id)
    if (!episode) return null
    return episode.fullPath
  }

  /**
   * If chapters for an audiobook match the audio tracks then use chapter titles instead of audio file names
   * 
   * @param {import('../objects/LibraryItem')} libraryItem 
   * @returns {boolean}
   */
  checkUseChapterTitlesForEpisodes(libraryItem) {
    const tracks = libraryItem.media.tracks
    const chapters = libraryItem.media.chapters
    if (tracks.length !== chapters.length) return false
    for (let i = 0; i < tracks.length; i++) {
      if (Math.abs(chapters[i].start - tracks[i].startOffset) >= 1) {
        return false
      }
    }
    return true
  }

  setFromItem(userId, slug, libraryItem, serverAddress, preventIndexing = true, ownerName = null, ownerEmail = null) {
    const media = libraryItem.media
    const mediaMetadata = media.metadata
    const isPodcast = libraryItem.mediaType === 'podcast'

    const feedUrl = `${serverAddress}/feed/${slug}`
    const author = isPodcast ? mediaMetadata.author : mediaMetadata.authorName

    this.id = uuidv4()
    this.slug = slug
    this.userId = userId
    this.entityType = 'libraryItem'
    this.entityId = libraryItem.id
    this.entityUpdatedAt = libraryItem.updatedAt
    this.coverPath = media.coverPath || null
    this.serverAddress = serverAddress
    this.feedUrl = feedUrl

    const coverFileExtension = this.coverPath ? Path.extname(media.coverPath) : null

    this.meta = new FeedMeta()
    this.meta.title = mediaMetadata.title
    this.meta.description = mediaMetadata.description
    this.meta.author = author
    this.meta.imageUrl = media.coverPath ? `${serverAddress}/feed/${slug}/cover${coverFileExtension}` : `${serverAddress}/Logo.png`
    this.meta.feedUrl = feedUrl
    this.meta.link = `${serverAddress}/item/${libraryItem.id}`
    this.meta.explicit = !!mediaMetadata.explicit
    this.meta.type = mediaMetadata.type
    this.meta.language = mediaMetadata.language
    this.meta.preventIndexing = preventIndexing
    this.meta.ownerName = ownerName
    this.meta.ownerEmail = ownerEmail

    this.episodes = []
    if (isPodcast) { // PODCAST EPISODES
      media.episodes.forEach((episode) => {
        if (episode.updatedAt > this.entityUpdatedAt) this.entityUpdatedAt = episode.updatedAt

        const feedEpisode = new FeedEpisode()
        feedEpisode.setFromPodcastEpisode(libraryItem, serverAddress, slug, episode, this.meta)
        this.episodes.push(feedEpisode)
      })
    } else { // AUDIOBOOK EPISODES
      const useChapterTitles = this.checkUseChapterTitlesForEpisodes(libraryItem)
      media.tracks.forEach((audioTrack) => {
        const feedEpisode = new FeedEpisode()
        feedEpisode.setFromAudiobookTrack(libraryItem, serverAddress, slug, audioTrack, this.meta, useChapterTitles)
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

    const coverFileExtension = this.coverPath ? Path.extname(media.coverPath) : null

    this.meta.title = mediaMetadata.title
    this.meta.description = mediaMetadata.description
    this.meta.author = author
    this.meta.imageUrl = media.coverPath ? `${this.serverAddress}/feed/${this.slug}/cover${coverFileExtension}` : `${this.serverAddress}/Logo.png`
    this.meta.explicit = !!mediaMetadata.explicit
    this.meta.type = mediaMetadata.type
    this.meta.language = mediaMetadata.language

    this.episodes = []
    if (isPodcast) { // PODCAST EPISODES
      media.episodes.forEach((episode) => {
        if (episode.updatedAt > this.entityUpdatedAt) this.entityUpdatedAt = episode.updatedAt

        const feedEpisode = new FeedEpisode()
        feedEpisode.setFromPodcastEpisode(libraryItem, this.serverAddress, this.slug, episode, this.meta)
        this.episodes.push(feedEpisode)
      })
    } else { // AUDIOBOOK EPISODES
      const useChapterTitles = this.checkUseChapterTitlesForEpisodes(libraryItem)
      media.tracks.forEach((audioTrack) => {
        const feedEpisode = new FeedEpisode()
        feedEpisode.setFromAudiobookTrack(libraryItem, this.serverAddress, this.slug, audioTrack, this.meta, useChapterTitles)
        this.episodes.push(feedEpisode)
      })
    }

    this.updatedAt = Date.now()
    this.xml = null
  }

  setFromCollection(userId, slug, collectionExpanded, serverAddress, preventIndexing = true, ownerName = null, ownerEmail = null) {
    const feedUrl = `${serverAddress}/feed/${slug}`

    const itemsWithTracks = collectionExpanded.books.filter(libraryItem => libraryItem.media.tracks.length)
    const firstItemWithCover = itemsWithTracks.find(item => item.media.coverPath)

    this.id = uuidv4()
    this.slug = slug
    this.userId = userId
    this.entityType = 'collection'
    this.entityId = collectionExpanded.id
    this.entityUpdatedAt = collectionExpanded.lastUpdate // This will be set to the most recently updated library item
    this.coverPath = firstItemWithCover?.coverPath || null
    this.serverAddress = serverAddress
    this.feedUrl = feedUrl

    const coverFileExtension = this.coverPath ? Path.extname(media.coverPath) : null

    this.meta = new FeedMeta()
    this.meta.title = collectionExpanded.name
    this.meta.description = collectionExpanded.description || ''
    this.meta.author = this.getAuthorsStringFromLibraryItems(itemsWithTracks)
    this.meta.imageUrl = this.coverPath ? `${serverAddress}/feed/${slug}/cover${coverFileExtension}` : `${serverAddress}/Logo.png`
    this.meta.feedUrl = feedUrl
    this.meta.link = `${serverAddress}/collection/${collectionExpanded.id}`
    this.meta.explicit = !!itemsWithTracks.some(li => li.media.metadata.explicit) // explicit if any item is explicit
    this.meta.preventIndexing = preventIndexing
    this.meta.ownerName = ownerName
    this.meta.ownerEmail = ownerEmail

    this.episodes = []

    itemsWithTracks.forEach((item, index) => {
      if (item.updatedAt > this.entityUpdatedAt) this.entityUpdatedAt = item.updatedAt

      const useChapterTitles = this.checkUseChapterTitlesForEpisodes(item)
      item.media.tracks.forEach((audioTrack) => {
        const feedEpisode = new FeedEpisode()
        feedEpisode.setFromAudiobookTrack(item, serverAddress, slug, audioTrack, this.meta, useChapterTitles, index)
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

    const coverFileExtension = this.coverPath ? Path.extname(media.coverPath) : null

    this.meta.title = collectionExpanded.name
    this.meta.description = collectionExpanded.description || ''
    this.meta.author = this.getAuthorsStringFromLibraryItems(itemsWithTracks)
    this.meta.imageUrl = this.coverPath ? `${this.serverAddress}/feed/${this.slug}/cover${coverFileExtension}` : `${this.serverAddress}/Logo.png`
    this.meta.explicit = !!itemsWithTracks.some(li => li.media.metadata.explicit) // explicit if any item is explicit

    this.episodes = []

    itemsWithTracks.forEach((item, index) => {
      if (item.updatedAt > this.entityUpdatedAt) this.entityUpdatedAt = item.updatedAt

      const useChapterTitles = this.checkUseChapterTitlesForEpisodes(item)
      item.media.tracks.forEach((audioTrack) => {
        const feedEpisode = new FeedEpisode()
        feedEpisode.setFromAudiobookTrack(item, this.serverAddress, this.slug, audioTrack, this.meta, useChapterTitles, index)
        this.episodes.push(feedEpisode)
      })
    })

    this.updatedAt = Date.now()
    this.xml = null
  }

  setFromSeries(userId, slug, seriesExpanded, serverAddress, preventIndexing = true, ownerName = null, ownerEmail = null) {
    const feedUrl = `${serverAddress}/feed/${slug}`

    let itemsWithTracks = seriesExpanded.books.filter(libraryItem => libraryItem.media.tracks.length)
    // Sort series items by series sequence
    itemsWithTracks = naturalSort(itemsWithTracks).asc(li => li.media.metadata.getSeriesSequence(seriesExpanded.id))

    const libraryId = itemsWithTracks[0].libraryId
    const firstItemWithCover = itemsWithTracks.find(li => li.media.coverPath)

    this.id = uuidv4()
    this.slug = slug
    this.userId = userId
    this.entityType = 'series'
    this.entityId = seriesExpanded.id
    this.entityUpdatedAt = seriesExpanded.updatedAt // This will be set to the most recently updated library item
    this.coverPath = firstItemWithCover?.coverPath || null
    this.serverAddress = serverAddress
    this.feedUrl = feedUrl

    const coverFileExtension = this.coverPath ? Path.extname(media.coverPath) : null

    this.meta = new FeedMeta()
    this.meta.title = seriesExpanded.name
    this.meta.description = seriesExpanded.description || ''
    this.meta.author = this.getAuthorsStringFromLibraryItems(itemsWithTracks)
    this.meta.imageUrl = this.coverPath ? `${serverAddress}/feed/${slug}/cover${coverFileExtension}` : `${serverAddress}/Logo.png`
    this.meta.feedUrl = feedUrl
    this.meta.link = `${serverAddress}/library/${libraryId}/series/${seriesExpanded.id}`
    this.meta.explicit = !!itemsWithTracks.some(li => li.media.metadata.explicit) // explicit if any item is explicit
    this.meta.preventIndexing = preventIndexing
    this.meta.ownerName = ownerName
    this.meta.ownerEmail = ownerEmail

    this.episodes = []

    itemsWithTracks.forEach((item, index) => {
      if (item.updatedAt > this.entityUpdatedAt) this.entityUpdatedAt = item.updatedAt

      const useChapterTitles = this.checkUseChapterTitlesForEpisodes(item)
      item.media.tracks.forEach((audioTrack) => {
        const feedEpisode = new FeedEpisode()
        feedEpisode.setFromAudiobookTrack(item, serverAddress, slug, audioTrack, this.meta, useChapterTitles, index)
        this.episodes.push(feedEpisode)
      })
    })

    this.createdAt = Date.now()
    this.updatedAt = Date.now()
  }

  updateFromSeries(seriesExpanded) {
    let itemsWithTracks = seriesExpanded.books.filter(libraryItem => libraryItem.media.tracks.length)
    // Sort series items by series sequence
    itemsWithTracks = naturalSort(itemsWithTracks).asc(li => li.media.metadata.getSeriesSequence(seriesExpanded.id))

    const firstItemWithCover = itemsWithTracks.find(item => item.media.coverPath)

    this.entityUpdatedAt = seriesExpanded.updatedAt
    this.coverPath = firstItemWithCover?.coverPath || null

    const coverFileExtension = this.coverPath ? Path.extname(media.coverPath) : null

    this.meta.title = seriesExpanded.name
    this.meta.description = seriesExpanded.description || ''
    this.meta.author = this.getAuthorsStringFromLibraryItems(itemsWithTracks)
    this.meta.imageUrl = this.coverPath ? `${this.serverAddress}/feed/${this.slug}/cover${coverFileExtension}` : `${this.serverAddress}/Logo.png`
    this.meta.explicit = !!itemsWithTracks.some(li => li.media.metadata.explicit) // explicit if any item is explicit

    this.episodes = []

    itemsWithTracks.forEach((item, index) => {
      if (item.updatedAt > this.entityUpdatedAt) this.entityUpdatedAt = item.updatedAt

      const useChapterTitles = this.checkUseChapterTitlesForEpisodes(item)
      item.media.tracks.forEach((audioTrack) => {
        const feedEpisode = new FeedEpisode()
        feedEpisode.setFromAudiobookTrack(item, this.serverAddress, this.slug, audioTrack, this.meta, useChapterTitles, index)
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
