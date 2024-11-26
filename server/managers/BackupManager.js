const sqlite3 = require('sqlite3')
const Path = require('path')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const cron = require('../libs/nodeCron')
const fs = require('../libs/fsExtra')
const archiver = require('../libs/archiver')
const StreamZip = require('../libs/nodeStreamZip')
const fileUtils = require('../utils/fileUtils')

// Utils
const { getFileSize } = require('../utils/fileUtils')

const Backup = require('../objects/Backup')
const CacheManager = require('./CacheManager')
const NotificationManager = require('./NotificationManager')

class BackupManager {
  constructor() {
    this.ItemsMetadataPath = Path.join(global.MetadataPath, 'items')
    this.AuthorsMetadataPath = Path.join(global.MetadataPath, 'authors')

    this.scheduleTask = null

    this.backups = []
  }

  get backupPath() {
    return global.ServerSettings.backupPath
  }

  get backupPathEnvSet() {
    return !!process.env.BACKUP_PATH
  }

  get backupSchedule() {
    return global.ServerSettings.backupSchedule
  }

  get backupsToKeep() {
    return global.ServerSettings.backupsToKeep || 2
  }

  get maxBackupSize() {
    return global.ServerSettings.maxBackupSize || Infinity
  }

  async init() {
    const backupsDirExists = await fs.pathExists(this.backupPath)
    if (!backupsDirExists) {
      await fs.ensureDir(this.backupPath)
    }

    await this.loadBackups()
    this.scheduleCron()
  }

  /**
   * Reload backups after updating backup path
   */
  async reload() {
    Logger.info(`[BackupManager] Reloading backups with backup path "${this.backupPath}"`)
    this.backups = []
    await this.loadBackups()
    this.updateCronSchedule()
  }

  scheduleCron() {
    if (!this.backupSchedule) {
      Logger.info(`[BackupManager] Auto Backups are disabled`)
      return
    }
    try {
      var cronSchedule = this.backupSchedule
      this.scheduleTask = cron.schedule(cronSchedule, this.runBackup.bind(this))
    } catch (error) {
      Logger.error(`[BackupManager] Failed to schedule backup cron ${this.backupSchedule}`, error)
    }
  }

  updateCronSchedule() {
    if (this.scheduleTask && !this.backupSchedule) {
      Logger.info(`[BackupManager] Disabling backup schedule`)
      if (this.scheduleTask.stop) this.scheduleTask.stop()
      this.scheduleTask = null
    } else if (!this.scheduleTask && this.backupSchedule) {
      Logger.info(`[BackupManager] Starting backup schedule ${this.backupSchedule}`)
      this.scheduleCron()
    } else if (this.backupSchedule) {
      Logger.info(`[BackupManager] Restarting backup schedule ${this.backupSchedule}`)
      if (this.scheduleTask.stop) this.scheduleTask.stop()
      this.scheduleCron()
    }
  }

  async uploadBackup(req, res) {
    const backupFile = req.files.file
    if (Path.extname(backupFile.name) !== '.audiobookshelf') {
      Logger.error(`[BackupManager] Invalid backup file uploaded "${backupFile.name}"`)
      return res.status(500).send('Invalid backup file')
    }

    const tempPath = Path.join(this.backupPath, fileUtils.sanitizeFilename(backupFile.name))
    const success = await backupFile
      .mv(tempPath)
      .then(() => true)
      .catch((error) => {
        Logger.error('[BackupManager] Failed to move backup file', path, error)
        return false
      })
    if (!success) {
      return res.status(500).send('Failed to move backup file into backups directory')
    }

    const zip = new StreamZip.async({ file: tempPath })
    let entries
    try {
      entries = await zip.entries()
    } catch (error) {
      // Not a valid zip file
      Logger.error('[BackupManager] Failed to read backup file - backup might not be a valid .zip file', tempPath, error)
      return res.status(400).send('Failed to read backup file - backup might not be a valid .zip file')
    }
    if (!Object.keys(entries).includes('absdatabase.sqlite')) {
      Logger.error(`[BackupManager] Invalid backup with no absdatabase.sqlite file - might be a backup created on an old Audiobookshelf server.`)
      return res.status(500).send('Invalid backup with no absdatabase.sqlite file - might be a backup created on an old Audiobookshelf server.')
    }

    const data = await zip.entryData('details')
    const details = data.toString('utf8').split('\n')

    const backup = new Backup({ details, fullPath: tempPath })

    if (!backup.serverVersion) {
      Logger.error(`[BackupManager] Invalid backup with no server version - might be a backup created before version 2.0.0`)
      return res.status(500).send('Invalid backup. Might be a backup created before version 2.0.0.')
    }

    backup.fileSize = await getFileSize(backup.fullPath)

    const existingBackupIndex = this.backups.findIndex((b) => b.id === backup.id)
    if (existingBackupIndex >= 0) {
      Logger.warn(`[BackupManager] Backup already exists with id ${backup.id} - overwriting`)
      this.backups.splice(existingBackupIndex, 1, backup)
    } else {
      this.backups.push(backup)
    }

    res.json({
      backups: this.backups.map((b) => b.toJSON())
    })
  }

  async requestCreateBackup(res) {
    var backupSuccess = await this.runBackup()
    if (backupSuccess) {
      res.json({
        backups: this.backups.map((b) => b.toJSON())
      })
    } else {
      res.sendStatus(500)
    }
  }

  /**
   *
   * @param {import('./ApiCacheManager')} apiCacheManager
   * @param {Backup} backup
   * @param {import('express').Response} res
   */
  async requestApplyBackup(apiCacheManager, backup, res) {
    Logger.info(`[BackupManager] Applying backup at "${backup.fullPath}"`)

    const zip = new StreamZip.async({ file: backup.fullPath })

    const entries = await zip.entries()

    // Ensure backup has an absdatabase.sqlite file
    if (!Object.keys(entries).includes('absdatabase.sqlite')) {
      Logger.error(`[BackupManager] Cannot apply old backup ${backup.fullPath}`)
      await zip.close()
      return res.status(500).send('Invalid backup file. Does not include absdatabase.sqlite. This might be from an older Audiobookshelf server.')
    }

    await Database.disconnect()

    const dbPath = Path.join(global.ConfigPath, 'absdatabase.sqlite')
    const tempDbPath = Path.join(global.ConfigPath, 'absdatabase-temp.sqlite')

    // Extract backup sqlite file to temporary path
    await zip.extract('absdatabase.sqlite', tempDbPath)
    Logger.info(`[BackupManager] Extracted backup sqlite db to temp path ${tempDbPath}`)

    // Verify extract - Abandon backup if sqlite file did not extract
    if (!(await fs.pathExists(tempDbPath))) {
      Logger.error(`[BackupManager] Sqlite file not found after extract - abandon backup apply and reconnect db`)
      await zip.close()
      await Database.reconnect()
      return res.status(500).send('Failed to extract sqlite db from backup')
    }

    // Attempt to remove existing db file
    try {
      await fs.remove(dbPath)
    } catch (error) {
      // Abandon backup and remove extracted sqlite file if unable to remove existing db file
      Logger.error(`[BackupManager] Unable to overwrite existing db file - abandon backup apply and reconnect db`, error)
      await fs.remove(tempDbPath)
      await zip.close()
      await Database.reconnect()
      return res.status(500).send(`Failed to overwrite sqlite db: ${error?.message || 'Unknown Error'}`)
    }

    // Rename temp db
    await fs.move(tempDbPath, dbPath)
    Logger.info(`[BackupManager] Saved backup sqlite file at "${dbPath}"`)

    // Extract /metadata/items and /metadata/authors folders
    await fs.ensureDir(this.ItemsMetadataPath)
    await zip.extract('metadata-items/', this.ItemsMetadataPath)
    await fs.ensureDir(this.AuthorsMetadataPath)
    await zip.extract('metadata-authors/', this.AuthorsMetadataPath)
    await zip.close()

    // Reconnect db
    await Database.reconnect()

    // Reset api cache, set hooks again
    await apiCacheManager.reset()

    // Clear metadata cache
    await CacheManager.purgeAll()

    res.sendStatus(200)

    // Triggers browser refresh for all clients
    SocketAuthority.emitter('backup_applied')
  }

  async loadBackups() {
    try {
      const filesInDir = await fs.readdir(this.backupPath)

      for (let i = 0; i < filesInDir.length; i++) {
        const filename = filesInDir[i]
        if (filename.endsWith('.audiobookshelf')) {
          const fullFilePath = Path.join(this.backupPath, filename)

          let zip = null
          let data = null
          try {
            zip = new StreamZip.async({ file: fullFilePath })
            data = await zip.entryData('details')
          } catch (error) {
            Logger.error(`[BackupManager] Failed to unzip backup "${fullFilePath}"`, error)
            continue
          }

          const details = data.toString('utf8').split('\n')

          const backup = new Backup({ details, fullPath: fullFilePath })

          if (!backup.serverVersion) {
            // Backups before v2
            Logger.error(`[BackupManager] Old unsupported backup was found "${backup.filename}"`)
          } else if (!backup.key) {
            // Backups before sqlite migration
            Logger.warn(`[BackupManager] Old unsupported backup was found "${backup.filename}" (pre sqlite migration)`)
          }

          backup.fileSize = await getFileSize(backup.fullPath)
          const existingBackupWithId = this.backups.find((b) => b.id === backup.id)
          if (existingBackupWithId) {
            Logger.warn(`[BackupManager] Backup already loaded with id ${backup.id} - ignoring`)
          } else {
            this.backups.push(backup)
          }

          Logger.debug(`[BackupManager] Backup found "${backup.id}"`)
          await zip.close()
        }
      }
      Logger.info(`[BackupManager] ${this.backups.length} Backups Found`)
    } catch (error) {
      Logger.error('[BackupManager] Failed to load backups', error)
    }
  }

  async runBackup() {
    // Check if Metadata Path is inside Config Path (otherwise there will be an infinite loop as the archiver tries to zip itself)
    Logger.info(`[BackupManager] Running Backup`)
    const newBackup = new Backup()
    newBackup.setData(this.backupPath)

    await fs.ensureDir(this.AuthorsMetadataPath)

    // Create backup sqlite file
    const sqliteBackupPath = await this.backupSqliteDb(newBackup).catch((error) => {
      Logger.error(`[BackupManager] Failed to backup sqlite db`, error)
      const errorMsg = error?.message || error || 'Unknown Error'
      NotificationManager.onBackupFailed(errorMsg)
      return false
    })

    if (!sqliteBackupPath) {
      return false
    }

    // Zip sqlite file, /metadata/items, and /metadata/authors folders
    const zipResult = await this.zipBackup(sqliteBackupPath, newBackup).catch((error) => {
      Logger.error(`[BackupManager] Backup Failed ${error}`)
      const errorMsg = error?.message || error || 'Unknown Error'
      NotificationManager.onBackupFailed(errorMsg)
      return false
    })

    // Remove sqlite backup
    await fs.remove(sqliteBackupPath)

    if (!zipResult) return false

    Logger.info(`[BackupManager] Backup successful ${newBackup.id}`)

    newBackup.fileSize = await getFileSize(newBackup.fullPath)

    const existingIndex = this.backups.findIndex((b) => b.id === newBackup.id)
    if (existingIndex >= 0) {
      this.backups.splice(existingIndex, 1, newBackup)
    } else {
      this.backups.push(newBackup)
    }

    // Check remove oldest backup
    const removeOldest = this.backups.length > this.backupsToKeep
    if (removeOldest) {
      this.backups.sort((a, b) => a.createdAt - b.createdAt)

      const oldBackup = this.backups.shift()
      Logger.debug(`[BackupManager] Removing old backup ${oldBackup.id}`)
      this.removeBackup(oldBackup)
    }

    // Notification for backup successfully completed
    NotificationManager.onBackupCompleted(newBackup, this.backups.length, removeOldest)

    return true
  }

  async removeBackup(backup) {
    try {
      Logger.debug(`[BackupManager] Removing Backup "${backup.fullPath}"`)
      await fs.remove(backup.fullPath)
      this.backups = this.backups.filter((b) => b.id !== backup.id)
      Logger.info(`[BackupManager] Backup "${backup.id}" Removed`)
    } catch (error) {
      Logger.error(`[BackupManager] Failed to remove backup`, error)
    }
  }

  /**
   * @see https://github.com/TryGhost/node-sqlite3/pull/1116
   * @param {Backup} backup
   */
  backupSqliteDb(backup) {
    const db = new sqlite3.Database(Database.dbPath)
    const dbFilePath = Path.join(global.ConfigPath, `absdatabase.${backup.id}.sqlite`)
    return new Promise(async (resolve, reject) => {
      const backup = db.backup(dbFilePath)
      backup.step(-1)
      backup.finish()

      // Max time ~2 mins
      for (let i = 0; i < 240; i++) {
        if (backup.completed) {
          return resolve(dbFilePath)
        } else if (backup.failed) {
          return reject(backup.message || 'Unknown failure reason')
        }
        await new Promise((r) => setTimeout(r, 500))
      }

      Logger.error(`[BackupManager] Backup sqlite timed out`)
      reject('Backup timed out')
    })
  }

  zipBackup(sqliteBackupPath, backup) {
    return new Promise((resolve, reject) => {
      // create a file to stream archive data to
      const output = fs.createWriteStream(backup.fullPath)
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      })

      // listen for all archive data to be written
      // 'close' event is fired only when a file descriptor is involved
      output.on('close', () => {
        Logger.info('[BackupManager]', archive.pointer() + ' total bytes')
        resolve(true)
      })

      // This event is fired when the data source is drained no matter what was the data source.
      // It is not part of this library but rather from the NodeJS Stream API.
      // @see: https://nodejs.org/api/stream.html#stream_event_end
      output.on('end', () => {
        Logger.debug('Data has been drained')
      })

      output.on('finish', () => {
        Logger.debug('Write Stream Finished')
      })

      output.on('error', (err) => {
        Logger.debug('Write Stream Error', err)
        reject(err)
      })

      // good practice to catch warnings (ie stat failures and other non-blocking errors)
      archive.on('warning', function (err) {
        if (err.code === 'ENOENT') {
          // log warning
          Logger.warn(`[BackupManager] Archiver warning: ${err.message}`)
        } else {
          // throw error
          Logger.error(`[BackupManager] Archiver error: ${err.message}`)
          // throw err
          reject(err)
        }
      })
      archive.on('error', function (err) {
        Logger.error(`[BackupManager] Archiver error: ${err.message}`)
        reject(err)
      })
      archive.on('progress', ({ fs: fsobj }) => {
        if (this.maxBackupSize !== Infinity) {
          const maxBackupSizeInBytes = this.maxBackupSize * 1000 * 1000 * 1000
          if (fsobj.processedBytes > maxBackupSizeInBytes) {
            Logger.error(`[BackupManager] Archiver is too large - aborting to prevent endless loop, Bytes Processed: ${fsobj.processedBytes}`)
            archive.abort()
            setTimeout(() => {
              this.removeBackup(backup)
              output.destroy('Backup too large') // Promise is reject in write stream error evt
            }, 500)
          }
        }
      })

      // pipe archive data to the file
      archive.pipe(output)

      archive.file(sqliteBackupPath, { name: 'absdatabase.sqlite' })
      archive.directory(this.ItemsMetadataPath, 'metadata-items')
      archive.directory(this.AuthorsMetadataPath, 'metadata-authors')

      archive.append(backup.detailsString, { name: 'details' })

      archive.finalize()
    })
  }
}
module.exports = BackupManager
