const Logger = require('../Logger')
const { encodeUriPath } = require('../utils/fileUtils')

class BackupController {
  constructor() { }

  getAll(req, res) {
    res.json({
      backups: this.backupManager.backups.map(b => b.toJSON()),
      backupLocation: this.backupManager.backupLocation
    })
  }

  create(req, res) {
    this.backupManager.requestCreateBackup(res)
  }

  async delete(req, res) {
    await this.backupManager.removeBackup(req.backup)

    res.json({
      backups: this.backupManager.backups.map(b => b.toJSON())
    })
  }

  upload(req, res) {
    if (!req.files.file) {
      Logger.error('[BackupController] Upload backup invalid')
      return res.sendStatus(500)
    }
    this.backupManager.uploadBackup(req, res)
  }

  /**
   * api/backups/:id/download
   * 
   * @param {*} req 
   * @param {*} res 
   */
  download(req, res) {
    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + req.backup.fullPath)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    res.setHeader('Content-disposition', 'attachment; filename=' + req.backup.filename)

    res.sendFile(req.backup.fullPath)
  }

  /**
   * 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  apply(req, res) {
    this.backupManager.requestApplyBackup(this.apiCacheManager, req.backup, res)
  }

  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[BackupController] Non-admin user attempting to access backups`, req.user)
      return res.sendStatus(403)
    }

    if (req.params.id) {
      req.backup = this.backupManager.backups.find(b => b.id === req.params.id)
      if (!req.backup) {
        return res.sendStatus(404)
      }
    }

    next()
  }
}
module.exports = new BackupController()
