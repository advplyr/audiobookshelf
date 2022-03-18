const AudioFile = require('../files/AudioFile')
const AudioTrack = require('../files/AudioTrack')

class PodcastEpisode {
  constructor(episode) {
    this.id = null
    this.index = null
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
    this.index = episode.index
    this.podcastId = episode.podcastId
    this.episodeNumber = episode.episodeNumber
    this.audioFile = new AudioFile(episode.audioFile)
    this.addedAt = episode.addedAt
    this.updatedAt = episode.updatedAt
  }

  toJSON() {
    return {
      id: this.id,
      index: this.index,
      podcastId: this.podcastId,
      episodeNumber: this.episodeNumber,
      audioFile: this.audioFile.toJSON(),
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }

  get isPlaybackMediaEntity() { return true }
  get tracks() {
    return [this.audioFile]
  }

  // Only checks container format
  checkCanDirectPlay(payload) {
    var supportedMimeTypes = payload.supportedMimeTypes || []
    return supportedMimeTypes.includes(this.audioFile.mimeType)
  }

  getDirectPlayTracklist(libraryItemId) {
    var audioTrack = new AudioTrack()
    audioTrack.setData(libraryItemId, this.audioFile, 0)
    return [audioTrack]
  }
}
module.exports = PodcastEpisode