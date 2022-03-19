const { getId } = require('../../utils/index')
const AudioFile = require('../files/AudioFile')
const AudioTrack = require('../files/AudioTrack')

class PodcastEpisode {
  constructor(episode) {
    this.id = null
    this.index = null

    this.episodeNumber = null
    this.title = null
    this.description = null
    this.enclosure = null
    this.pubDate = null

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
    this.episodeNumber = episode.episodeNumber
    this.title = episode.title
    this.description = episode.description
    this.enclosure = episode.enclosure ? { ...episode.enclosure } : null
    this.pubDate = episode.pubDate
    this.audioFile = new AudioFile(episode.audioFile)
    this.addedAt = episode.addedAt
    this.updatedAt = episode.updatedAt
  }

  toJSON() {
    return {
      id: this.id,
      index: this.index,
      episodeNumber: this.episodeNumber,
      title: this.title,
      description: this.description,
      enclosure: this.enclosure ? { ...this.enclosure } : null,
      pubDate: this.pubDate,
      audioFile: this.audioFile.toJSON(),
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }

  get isPlaybackMediaEntity() { return true }
  get tracks() {
    return [this.audioFile]
  }
  get duration() {
    return this.audioFile.duration
  }
  get size() { return this.audioFile.metadata.size }

  setData(data, index = 1) {
    this.id = getId('ep')
    this.index = index
    this.title = data.title
    this.pubDate = data.pubDate || ''
    this.description = data.description || ''
    this.enclosure = data.enclosure ? { ...data.enclosure } : null
    this.episodeNumber = data.episodeNumber || ''
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
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