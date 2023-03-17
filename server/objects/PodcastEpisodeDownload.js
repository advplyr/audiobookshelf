const Path = require('path')
const { getId } = require('../utils/index')
const { sanitizeFilename } = require('../utils/fileUtils')
const globals = require('../utils/globals')

class PodcastEpisodeDownload {
  constructor() {
    this.id = null
    this.podcastEpisode = null
    this.url = null
    this.libraryItem = null
    this.libraryId = null

    this.isAutoDownload = false
    this.isFinished = false
    this.failed = false

    this.startedAt = null
    this.createdAt = null
    this.finishedAt = null
  }

  toJSONForClient() {
    return {
      id: this.id,
      episodeDisplayTitle: this.podcastEpisode?.title ?? null,
      url: this.url,
      libraryItemId: this.libraryItem?.id || null,
      libraryId: this.libraryId || null,
      isFinished: this.isFinished,
      failed: this.failed,
      startedAt: this.startedAt,
      createdAt: this.createdAt,
      finishedAt: this.finishedAt,
      podcastTitle: this.libraryItem?.media.metadata.title ?? null,
      podcastExplicit: !!this.libraryItem?.media.metadata.explicit,
      season: this.podcastEpisode?.season ?? null,
      episode: this.podcastEpisode?.episode ?? null,
      episodeType: this.podcastEpisode?.episodeType ?? 'full',
      publishedAt: this.podcastEpisode?.publishedAt ?? null
    }
  }

  get fileExtension() {
    const extname = Path.extname(this.url).substring(1).toLowerCase()
    if (globals.SupportedAudioTypes.includes(extname)) return extname
    return 'mp3'
  }

  get targetFilename() {
    return sanitizeFilename(`${this.podcastEpisode.title}.${this.fileExtension}`)
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

  setData(podcastEpisode, libraryItem, isAutoDownload, libraryId) {
    this.id = getId('epdl')
    this.podcastEpisode = podcastEpisode

    const url = podcastEpisode.enclosure.url
    if (decodeURIComponent(url) !== url) { // Already encoded
      this.url = url
    } else {
      this.url = encodeURI(url)
    }

    this.libraryItem = libraryItem
    this.isAutoDownload = isAutoDownload
    this.createdAt = Date.now()
    this.libraryId = libraryId
  }

  setFinished(success) {
    this.finishedAt = Date.now()
    this.isFinished = true
    this.failed = !success
  }
}
module.exports = PodcastEpisodeDownload
