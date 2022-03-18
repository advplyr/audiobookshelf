const Path = require('path')
const AudioFile = require('../files/AudioFile')
const { areEquivalent, copyValue, getId } = require('../../utils/index')
const AudioTrack = require('../files/AudioTrack')

class Audiobook {
  constructor(audiobook) {
    this.id = null
    this.index = null
    this.name = null
    this.audioFiles = []
    this.chapters = []
    this.missingParts = []
    this.addedAt = null
    this.updatedAt = null

    if (audiobook) {
      this.construct(audiobook)
    }
  }

  construct(audiobook) {
    this.id = audiobook.id
    this.index = audiobook.index
    this.name = audiobook.name || null
    this.audioFiles = audiobook.audioFiles.map(f => new AudioFile(f))
    this.chapters = audiobook.chapters.map(c => ({ ...c }))
    this.missingParts = audiobook.missingParts ? [...audiobook.missingParts] : []
    this.addedAt = audiobook.addedAt
    this.updatedAt = audiobook.updatedAt
  }

  toJSON() {
    return {
      id: this.id,
      index: this.index,
      name: this.name,
      audioFiles: this.audioFiles.map(f => f.toJSON()),
      chapters: this.chapters.map(c => ({ ...c })),
      missingParts: [...this.missingParts],
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }

  toJSONMinified() {
    return {
      id: this.id,
      index: this.index,
      name: this.name,
      numTracks: this.tracks.length,
      numAudioFiles: this.audioFiles.length,
      numChapters: this.chapters.length,
      numMissingParts: this.missingParts.length,
      duration: this.duration,
      size: this.size,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }

  toJSONExpanded() {
    return {
      id: this.id,
      index: this.index,
      name: this.name,
      audioFiles: this.audioFiles.map(f => f.toJSON()),
      chapters: this.chapters.map(c => ({ ...c })),
      duration: this.duration,
      size: this.size,
      tracks: this.tracks.map(t => t.toJSON()),
      missingParts: [...this.missingParts],
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }

  get isPlaybackMediaEntity() { return true }
  get tracks() {
    return this.audioFiles.filter(af => !af.exclude && !af.invalid)
  }
  get duration() {
    var total = 0
    this.tracks.forEach((track) => total += track.duration)
    return total
  }
  get size() {
    var total = 0
    this.audioFiles.forEach((af) => total += af.metadata.size)
    return total
  }
  get hasEmbeddedCoverArt() {
    return this.audioFiles.some(af => af.embeddedCoverArt)
  }

  setData(name, index) {
    this.id = getId('ab')
    this.name = name
    this.index = index
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }

  update(payload) {
    var json = this.toJSON()
    var hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined) {
        if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          Logger.debug('[Audiobook] Key updated', key, this[key])
          hasUpdates = true
        }
      }
    }
    return hasUpdates
  }

  updateAudioTracks(orderedFileData) {
    var index = 1
    this.audioFiles = orderedFileData.map((fileData) => {
      var audioFile = this.audioFiles.find(af => af.ino === fileData.ino)
      audioFile.manuallyVerified = true
      audioFile.invalid = false
      audioFile.error = null
      if (fileData.exclude !== undefined) {
        audioFile.exclude = !!fileData.exclude
      }
      if (audioFile.exclude) {
        audioFile.index = -1
      } else {
        audioFile.index = index++
      }
      return audioFile
    })

    this.rebuildTracks()
  }

  rebuildTracks() {
    this.audioFiles.sort((a, b) => a.index - b.index)
    this.missingParts = []
    this.setChapters()
    this.checkUpdateMissingTracks()
  }

  checkUpdateMissingTracks() {
    var currMissingParts = (this.missingParts || []).join(',') || ''

    var current_index = 1
    var missingParts = []

    for (let i = 0; i < this.tracks.length; i++) {
      var _track = this.tracks[i]
      if (_track.index > current_index) {
        var num_parts_missing = _track.index - current_index
        for (let x = 0; x < num_parts_missing && x < 9999; x++) {
          missingParts.push(current_index + x)
        }
      }
      current_index = _track.index + 1
    }

    this.missingParts = missingParts

    var newMissingParts = (this.missingParts || []).join(',') || ''
    var wasUpdated = newMissingParts !== currMissingParts
    if (wasUpdated && this.missingParts.length) {
      Logger.info(`[Audiobook] "${this.name}" has ${missingParts.length} missing parts`)
    }

    return wasUpdated
  }

  setChapters() {
    // If 1 audio file without chapters, then no chapters will be set
    var includedAudioFiles = this.audioFiles.filter(af => !af.exclude)
    if (includedAudioFiles.length === 1) {
      // 1 audio file with chapters
      if (includedAudioFiles[0].chapters) {
        this.chapters = includedAudioFiles[0].chapters.map(c => ({ ...c }))
      }
    } else {
      this.chapters = []
      var currChapterId = 0
      var currStartTime = 0
      includedAudioFiles.forEach((file) => {
        // If audio file has chapters use chapters
        if (file.chapters && file.chapters.length) {
          file.chapters.forEach((chapter) => {
            var chapterDuration = chapter.end - chapter.start
            if (chapterDuration > 0) {
              var title = `Chapter ${currChapterId}`
              if (chapter.title) {
                title += ` (${chapter.title})`
              }
              this.chapters.push({
                id: currChapterId++,
                start: currStartTime,
                end: currStartTime + chapterDuration,
                title
              })
              currStartTime += chapterDuration
            }
          })
        } else if (file.duration) {
          // Otherwise just use track has chapter
          this.chapters.push({
            id: currChapterId++,
            start: currStartTime,
            end: currStartTime + file.duration,
            title: file.metadata.filename ? Path.basename(file.metadata.filename, Path.extname(file.metadata.filename)) : `Chapter ${currChapterId}`
          })
          currStartTime += file.duration
        }
      })
    }
  }

  findFileWithInode(inode) {
    return this.audioFiles.find(af => af.ino === inode)
  }

  removeFileWithInode(inode) {
    this.audioFiles = this.audioFiles.filter(af => af.ino !== inode)
  }

  // Only checks container format
  checkCanDirectPlay(payload) {
    var supportedMimeTypes = payload.supportedMimeTypes || []
    return !this.tracks.some((t) => !supportedMimeTypes.includes(t.mimeType))
  }

  getDirectPlayTracklist(libraryItemId) {
    var tracklist = []

    var startOffset = 0
    this.tracks.forEach((audioFile) => {
      var audioTrack = new AudioTrack()
      audioTrack.setData(libraryItemId, audioFile, startOffset)
      startOffset += audioTrack.duration
      tracklist.push(audioTrack)
    })

    return tracklist
  }
}
module.exports = Audiobook