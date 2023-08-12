const Logger = require('../Logger')

class BackupController {
  constructor() { }

  getAll(req, res) {
    res.json({
      backups: this.backupManager.backups.map(b => b.toJSON())
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
      Logger.debug(`Use X-Accel to serve static file ${req.backup.fullPath}`)
      return res.status(204).header({ 'X-Accel-Redirect': global.XAccel + req.backup.fullPath }).send()
    }
    res.sendFile(req.backup.fullPath)
  }

  apply(req, res) {
    this.backupManager.requestApplyBackup(req.backup, res)
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