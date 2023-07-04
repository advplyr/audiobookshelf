const uuidv4 = require("uuid").v4
const Path = require('path')
const Logger = require('../../Logger')
const { cleanStringForSearch, areEquivalent, copyValue } = require('../../utils/index')
const AudioFile = require('../files/AudioFile')
const AudioTrack = require('../files/AudioTrack')

class PodcastEpisode {
  constructor(episode) {
    this.libraryItemId = null
    this.podcastId = null
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
    this.index = episode.index
    this.season = episode.season
    this.episode = episode.episode
    this.episodeType = episode.episodeType
    this.title = episode.title
    this.subtitle = episode.subtitle
    this.description = episode.description
    this.enclosure = episode.enclosure ? { ...episode.enclosure } : null
    this.pubDate = episode.pubDate
    this.chapters = episode.chapters?.map(ch => ({ ...ch })) || []
    this.audioFile = new AudioFile(episode.audioFile)
    this.publishedAt = episode.publishedAt
    this.addedAt = episode.addedAt
    this.updatedAt = episode.updatedAt

    this.audioFile.index = 1 // Only 1 audio file per episode
  }

  toJSON() {
    return {
      libraryItemId: this.libraryItemId,
      podcastId: this.podcastId,
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
      chapters: this.chapters.map(ch => ({ ...ch })),
      audioFile: this.audioFile.toJSON(),
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
      index: this.index,
      season: this.season,
      episode: this.episode,
      episodeType: this.episodeType,
      title: this.title,
      subtitle: this.subtitle,
      description: this.description,
      enclosure: this.enclosure ? { ...this.enclosure } : null,
      pubDate: this.pubDate,
      chapters: this.chapters.map(ch => ({ ...ch })),
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
    const audioTrack = new AudioTrack()
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
    this.season = data.season || ''
    this.episode = data.episode || ''
    this.episodeType = data.episodeType || 'full'
    this.publishedAt = data.publishedAt || 0
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }

  setDataFromAudioFile(audioFile, index) {
    this.id = uuidv4()
    this.audioFile = audioFile
    this.title = Path.basename(audioFile.metadata.filename, Path.extname(audioFile.metadata.filename))
    this.index = index

    this.setDataFromAudioMetaTags(audioFile.metaTags, true)

    this.chapters = audioFile.chapters?.map((c) => ({ ...c }))
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }

  update(payload) {
    let hasUpdates = false
    for (const key in this.toJSON()) {
      if (payload[key] != undefined && !areEquivalent(payload[key], this[key])) {
        this[key] = copyValue(payload[key])
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

  searchQuery(query) {
    return cleanStringForSearch(this.title).includes(query)
  }

  setDataFromAudioMetaTags(audioFileMetaTags, overrideExistingDetails = false) {
    if (!audioFileMetaTags) return false

    const MetadataMapArray = [
      {
        tag: 'tagComment',
        altTag: 'tagSubtitle',
        key: 'description'
      },
      {
        tag: 'tagSubtitle',
        key: 'subtitle'
      },
      {
        tag: 'tagDate',
        key: 'pubDate'
      },
      {
        tag: 'tagDisc',
        key: 'season',
      },
      {
        tag: 'tagTrack',
        altTag: 'tagSeriesPart',
        key: 'episode'
      },
      {
        tag: 'tagTitle',
        key: 'title'
      },
      {
        tag: 'tagEpisodeType',
        key: 'episodeType'
      }
    ]

    MetadataMapArray.forEach((mapping) => {
      let value = audioFileMetaTags[mapping.tag]
      let tagToUse = mapping.tag
      if (!value && mapping.altTag) {
        tagToUse = mapping.altTag
        value = audioFileMetaTags[mapping.altTag]
      }

      if (value && typeof value === 'string') {
        value = value.trim() // Trim whitespace

        if (mapping.key === 'pubDate' && (!this.pubDate || overrideExistingDetails)) {
          const pubJsDate = new Date(value)
          if (pubJsDate && !isNaN(pubJsDate)) {
            this.publishedAt = pubJsDate.valueOf()
            this.pubDate = value
            Logger.debug(`[PodcastEpisode] Mapping metadata to key ${tagToUse} => ${mapping.key}: ${this[mapping.key]}`)
          } else {
            Logger.warn(`[PodcastEpisode] Mapping pubDate with tag ${tagToUse} has invalid date "${value}"`)
          }
        } else if (mapping.key === 'episodeType' && (!this.episodeType || overrideExistingDetails)) {
          if (['full', 'trailer', 'bonus'].includes(value)) {
            this.episodeType = value
            Logger.debug(`[PodcastEpisode] Mapping metadata to key ${tagToUse} => ${mapping.key}: ${this[mapping.key]}`)
          } else {
            Logger.warn(`[PodcastEpisode] Mapping episodeType with invalid value "${value}". Must be one of [full, trailer, bonus].`)
          }
        } else if (!this[mapping.key] || overrideExistingDetails) {
          this[mapping.key] = value
          Logger.debug(`[PodcastEpisode] Mapping metadata to key ${tagToUse} => ${mapping.key}: ${this[mapping.key]}`)
        }
      }
    })
  }
}
module.exports = PodcastEpisode
