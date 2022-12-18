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
    var backup = this.backupManager.backups.find(b => b.id === req.params.id)
    if (!backup) {
      return res.sendStatus(404)
    }
    await this.backupManager.removeBackup(backup)

    res.json({
      backups: this.backupManager.backups.map(b => b.toJSON())
    })
  }

  async upload(req, res) {
    if (!req.files.file) {
      Logger.error('[BackupController] Upload backup invalid')
      return res.sendStatus(500)
    }
    this.backupManager.uploadBackup(req, res)
  }

  async apply(req, res) {
    var backup = this.backupManager.backups.find(b => b.id === req.params.id)
    if (!backup) {
      return res.sendStatus(404)
    }
    await this.backupManager.requestApplyBackup(backup)
    res.sendStatus(200)
  }

  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[BackupController] Non-admin user attempting to access backups`, req.user)
      return res.sendStatus(403)
    }
    next()
  }
}
module.exports = new BackupController()