const Path = require('path')
const { getId } = require('../../utils/index')
const AudioFile = require('../files/AudioFile')
const AudioTrack = require('../files/AudioTrack')

class PodcastEpisode {
  constructor(episode) {
    this.libraryItemId = null
    this.id = null
    this.index = null

    this.season = null
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
    this.libraryItemId = episode.libraryItemId
    this.id = episode.id
    this.index = episode.index
    this.season = episode.season
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

    this.audioFile.index = 1 // Only 1 audio file per episode
  }

  toJSON() {
    return {
      libraryItemId: this.libraryItemId,
      id: this.id,
      index: this.index,
      season: this.season,
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

  toJSONExpanded() {
    return {
      libraryItemId: this.libraryItemId,
      id: this.id,
      index: this.index,
      season: this.season,
      episode: this.episode,
      episodeType: this.episodeType,
      title: this.title,
      subtitle: this.subtitle,
      description: this.description,
      enclosure: this.enclosure ? { ...this.enclosure } : null,
      pubDate: this.pubDate,
      audioFile: this.audioFile.toJSON(),
      audioTrack: this.audioTrack.toJSON(),
      publishedAt: this.publishedAt,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      duration: this.duration,
      size: this.size
    }
  }

  get audioTrack() {
    var audioTrack = new AudioTrack()
    audioTrack.setData(this.libraryItemId, this.audioFile, 0)
    return audioTrack
  }
  get tracks() {
    return [this.audioTrack]
  }
  get duration() {
    return this.audioFile.duration
  }
  get size() { return this.audioFile.metadata.size }
  get enclosureUrl() {
    return this.enclosure ? this.enclosure.url : null
  }

  setData(data, index = 1) {
    this.id = getId('ep')
    this.index = index
    this.title = data.title
    this.subtitle = data.subtitle || ''
    this.pubDate = data.pubDate || ''
    this.description = data.description || ''
    this.enclosure = data.enclosure ? { ...data.enclosure } : null
    this.season = data.season || ''
    this.episode = data.episode || ''
    this.episodeType = data.episodeType || ''
    this.publishedAt = data.publishedAt || 0
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }

  setDataFromAudioFile(audioFile, index) {
    this.id = getId('ep')
    this.audioFile = audioFile
    this.title = Path.basename(audioFile.metadata.filename, Path.extname(audioFile.metadata.filename))
    this.index = index
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }

  update(payload) {
    var hasUpdates = false
    for (const key in this.toJSON()) {
      if (payload[key] != undefined && payload[key] != this[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    }
    if (hasUpdates) {
      this.updatedAt = Date.now()
    }
    return hasUpdates
  }

  // Only checks container format
  checkCanDirectPlay(payload) {
    const supportedMimeTypes = payload.supportedMimeTypes || []
    return supportedMimeTypes.includes(this.audioFile.mimeType)
  }

  getDirectPlayTracklist() {
    return this.tracks
  }

  checkEqualsEnclosureUrl(url) {
    if (!this.enclosure || !this.enclosure.url) return false
    return this.enclosure.url == url
  }
}
module.exports = PodcastEpisode