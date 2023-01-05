const Logger = require('../../Logger')
const AudioFile = require('../files/AudioFile')
const AudioTrack = require('../files/AudioTrack')
const MusicMetadata = require('../metadata/MusicMetadata')
const { areEquivalent, copyValue } = require('../../utils/index')
const { filePathToPOSIX } = require('../../utils/fileUtils')

class Music {
  constructor(music) {
    this.libraryItemId = null
    this.metadata = null
    this.coverPath = null
    this.tags = []
    this.audioFile = null

    if (music) {
      this.construct(music)
    }
  }

  construct(music) {
    this.libraryItemId = music.libraryItemId
    this.metadata = new MusicMetadata(music.metadata)
    this.coverPath = music.coverPath
    this.tags = [...music.tags]
    this.audioFile = new AudioFile(music.audioFile)
  }

  toJSON() {
    return {
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSON(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      audioFile: this.audioFile.toJSON(),
    }
  }

  toJSONMinified() {
    return {
      metadata: this.metadata.toJSONMinified(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      audioFile: this.audioFile.toJSON(),
      duration: this.duration,
      size: this.size
    }
  }

  toJSONExpanded() {
    return {
      libraryItemId: this.libraryItemId,
      metadata: this.metadata.toJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...this.tags],
      audioFile: this.audioFile.toJSON(),
      duration: this.duration,
      size: this.size
    }
  }

  get size() {
    return this.audioFile.metadata.size
  }
  get hasMediaEntities() {
    return !!this.audioFile
  }
  get shouldSearchForCover() {
    return false
  }
  get hasEmbeddedCoverArt() {
    return this.audioFile.embeddedCoverArt
  }
  get hasIssues() {
    return false
  }
  get duration() {
    return this.audioFile.duration || 0
  }
  get audioTrack() {
    const audioTrack = new AudioTrack()
    audioTrack.setData(this.libraryItemId, this.audioFile, 0)
    return audioTrack
  }
  get numTracks() {
    return 1
  }

  update(payload) {
    const json = this.toJSON()
    delete json.episodes // do not update media entities here
    let hasUpdates = false
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
    coverPath = filePathToPOSIX(coverPath)
    if (this.coverPath === coverPath) return false
    this.coverPath = coverPath
    return true
  }

  removeFileWithInode(inode) {
    return false
  }

  findFileWithInode(inode) {
    return (this.audioFile && this.audioFile.ino === inode) ? this.audioFile : null
  }

  setData(mediaData) {
    this.metadata = new MusicMetadata()
    if (mediaData.metadata) {
      this.metadata.setData(mediaData.metadata)
    }

    this.coverPath = mediaData.coverPath || null
  }

  setAudioFile(audioFile) {
    this.audioFile = audioFile
  }

  setMetadataFromAudioFile(overrideExistingDetails = false) {
    if (!this.audioFile) return false
    if (!this.audioFile.metaTags) return false
    return this.metadata.setDataFromAudioMetaTags(this.audioFile.metaTags, overrideExistingDetails)
  }

  syncMetadataFiles(textMetadataFiles, opfMetadataOverrideDetails) {
    return false
  }

  searchQuery(query) {
    return {}
  }

  // Only checks container format
  checkCanDirectPlay(payload) {
    return true
  }

  getDirectPlayTracklist() {
    return [this.audioTrack]
  }

  getPlaybackTitle() {
    return this.metadata.title
  }

  getPlaybackAuthor() {
    return this.metadata.artist
  }
}
module.exports = Music