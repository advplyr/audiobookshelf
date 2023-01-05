const Logger = require('../../Logger')
const VideoFile = require('../files/VideoFile')
const VideoTrack = require('../files/VideoTrack')
const VideoMetadata = require('../metadata/VideoMetadata')
const { areEquivalent, copyValue } = require('../../utils/index')
const { filePathToPOSIX } = require('../../utils/fileUtils')

class Video {
  constructor(video) {
    this.libraryItemId = null
    this.metadata = null
    this.coverPath = null
    this.tags = []
    this.episodes = []

    this.autoDownloadEpisodes = false
    this.lastEpisodeCheck = 0

    this.lastCoverSearch = null
    this.lastCoverSearchQuery = null

    if (video) {
      this.construct(video)
    }
  }

  construct(video) {
    this.libraryItemId = video.libraryItemId
    this.metadata = new VideoMetadata(video.metadata)
    this.coverPath = video.coverPath
    this.tags = [...video.tags]
    this.videoFile = new VideoFile(video.videoFile)
  }

  toJSON() {
    return {
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      videoFile: this.videoFile.toJSON()
    }
  }

  toJSONMinified() {
    return {
      metadata: this.metadata.toJSONMinified(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      videoFile: this.videoFile.toJSON(),
      size: this.size
    }
  }

  toJSONExpanded() {
    return {
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      videoFile: this.videoFile.toJSON(),
      size: this.size
    }
  }

  get size() {
    return this.videoFile.metadata.size
  }
  get hasMediaEntities() {
    return true
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
  get duration() {
    return 0
  }

  update(payload) {
    var json = this.toJSON()
    var hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined) {
        if (key === 'metadata') {
          if (this.metadata.update(payload.metadata)) {
            hasUpdates = true
          }
        } else if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          Logger.debug('[Video] Key updated', key, this[key])
          hasUpdates = true
        }
      }
    }
    return hasUpdates
  }

  updateCover(coverPath) {
    coverPath = filePathToPOSIX(coverPath)
    if (this.coverPath === coverPath) return false
    this.coverPath = coverPath
    return true
  }

  removeFileWithInode(inode) {

  }

  findFileWithInode(inode) {
    return null
  }

  setVideoFile(videoFile) {
    this.videoFile = videoFile
  }

  setData(mediaMetadata) {
    this.metadata = new VideoMetadata()
    if (mediaMetadata.metadata) {
      this.metadata.setData(mediaMetadata.metadata)
    }

    this.coverPath = mediaMetadata.coverPath || null
  }

  getPlaybackTitle() {
    return this.metadata.title
  }

  getPlaybackAuthor() {
    return ''
  }

  getVideoTrack() {
    var track = new VideoTrack()
    track.setData(this.libraryItemId, this.videoFile)
    return track
  }
}
module.exports = Video