const Path = require('path')

const cron = require('../libs/nodeCron')
const fs = require('../libs/fsExtra')
const archiver = require('../libs/archiver')
const StreamZip = require('../libs/nodeStreamZip')

// Utils
const { getFileSize } = require('../utils/fileUtils')
const filePerms = require('../utils/filePerms')
const Logger = require('../Logger')

const Backup = require('../objects/Backup')

class BackupManager {
  constructor(db, emitter) {
    this.BackupPath = Path.join(global.MetadataPath, 'backups')
    this.ItemsMetadataPath = Path.join(global.MetadataPath, 'items')

    this.db = db
    this.emitter = emitter

    this.scheduleTask = null

    this.backups = []
  }

  get serverSettings() {
    return this.db.serverSettings || {}
  }

  async init() {
    var backupsDirExists = await fs.pathExists(this.BackupPath)
    if (!backupsDirExists) {
      await fs.ensureDir(this.BackupPath)
      await filePerms.setDefault(this.BackupPath)
    }

    await this.loadBackups()
    this.scheduleCron()
  }

  scheduleCron() {
    if (!this.serverSettings.backupSchedule) {
      Logger.info(`[BackupManager] Auto Backups are disabled`)
      return
    }
    try {
      var cronSchedule = this.serverSettings.backupSchedule
      this.scheduleTask = cron.schedule(cronSchedule, this.runBackup.bind(this))
    } catch (error) {
      Logger.error(`[BackupManager] Failed to schedule backup cron ${this.serverSettings.backupSchedule}`, error)
    }
  }

  updateCronSchedule() {
    if (this.scheduleTask && !this.serverSettings.backupSchedule) {
      Logger.info(`[BackupManager] Disabling backup schedule`)
      if (this.scheduleTask.destroy) this.scheduleTask.destroy()
      this.scheduleTask = null
    } else if (!this.scheduleTask && this.serverSettings.backupSchedule) {
      Logger.info(`[BackupManager] Starting backup schedule ${this.serverSettings.backupSchedule}`)
      this.scheduleCron()
    } else if (this.serverSettings.backupSchedule) {
      Logger.info(`[BackupManager] Restarting backup schedule ${this.serverSettings.backupSchedule}`)
      if (this.scheduleTask.destroy) this.scheduleTask.destroy()
      this.scheduleCron()
    }
  }

  async uploadBackup(req, res) {
    var backupFile = req.files.file
    if (Path.extname(backupFile.name) !== '.audiobookshelf') {
      Logger.error(`[BackupManager] Invalid backup file uploaded "${backupFile.name}"`)
      return res.status(500).send('Invalid backup file')
    }

    var tempPath = Path.join(this.BackupPath, backupFile.name)
    var success = await backupFile.mv(tempPath).then(() => true).catch((error) => {
      Logger.error('[BackupManager] Failed to move backup file', path, error)
      return false
    })
    if (!success) {
      return res.status(500).send('Failed to move backup file into backups directory')
    }

    const zip = new StreamZip.async({ file: tempPath })
    const data = await zip.entryData('details')
    var details = data.toString('utf8').split('\n')

    var backup = new Backup({ details, fullPath: tempPath })

    if (!backup.serverVersion) {
      Logger.error(`[BackupManager] Invalid backup with no server version - might be a backup created before version 2.0.0`)
      return res.status(500).send('Invalid backup. Might be a backup created before version 2.0.0.')
    }

    backup.fileSize = await getFileSize(backup.fullPath)

    var existingBackupIndex = this.backups.findIndex(b => b.id === backup.id)
    if (existingBackupIndex >= 0) {
      Logger.warn(`[BackupManager] Backup already exists with id ${backup.id} - overwriting`)
      this.backups.splice(existingBackupIndex, 1, backup)
    } else {
      this.backups.push(backup)
    }

    return res.json(this.backups.map(b => b.toJSON()))
  }

  async requestCreateBackup(res) {
    var backupSuccess = await this.runBackup()
    if (backupSuccess) res.json(this.backups.map(b => b.toJSON()))
    else res.sendStatus(500)
  }

  async requestApplyBackup(backup) {
    const zip = new StreamZip.async({ file: backup.fullPath })
    await zip.extract('config/', global.ConfigPath)
    if (backup.backupMetadataCovers) {
      await zip.extract('metadata-items/', this.ItemsMetadataPath)
    }
    await this.db.reinit()
    this.emitter('backup_applied')
  }

  async loadBackups() {
    try {
      var filesInDir = await fs.readdir(this.BackupPath)
      for (let i = 0; i < filesInDir.length; i++) {
        var filename = filesInDir[i]
        if (filename.endsWith('.audiobookshelf')) {
          var fullFilePath = Path.join(this.BackupPath, filename)

          let zip = null
          let data = null
          try {
            zip = new StreamZip.async({ file: fullFilePath })
            data = await zip.entryData('details')
          } catch (error) {
            if (error.message === "Bad archive") {
              Logger.warn(`[BackupManager] Backup appears to be corrupted: ${fullFilePath}`)
              continue;
            } else if (error.message === "unexpected end of file") {
              Logger.warn(`[BackupManager] Backup appears to be corrupted: ${fullFilePath}`)
              continue;
            } else {
              throw error
            }
          }

          var details = data.toString('utf8').split('\n')

          var backup = new Backup({ details, fullPath: fullFilePath })

          if (!backup.serverVersion) {
            Logger.error(`[BackupManager] Old unsupported backup was found "${backup.fullPath}"`)
          }

          backup.fileSize = await getFileSize(backup.fullPath)
          var existingBackupWithId = this.backups.find(b => b.id === backup.id)
          if (existingBackupWithId) {
            Logger.warn(`[BackupManager] Backup already loaded with id ${backup.id} - ignoring`)
          } else {
            this.backups.push(backup)
          }

          Logger.debug(`[BackupManager] Backup found "${backup.id}"`)
          zip.close()
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
    var metadataItemsPath = this.serverSettings.backupMetadataCovers ? this.ItemsMetadataPath : null

    var newBackup = new Backup()

    const newBackData = {
      backupMetadataCovers: this.serverSettings.backupMetadataCovers,
      backupDirPath: this.BackupPath
    }
    newBackup.setData(newBackData)

    var zipResult = await this.zipBackup(metadataItemsPath, newBackup).then(() => true).catch((error) => {
      Logger.error(`[BackupManager] Backup Failed ${error}`)
      return false
    })
    if (zipResult) {
      Logger.info(`[BackupManager] Backup successful ${newBackup.id}`)
      await filePerms.setDefault(newBackup.fullPath)
      newBackup.fileSize = await getFileSize(newBackup.fullPath)
      var existingIndex = this.backups.findIndex(b => b.id === newBackup.id)
      if (existingIndex >= 0) {
        this.backups.splice(existingIndex, 1, newBackup)
      } else {
        this.backups.push(newBackup)
      }

      // Check remove oldest backup
      if (this.backups.length > this.serverSettings.backupsToKeep) {
        this.backups.sort((a, b) => a.createdAt - b.createdAt)

        var oldBackup = this.backups.shift()
        Logger.debug(`[BackupManager] Removing old backup ${oldBackup.id}`)
        this.removeBackup(oldBackup)
      }
      return true
    } else {
      return false
    }
  }

  async removeBackup(backup) {
    try {
      Logger.debug(`[BackupManager] Removing Backup "${backup.fullPath}"`)
      await fs.remove(backup.fullPath)
      this.backups = this.backups.filter(b => b.id !== backup.id)
      Logger.info(`[BackupManager] Backup "${backup.id}" Removed`)
    } catch (error) {
      Logger.error(`[BackupManager] Failed to remove backup`, error)
    }
  }

  zipBackup(metadataItemsPath, backup) {
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
        resolve()
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
        const maxBackupSizeInBytes = this.serverSettings.maxBackupSize * 1000 * 1000 * 1000
        if (fsobj.processedBytes > maxBackupSizeInBytes) {
          Logger.error(`[BackupManager] Archiver is too large - aborting to prevent endless loop, Bytes Processed: ${fsobj.processedBytes}`)
          archive.abort()
          setTimeout(() => {
            this.removeBackup(backup)
            output.destroy('Backup too large') // Promise is reject in write stream error evt
          }, 500)
        }
      })

      // pipe archive data to the file
      archive.pipe(output)

      archive.directory(this.db.LibraryItemsPath, 'config/libraryItems')
      archive.directory(this.db.UsersPath, 'config/users')
      archive.directory(this.db.SessionsPath, 'config/sessions')
      archive.directory(this.db.LibrariesPath, 'config/libraries')
      archive.directory(this.db.SettingsPath, 'config/settings')
      archive.directory(this.db.CollectionsPath, 'config/collections')
      archive.directory(this.db.AuthorsPath, 'config/authors')
      archive.directory(this.db.SeriesPath, 'config/series')

      if (metadataItemsPath) {
        Logger.debug(`[BackupManager] Backing up Metadata Items "${metadataItemsPath}"`)
        archive.directory(metadataItemsPath, 'metadata-items')
      }
      archive.append(backup.detailsString, { name: 'details' })

      archive.finalize()
    })
  }
}
module.exports = BackupManager