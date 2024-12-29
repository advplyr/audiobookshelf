const Path = require('path')
const uuidv4 = require('uuid').v4
const { sanitizeFilename, filePathToPOSIX } = require('../utils/fileUtils')
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

    this.appendEpisodeId = false

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
      appendEpisodeId: this.appendEpisodeId,
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

  get urlFileExtension() {
    const cleanUrl = this.url.split('?')[0] // Remove query string
    return Path.extname(cleanUrl).substring(1).toLowerCase()
  }
  get fileExtension() {
    const extname = this.urlFileExtension
    if (globals.SupportedAudioTypes.includes(extname)) return extname
    return 'mp3'
  }
  get enclosureType() {
    const enclosureType = this.podcastEpisode?.enclosure?.type
    return typeof enclosureType === 'string' ? enclosureType : null
  }
  /**
   * RSS feed may have an episode with file extension of mp3 but the specified enclosure type is not mpeg.
   * @see https://github.com/advplyr/audiobookshelf/issues/3711
   *
   * @returns {boolean}
   */
  get isMp3() {
    if (this.enclosureType && !this.enclosureType.includes('mpeg')) return false
    return this.fileExtension === 'mp3'
  }

  get targetFilename() {
    const appendage = this.appendEpisodeId ? ` (${this.podcastEpisode.id})` : ''
    const filename = `${this.podcastEpisode.title}${appendage}.${this.fileExtension}`
    return sanitizeFilename(filename)
  }
  get targetPath() {
    return filePathToPOSIX(Path.join(this.libraryItem.path, this.targetFilename))
  }
  get targetRelPath() {
    return this.targetFilename
  }
  get libraryItemId() {
    return this.libraryItem ? this.libraryItem.id : null
  }

  setData(podcastEpisode, libraryItem, isAutoDownload, libraryId) {
    this.id = uuidv4()
    this.podcastEpisode = podcastEpisode

    const url = podcastEpisode.enclosure.url
    if (decodeURIComponent(url) !== url) {
      // Already encoded
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
