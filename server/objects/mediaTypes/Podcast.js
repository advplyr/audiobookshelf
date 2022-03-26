const PodcastEpisode = require('../entities/PodcastEpisode')
const PodcastMetadata = require('../metadata/PodcastMetadata')
const { areEquivalent, copyValue } = require('../../utils/index')
const { createNewSortInstance } = require('fast-sort')
const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

class Podcast {
  constructor(podcast) {
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
    this.metadata = new PodcastMetadata(podcast.metadata)
    this.coverPath = podcast.coverPath
    this.tags = [...podcast.tags]
    this.episodes = podcast.episodes.map((e) => new PodcastEpisode(e))
    this.autoDownloadEpisodes = !!podcast.autoDownloadEpisodes
  }

  toJSON() {
    return {
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSON()),
      autoDownloadEpisodes: this.autoDownloadEpisodes
    }
  }

  toJSONMinified() {
    return {
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSON()),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      size: this.size
    }
  }

  toJSONExpanded() {
    return {
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      episodes: this.episodes.map(e => e.toJSONExpanded()),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      size: this.size
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
    return this.episodes.some(ep => ep.audioFile.embeddedCoverArt)
  }
  get hasIssues() {
    return false
  }
  get duration() {
    var total = 0
    this.episodes.forEach((ep) => total += ep.duration)
    return total
  }
  get numTracks() {
    return this.episodes.length
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
    this.episodes = this.episodes.filter(ep => ep.ino !== inode)
  }

  findFileWithInode(inode) {
    return this.episodes.find(ep => ep.audioFile.ino === inode)
  }

  setData(mediaMetadata) {
    this.metadata = new PodcastMetadata()
    if (mediaMetadata.metadata) {
      this.metadata.setData(mediaMetadata.metadata)
    }

    this.coverPath = mediaMetadata.coverPath || null
    this.autoDownloadEpisodes = !!mediaMetadata.autoDownloadEpisodes
  }

  async syncMetadataFiles(textMetadataFiles, opfMetadataOverrideDetails) {
    return false
  }

  searchQuery(query) {
    var payload = this.metadata.searchQuery(query)
    return payload || {}
  }

  // Only checks container format
  checkCanDirectPlay(payload, epsiodeIndex = 0) {
    var episode = this.episodes[epsiodeIndex]
    return episode.checkCanDirectPlay(payload)
  }

  getDirectPlayTracklist(libraryItemId, episodeIndex = 0) {
    var episode = this.episodes[episodeIndex]
    return episode.getDirectPlayTracklist(libraryItemId)
  }

  addPodcastEpisode(podcastEpisode) {
    this.episodes.push(podcastEpisode)
  }

  addNewEpisodeFromAudioFile(audioFile, index) {
    var pe = new PodcastEpisode()
    pe.setDataFromAudioFile(audioFile, index)
    this.episodes.push(pe)
  }

  reorderEpisodes() {
    var hasUpdates = false
    this.episodes = naturalSort(this.episodes).asc((ep) => ep.bestFilename)
    for (let i = 0; i < this.episodes.length; i++) {
      if (this.episodes[i].index !== (i + 1)) {
        this.episodes[i].index = i + 1
        hasUpdates = true
      }
    }
    return hasUpdates
  }
}
module.exports = Podcast