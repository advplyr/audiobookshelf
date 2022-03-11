const PodcastEpisode = require('./PodcastEpisode')
const PodcastMetadata = require('../metadata/PodcastMetadata')

class Podcast {
  constructor(podcast) {
    this.id = null

    this.metadata = null
    this.coverPath = null
    this.tags = []
    this.episodes = []

    this.createdAt = null
    this.lastUpdate = null

    if (podcast) {
      this.construct(podcast)
    }
  }

  construct(podcast) {
    this.id = podcast.id
    this.metadata = new PodcastMetadata(podcast.metadata)
    this.coverPath = podcast.coverPath
    this.tags = [...podcast.tags]
    this.episodes = podcast.episodes.map((e) => new PodcastEpisode(e))
    this.createdAt = podcast.createdAt
    this.lastUpdate = podcast.lastUpdate
  }

  toJSON() {
    return {
      id: this.id,
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSON()),
      createdAt: this.createdAt,
      lastUpdate: this.lastUpdate
    }
  }

  toJSONMinified() {
    return {
      id: this.id,
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSON()),
      createdAt: this.createdAt,
      lastUpdate: this.lastUpdate
    }
  }

  toJSONExpanded() {
    return {
      id: this.id,
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSON()),
      createdAt: this.createdAt,
      lastUpdate: this.lastUpdate
    }
  }
}
module.exports = Podcast