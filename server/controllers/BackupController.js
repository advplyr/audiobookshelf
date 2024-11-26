const { Request, Response, NextFunction } = require('express')
const Path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const Database = require('../Database')
const fileUtils = require('../utils/fileUtils')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class BackupController {
  constructor() {}

  /**
   * GET: /api/backups
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  getAll(req, res) {
    res.json({
      backups: this.backupManager.backups.map((b) => b.toJSON()),
      backupLocation: this.backupManager.backupPath,
      backupPathEnvSet: this.backupManager.backupPathEnvSet
    })
  }

  /**
   * POST: /api/backups
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  create(req, res) {
    this.backupManager.requestCreateBackup(res)
  }

  /**
   * DELETE: /api/backups/:id
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async delete(req, res) {
    await this.backupManager.removeBackup(req.backup)

    res.json({
      backups: this.backupManager.backups.map((b) => b.toJSON())
    })
  }

  /**
   * POST: /api/backups/upload
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  upload(req, res) {
    if (!req.files.file) {
      Logger.error('[BackupController] Upload backup invalid')
      return res.sendStatus(500)
    }
    this.backupManager.uploadBackup(req, res)
  }

  /**
   * PATCH: /api/backups/path
   * Update the backup path
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updatePath(req, res) {
    // Validate path is not empty and is a string
    if (!req.body.path || !req.body.path?.trim?.()) {
      Logger.error('[BackupController] Update backup path invalid')
      return res.status(400).send('Invalid request body. Must include path.')
    }

    const newBackupPath = fileUtils.filePathToPOSIX(Path.resolve(req.body.path))

    if (newBackupPath === this.backupManager.backupPath) {
      Logger.debug(`[BackupController] Backup path unchanged: ${newBackupPath}`)
      return res.status(200).send('Backup path unchanged')
    }

    Logger.info(`[BackupController] Updating backup path to "${newBackupPath}" from "${this.backupManager.backupPath}"`)

    // Check if backup path is set in environment variable
    if (process.env.BACKUP_PATH) {
      Logger.warn(`[BackupController] Backup path is set in environment variable BACKUP_PATH. Backup path will be reverted on server restart.`)
    }

    // Validate backup path is writable and create folder if it does not exist
    try {
      const direxists = await fs.pathExists(newBackupPath)
      if (!direxists) {
        // If folder does not exist try to make it
        await fs.mkdir(newBackupPath)
      }
    } catch (error) {
      Logger.error(`[BackupController] updatePath: Failed to ensure backup path "${newBackupPath}"`, error)
      return res.status(400).send(`Invalid backup path "${req.body.path}"`)
    }

    Database.serverSettings.backupPath = newBackupPath
    await Database.updateServerSettings()

    await this.backupManager.reload()

    res.sendStatus(200)
  }

  /**
   * GET: /api/backups/:id/download
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  download(req, res) {
    if (global.XAccel) {
      const encodedURI = fileUtils.encodeUriPath(global.XAccel + req.backup.fullPath)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    res.setHeader('Content-disposition', 'attachment; filename=' + req.backup.filename)

    res.sendFile(req.backup.fullPath)
  }

  /**
   * GET: /api/backups/:id/apply
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  apply(req, res) {
    this.backupManager.requestApplyBackup(this.apiCacheManager, req.backup, res)
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[BackupController] Non-admin user "${req.user.username}" attempting to access backups`)
      return res.sendStatus(403)
    }

    if (req.params.id) {
      req.backup = this.backupManager.backups.find((b) => b.id === req.params.id)
      if (!req.backup) {
        return res.sendStatus(404)
      }
    }

    next()
  }
}
module.exports = new BackupController()
