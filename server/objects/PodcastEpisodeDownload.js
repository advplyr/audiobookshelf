const Path = require('path')
const { getId } = require('../utils/index')
const { sanitizeFilename } = require('../utils/fileUtils')

class PodcastEpisodeDownload {
  constructor() {
    this.id = null
    this.podcastEpisode = null
    this.url = null
    this.libraryItem = null

    this.isDownloading = false
    this.startedAt = null
    this.createdAt = null
    this.finishedAt = null
  }

  get targetFilename() {
    return sanitizeFilename(`${this.podcastEpisode.bestFilename}.mp3`)
  }

  get targetPath() {
    return Path.join(this.libraryItem.path, this.targetFilename)
  }

  get targetRelPath() {
    return Path.join(this.libraryItem.relPath, this.targetFilename)
  }

  setData(podcastEpisode, libraryItem) {
    this.id = getId('epdl')
    this.podcastEpisode = podcastEpisode
    this.url = podcastEpisode.enclosure.url
    this.libraryItem = libraryItem
    this.createdAt = Date.now()
  }
}
module.exports = PodcastEpisodeDownload