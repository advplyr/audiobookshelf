const { getId } = require('../../utils/index')
const AudioFile = require('../files/AudioFile')
const AudioTrack = require('../files/AudioTrack')

class PodcastEpisode {
  constructor(episode) {
    this.id = null
    this.index = null

    this.episode = null
    this.episodeType = null
    this.title = null
    this.subtitle = null
    this.description = null
    this.enclosure = null
    this.pubDate = null

    this.audioFile = null
    this.publishedAt = null
    this.addedAt = null
    this.updatedAt = null

    if (episode) {
      this.construct(episode)
    }
  }

  construct(episode) {
    this.id = episode.id
    this.index = episode.index
    this.episode = episode.episode
    this.episodeType = episode.episodeType
    this.title = episode.title
    this.subtitle = episode.subtitle
    this.description = episode.description
    this.enclosure = episode.enclosure ? { ...episode.enclosure } : null
    this.pubDate = episode.pubDate
    this.audioFile = new AudioFile(episode.audioFile)
    this.publishedAt = episode.publishedAt
    this.addedAt = episode.addedAt
    this.updatedAt = episode.updatedAt
  }

  toJSON() {
    return {
      id: this.id,
      index: this.index,
      episode: this.episode,
      episodeType: this.episodeType,
      title: this.title,
      subtitle: this.subtitle,
      description: this.description,
      enclosure: this.enclosure ? { ...this.enclosure } : null,
      pubDate: this.pubDate,
      audioFile: this.audioFile.toJSON(),
      publishedAt: this.publishedAt,
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
  get bestFilename() {
    if (this.episode) return `${this.episode} - ${this.title}`
    return this.title
  }

  setData(data, index = 1) {
    this.id = getId('ep')
    this.index = index
    this.title = data.title
    this.subtitle = data.subtitle || ''
    this.pubDate = data.pubDate || ''
    this.description = data.description || ''
    this.enclosure = data.enclosure ? { ...data.enclosure } : null
    this.episode = data.episode || ''
    this.episodeType = data.episodeType || ''
    this.publishedAt = data.publishedAt || 0
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