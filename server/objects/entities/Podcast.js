const PodcastEpisode = require('./PodcastEpisode')
const PodcastMetadata = require('../metadata/PodcastMetadata')

class Podcast {
  constructor(podcast) {
    this.id = null

    this.metadata = null
    this.cover = null
    this.coverFullPath = null
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
    this.cover = podcast.cover
    this.coverFullPath = podcast.coverFullPath
    this.episodes = podcast.episodes.map((e) => new PodcastEpisode(e))
    this.createdAt = podcast.createdAt
    this.lastUpdate = podcast.lastUpdate
  }

  toJSON() {
    return {
      id: this.id,
      metadata: this.metadata.toJSON(),
      cover: this.cover,
      coverFullPath: this.coverFullPath,
      episodes: this.episodes.map(e => e.toJSON()),
      createdAt: this.createdAt,
      lastUpdate: this.lastUpdate
    }
  }
}
module.exports = Podcast