const AudioFile = require('../files/AudioFile')

class PodcastEpisode {
  constructor(episode) {
    this.id = null
    this.podcastId = null
    this.episodeNumber = null

    this.audioFile = null
    this.addedAt = null
    this.updatedAt = null

    if (episode) {
      this.construct(episode)
    }
  }

  construct(episode) {
    this.id = episode.id
    this.podcastId = episode.podcastId
    this.episodeNumber = episode.episodeNumber
    this.audioFile = new AudioFile(episode.audioFile)
    this.addedAt = episode.addedAt
    this.updatedAt = episode.updatedAt
  }

  toJSON() {
    return {
      id: this.id,
      podcastId: this.podcastId,
      episodeNumber: this.episodeNumber,
      audioFile: this.audioFile.toJSON(),
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }
}
module.exports = PodcastEpisode