const Path = require('path')
const uuidv4 = require('uuid').v4
const { sanitizeFilename, filePathToPOSIX } = require('../utils/fileUtils')
const globals = require('../utils/globals')

class PodcastEpisodeDownload {
  constructor() {
    this.id = null
    /** @type {import('../utils/podcastUtils').RssPodcastEpisode} */
    this.rssPodcastEpisode = null

    this.url = null
    /** @type {import('../models/LibraryItem')} */
    this.libraryItem = null
    this.libraryId = null

    this.isAutoDownload = false
    this.isFinished = false
    this.failed = false

    this.appendRandomId = false

    this.startedAt = null
    this.createdAt = null
    this.finishedAt = null
  }

  toJSONForClient() {
    return {
      id: this.id,
      episodeDisplayTitle: this.rssPodcastEpisode?.title ?? null,
      url: this.url,
      libraryItemId: this.libraryItemId,
      libraryId: this.libraryId || null,
      isFinished: this.isFinished,
      failed: this.failed,
      appendRandomId: this.appendRandomId,
      startedAt: this.startedAt,
      createdAt: this.createdAt,
      finishedAt: this.finishedAt,
      podcastTitle: this.libraryItem?.media.title ?? null,
      podcastExplicit: !!this.libraryItem?.media.explicit,
      season: this.rssPodcastEpisode?.season ?? null,
      episode: this.rssPodcastEpisode?.episode ?? null,
      episodeType: this.rssPodcastEpisode?.episodeType ?? 'full',
      publishedAt: this.rssPodcastEpisode?.publishedAt ?? null
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
    const enclosureType = this.rssPodcastEpisode.enclosure.type
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
  get episodeTitle() {
    return this.rssPodcastEpisode.title
  }
  get targetFilename() {
    const appendage = this.appendRandomId ? ` (${this.id})` : ''
    const filename = `${this.rssPodcastEpisode.title}${appendage}.${this.fileExtension}`
    return sanitizeFilename(filename)
  }
  get targetPath() {
    return filePathToPOSIX(Path.join(this.libraryItem.path, this.targetFilename))
  }
  get targetRelPath() {
    return this.targetFilename
  }
  get libraryItemId() {
    return this.libraryItem?.id || null
  }
  get pubYear() {
    if (!this.rssPodcastEpisode.publishedAt) return null
    return new Date(this.rssPodcastEpisode.publishedAt).getFullYear()
  }

  /**
   *
   * @param {import('../utils/podcastUtils').RssPodcastEpisode} rssPodcastEpisode - from rss feed
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {*} isAutoDownload
   * @param {*} libraryId
   */
  setData(rssPodcastEpisode, libraryItem, isAutoDownload, libraryId) {
    this.id = uuidv4()
    this.rssPodcastEpisode = rssPodcastEpisode

    const url = rssPodcastEpisode.enclosure.url
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
