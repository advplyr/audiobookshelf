const Logger = require('../Logger')

class NotificationController {
  constructor() { }

  get(req, res) {
    res.json(this.db.notificationSettings)
  }

  async update(req, res) {
    const updated = this.db.notificationSettings.update(req.body)
    if (updated) {
      await this.db.updateEntity('settings', this.db.notificationSettings)
    }
    res.sendStatus(200)
  }

  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(404)
    }
    next()
  }
}
module.exports = new NotificationController()