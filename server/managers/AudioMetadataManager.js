const Path = require('path')

const SocketAuthority = require('../SocketAuthority')
const Logger = require('../Logger')

const fs = require('../libs/fsExtra')

const { secondsToTimestamp } = require('../utils/index')
const toneHelpers = require('../utils/toneHelpers')
const filePerms = require('../utils/filePerms')

class AudioMetadataMangaer {
  constructor(db, taskManager) {
    this.db = db
    this.taskManager = taskManager
  }

  getToneMetadataObjectForApi(libraryItem) {
    return toneHelpers.getToneMetadataObject(libraryItem)
  }

  async updateMetadataForItem(user, libraryItem, options = {}) {
    const forceEmbedChapters = !!options.forceEmbedChapters
    const backupFiles = !!options.backup

    const audioFiles = libraryItem.media.includedAudioFiles

    const itemAudioMetadataPayload = {
      userId: user.id,
      libraryItemId: libraryItem.id,
      startedAt: Date.now(),
      audioFiles: audioFiles.map(af => ({ index: af.index, ino: af.ino, filename: af.metadata.filename }))
    }

    SocketAuthority.emitter('audio_metadata_started', itemAudioMetadataPayload)

    // Ensure folder for backup files
    const itemCacheDir = Path.join(global.MetadataPath, `cache/items/${libraryItem.id}`)
    let cacheDirCreated = false
    if (!await fs.pathExists(itemCacheDir)) {
      await fs.mkdir(itemCacheDir)
      await filePerms.setDefault(itemCacheDir, true)
      cacheDirCreated = true
    }

    // Write chapters file
    const toneJsonPath = Path.join(itemCacheDir, 'metadata.json')

    try {
      const chapters = (audioFiles.length == 1 || forceEmbedChapters) ? libraryItem.media.chapters : null
      await toneHelpers.writeToneMetadataJsonFile(libraryItem, chapters, toneJsonPath, audioFiles.length)
    } catch (error) {
      Logger.error(`[AudioMetadataManager] Write metadata.json failed`, error)

      itemAudioMetadataPayload.failed = true
      itemAudioMetadataPayload.error = 'Failed to write metadata.json'
      SocketAuthority.emitter('audio_metadata_finished', itemAudioMetadataPayload)
      return
    }

    const results = []
    for (const af of audioFiles) {
      const result = await this.updateAudioFileMetadataWithTone(libraryItem.id, af, toneJsonPath, itemCacheDir, backupFiles)
      results.push(result)
    }

    // Remove temp cache file/folder if not backing up
    if (!backupFiles) {
      // If cache dir was created from this then remove it
      if (cacheDirCreated) {
        await fs.remove(itemCacheDir)
      } else {
        await fs.remove(toneJsonPath)
      }
    }

    const elapsed = Date.now() - itemAudioMetadataPayload.startedAt
    Logger.debug(`[AudioMetadataManager] Elapsed ${secondsToTimestamp(elapsed / 1000, true)}`)
    itemAudioMetadataPayload.results = results
    itemAudioMetadataPayload.elapsed = elapsed
    itemAudioMetadataPayload.finishedAt = Date.now()
    SocketAuthority.emitter('audio_metadata_finished', itemAudioMetadataPayload)
  }

  async updateAudioFileMetadataWithTone(libraryItemId, audioFile, toneJsonPath, itemCacheDir, backupFiles) {
    const resultPayload = {
      libraryItemId,
      index: audioFile.index,
      ino: audioFile.ino,
      filename: audioFile.metadata.filename
    }
    SocketAuthority.emitter('audiofile_metadata_started', resultPayload)

    // Backup audio file
    if (backupFiles) {
      try {
        const backupFilePath = Path.join(itemCacheDir, audioFile.metadata.filename)
        await fs.copy(audioFile.metadata.path, backupFilePath)
        Logger.debug(`[AudioMetadataManager] Backed up audio file at "${backupFilePath}"`)
      } catch (err) {
        Logger.error(`[AudioMetadataManager] Failed to backup audio file "${audioFile.metadata.path}"`, err)
      }
    }

    const _toneMetadataObject = {
      'ToneJsonFile': toneJsonPath,
      'TrackNumber': audioFile.index,
    }

    resultPayload.success = await toneHelpers.tagAudioFile(audioFile.metadata.path, _toneMetadataObject)
    if (resultPayload.success) {
      Logger.info(`[AudioMetadataManager] Successfully tagged audio file "${audioFile.metadata.path}"`)
    }

    SocketAuthority.emitter('audiofile_metadata_finished', resultPayload)
    return resultPayload
  }
}
module.exports = AudioMetadataMangaer
