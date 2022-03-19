const PodcastEpisode = require('../entities/PodcastEpisode')
const PodcastMetadata = require('../metadata/PodcastMetadata')
const { areEquivalent, copyValue } = require('../../utils/index')

class Podcast {
  constructor(podcast) {
    this.id = null

    this.metadata = null
    this.coverPath = null
    this.tags = []
    this.episodes = []

    this.autoDownloadEpisodes = false

    this.lastCoverSearch = null
    this.lastCoverSearchQuery = null

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
    this.autoDownloadEpisodes = !!podcast.autoDownloadEpisodes
  }

  toJSON() {
    return {
      id: this.id,
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSON()),
      autoDownloadEpisodes: this.autoDownloadEpisodes
    }
  }

  toJSONMinified() {
    return {
      id: this.id,
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSON()),
      autoDownloadEpisodes: this.autoDownloadEpisodes
    }
  }

  toJSONExpanded() {
    return {
      id: this.id,
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSON()),
      autoDownloadEpisodes: this.autoDownloadEpisodes
    }
  }

  get size() {
    var total = 0
    this.episodes.forEach((ep) => total += ep.size)
    return total
  }
  get hasMediaEntities() {
    return !!this.episodes.length
  }
  get shouldSearchForCover() {
    return false
  }
  get hasEmbeddedCoverArt() {
    return false
  }
  get hasIssues() {
    return false
  }

  update(payload) {
    var json = this.toJSON()
    delete json.episodes // do not update media entities here
    var hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined) {
        if (key === 'metadata') {
          if (this.metadata.update(payload.metadata)) {
            hasUpdates = true
          }
        } else if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          Logger.debug('[Podcast] Key updated', key, this[key])
          hasUpdates = true
        }
      }
    }
    return hasUpdates
  }

  updateCover(coverPath) {
    coverPath = coverPath.replace(/\\/g, '/')
    if (this.coverPath === coverPath) return false
    this.coverPath = coverPath
    return true
  }

  removeFileWithInode(inode) {
    return false
  }

  findFileWithInode(inode) {
    return null
  }

  getMediaEntityById(entityId) {
    return this.episodes.find(ep => ep.id === entityId)
  }
  getPlaybackMediaEntity() { // Get first playback media entity
    if (!this.episodes.length) return null
    return this.episodes[0]
  }

  setData(scanMediaMetadata) {
    this.metadata = new PodcastMetadata()
    this.metadata.setData(scanMediaMetadata)
  }

  async syncMetadataFiles(textMetadataFiles, opfMetadataOverrideDetails) {
    return false
  }

  searchQuery(query) {
    var payload = this.metadata.searchQuery(query)
    return payload || {}
  }

  getLongestDuration() {
    if (!this.episodes.length) return 0
    var longest = 0
    this.episodes.forEach((ab) => {
      if (ab.duration > longest) longest = ab.duration
    })
    return longest
  }

  getTotalAudioTracks() {
    return this.episodes.length
  }
  getTotalDuration() {
    var total = 0
    this.episodes.forEach((ep) => total += ep.duration)
    return total
  }
}
module.exports = Podcast