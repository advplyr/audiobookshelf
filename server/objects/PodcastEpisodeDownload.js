const Path = require('path')
const { getId } = require('../utils/index')
const { sanitizeFilename } = require('../utils/fileUtils')

class PodcastEpisodeDownload {
  constructor() {
    this.id = null
    this.podcastEpisode = null
    this.url = null
    this.libraryItem = null

    this.isAutoDownload = false
    this.isDownloading = false
    this.isFinished = false
    this.failed = false

    this.startedAt = null
    this.createdAt = null
    this.finishedAt = null
  }

  toJSONForClient() {
    return {
      id: this.id,
      episodeDisplayTitle: this.podcastEpisode ? this.podcastEpisode.bestFilename : null,
      url: this.url,
      libraryItemId: this.libraryItem ? this.libraryItem.id : null,
      isDownloading: this.isDownloading,
      isFinished: this.isFinished,
      failed: this.failed,
      startedAt: this.startedAt,
      createdAt: this.createdAt,
      finishedAt: this.finishedAt
    }
  }

  get targetFilename() {
    return sanitizeFilename(`${this.podcastEpisode.bestFilename}.mp3`)
  }
  get targetPath() {
    return Path.join(this.libraryItem.path, this.targetFilename)
  }
  get targetRelPath() {
    return this.targetFilename
  }
  get libraryItemId() {
    return this.libraryItem ? this.libraryItem.id : null
  }

  setData(podcastEpisode, libraryItem, isAutoDownload) {
    this.id = getId('epdl')
    this.podcastEpisode = podcastEpisode
    this.url = podcastEpisode.enclosure.url
    this.libraryItem = libraryItem
    this.isAutoDownload = isAutoDownload
    this.createdAt = Date.now()
  }

  setFinished(success) {
    this.finishedAt = Date.now()
    this.isFinished = true
    this.failed = !success
  }
}
module.exports = PodcastEpisodeDownload