import type { Request, Response, NextFunction } from 'express'
import type User from '../models/User'
import type Backup from '../objects/Backup'
import type BackupManager from '../managers/BackupManager'
import type ApiCacheManager from '../managers/ApiCacheManager'
import Path from 'path'
import fs from '../libs/fsExtra'
import Logger from '../Logger'
import Database from '../Database'
import fileUtils from '../utils/fileUtils'

type RequestWithUser = Request & { user: User }
type RequestWithBackup = RequestWithUser & { backup: Backup }
type BackupContext = { backupManager: BackupManager; apiCacheManager: ApiCacheManager }

class BackupController {
  constructor() {}

  /**
   * GET: /api/backups
   */
  getAll(this: BackupContext, _req: RequestWithUser, res: Response) {
    res.json({
      backups: this.backupManager.backups.map((b) => b.toJSON()),
      backupLocation: this.backupManager.backupPath,
      backupPathEnvSet: this.backupManager.backupPathEnvSet
    })
  }

  /**
   * POST: /api/backups
   */
  create(this: BackupContext, _req: RequestWithUser, res: Response) {
    void this.backupManager.requestCreateBackup(res)
  }

  /**
   * DELETE: /api/backups/:id
   */
  async delete(this: BackupContext, req: RequestWithBackup, res: Response) {
    await this.backupManager.removeBackup(req.backup)

    res.json({
      backups: this.backupManager.backups.map((b) => b.toJSON())
    })
  }

  /**
   * POST: /api/backups/upload
   */
  upload(this: BackupContext, req: RequestWithUser & { files: { file?: Parameters<BackupManager['uploadBackup']>[0]['files']['file'] } }, res: Response) {
    if (!req.files.file) {
      Logger.error('[BackupController] Upload backup invalid')
      return res.sendStatus(500)
    }
    void this.backupManager.uploadBackup(req as Parameters<BackupManager['uploadBackup']>[0], res)
  }

  /**
   * PATCH: /api/backups/path
   * Update the backup path
   */
  async updatePath(this: BackupContext, req: Request<Record<string, string>, unknown, { path?: string }> & { user: User }, res: Response) {
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

    Database.serverSettings!.backupPath = newBackupPath
    await Database.updateServerSettings()

    await this.backupManager.reload()

    res.sendStatus(200)
  }

  /**
   * GET: /api/backups/:id/download
   */
  download(req: RequestWithBackup, res: Response) {
    if (global.XAccel) {
      const encodedURI = fileUtils.encodeUriPath(global.XAccel + req.backup.fullPath)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    res.setHeader('Content-disposition', 'attachment; filename=' + req.backup.filename)

    res.sendFile(req.backup.fullPath!)
  }

  /**
   * GET: /api/backups/:id/apply
   */
  apply(this: BackupContext, req: RequestWithBackup, res: Response) {
    void this.backupManager.requestApplyBackup(this.apiCacheManager, req.backup, res)
  }

  middleware(this: BackupContext, req: RequestWithUser & { backup?: Backup }, res: Response, next: NextFunction) {
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
export = new BackupController()
