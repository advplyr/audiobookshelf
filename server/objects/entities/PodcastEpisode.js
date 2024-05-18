const uuidv4 = require('uuid').v4
const { areEquivalent, copyValue } = require('../../utils/index')
const AudioFile = require('../files/AudioFile')
const AudioTrack = require('../files/AudioTrack')

class PodcastEpisode {
  constructor(episode) {
    this.libraryItemId = null
    this.podcastId = null
    this.id = null
    this.oldEpisodeId = null
    this.index = null

    this.season = null
    this.episode = null
    this.episodeType = null
    this.title = null
    this.subtitle = null
    this.description = null
    this.enclosure = null
    this.guid = null
    this.pubDate = null
    this.chapters = []

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
    this.podcastId = episode.podcastId
    this.id = episode.id
    this.oldEpisodeId = episode.oldEpisodeId
    this.index = episode.index
    this.season = episode.season
    this.episode = episode.episode
    this.episodeType = episode.episodeType
    this.title = episode.title
    this.subtitle = episode.subtitle
    this.description = episode.description
    this.enclosure = episode.enclosure ? { ...episode.enclosure } : null
    this.guid = episode.guid || null
    this.pubDate = episode.pubDate
    this.chapters = episode.chapters?.map((ch) => ({ ...ch })) || []
    this.audioFile = episode.audioFile ? new AudioFile(episode.audioFile) : null
    this.publishedAt = episode.publishedAt
    this.addedAt = episode.addedAt
    this.updatedAt = episode.updatedAt

    if (this.audioFile) {
      this.audioFile.index = 1 // Only 1 audio file per episode
    }
  }

  toJSON() {
    return {
      libraryItemId: this.libraryItemId,
      podcastId: this.podcastId,
      id: this.id,
      oldEpisodeId: this.oldEpisodeId,
      index: this.index,
      season: this.season,
      episode: this.episode,
      episodeType: this.episodeType,
      title: this.title,
      subtitle: this.subtitle,
      description: this.description,
      enclosure: this.enclosure ? { ...this.enclosure } : null,
      guid: this.guid,
      pubDate: this.pubDate,
      chapters: this.chapters.map((ch) => ({ ...ch })),
      audioFile: this.audioFile?.toJSON() || null,
      publishedAt: this.publishedAt,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }

  toJSONExpanded() {
    return {
      libraryItemId: this.libraryItemId,
      podcastId: this.podcastId,
      id: this.id,
      oldEpisodeId: this.oldEpisodeId,
      index: this.index,
      season: this.season,
      episode: this.episode,
      episodeType: this.episodeType,
      title: this.title,
      subtitle: this.subtitle,
      description: this.description,
      enclosure: this.enclosure ? { ...this.enclosure } : null,
      guid: this.guid,
      pubDate: this.pubDate,
      chapters: this.chapters.map((ch) => ({ ...ch })),
      audioFile: this.audioFile?.toJSON() || null,
      audioTrack: this.audioTrack?.toJSON() || null,
      publishedAt: this.publishedAt,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      duration: this.duration,
      size: this.size
    }
  }

  get audioTrack() {
    if (!this.audioFile) return null
    const audioTrack = new AudioTrack()
    audioTrack.setData(this.libraryItemId, this.audioFile, 0)
    return audioTrack
  }
  get tracks() {
    return [this.audioTrack]
  }
  get duration() {
    return this.audioFile?.duration || 0
  }
  get size() {
    return this.audioFile?.metadata.size || 0
  }
  get enclosureUrl() {
    return this.enclosure?.url || null
  }
  get pubYear() {
    if (!this.publishedAt) return null
    return new Date(this.publishedAt).getFullYear()
  }

  setData(data, index = 1) {
    this.id = uuidv4()
    this.index = index
    this.title = data.title
    this.subtitle = data.subtitle || ''
    this.pubDate = data.pubDate || ''
    this.description = data.description || ''
    this.enclosure = data.enclosure ? { ...data.enclosure } : null
    this.guid = data.guid || null
    this.season = data.season || ''
    this.episode = data.episode || ''
    this.episodeType = data.episodeType || 'full'
    this.publishedAt = data.publishedAt || 0
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }

  update(payload) {
    let hasUpdates = false
    for (const key in this.toJSON()) {
      let newValue = payload[key]
      if (newValue === '') newValue = null
      let existingValue = this[key]
      if (existingValue === '') existingValue = null

      if (newValue != undefined && !areEquivalent(newValue, existingValue)) {
        this[key] = copyValue(newValue)
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
    if (!this.enclosure?.url) return false
    return this.enclosure.url == url
  }
}
module.exports = PodcastEpisode
