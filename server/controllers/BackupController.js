const Logger = require('../Logger')

class BackupController {
  constructor() { }

  async create(req, res) {
    if (!req.user.isRoot) {
      Logger.error(`[BackupController] Non-Root user attempting to craete backup`, req.user)
      return res.sendStatus(403)
    }
    this.backupManager.requestCreateBackup(res)
  }

  async delete(req, res) {
    if (!req.user.isRoot) {
      Logger.error(`[BackupController] Non-Root user attempting to delete backup`, req.user)
      return res.sendStatus(403)
    }
    var backup = this.backupManager.backups.find(b => b.id === req.params.id)
    if (!backup) {
      return res.sendStatus(404)
    }
    await this.backupManager.removeBackup(backup)
    res.json(this.backupManager.backups.map(b => b.toJSON()))
  }

  async upload(req, res) {
    if (!req.user.isRoot) {
      Logger.error(`[BackupController] Non-Root user attempting to upload backup`, req.user)
      return res.sendStatus(403)
    }
    if (!req.files.file) {
      Logger.error('[BackupController] Upload backup invalid')
      return res.sendStatus(500)
    }
    this.backupManager.uploadBackup(req, res)
  }

  async apply(req, res) {
    if (!req.user.isRoot) {
      Logger.error(`[BackupController] Non-Root user attempting to apply backup`, req.user)
      return res.sendStatus(403)
    }
    var backup = this.backupManager.backups.find(b => b.id === req.params.id)
    if (!backup) {
      return res.sendStatus(404)
    }
    await this.backupManager.requestApplyBackup(backup)
    res.sendStatus(200)
  }
}
module.exports = new BackupController()