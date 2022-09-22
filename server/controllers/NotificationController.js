const Logger = require('../Logger')

class NotificationController {
  constructor() { }

  get(req, res) {
    res.json({
      data: this.notificationManager.getData(),
      settings: this.db.notificationSettings
    })
  }

  async update(req, res) {
    const updated = this.db.notificationSettings.update(req.body)
    if (updated) {
      await this.db.updateEntity('settings', this.db.notificationSettings)
    }
    res.sendStatus(200)
  }

  async createEvent(req, res) {
    const success = this.db.notificationSettings.addNewEvent(req.body)

    if (success) {
      await this.db.updateEntity('settings', this.db.notificationSettings)
    }
    res.sendStatus(200)
  }

  async updateEvent(req, res) {
    const success = this.db.notificationSettings.updateEvent(req.body)

    if (success) {
      await this.db.updateEntity('settings', this.db.notificationSettings)
    }
    res.sendStatus(200)
  }

  getData(req, res) {
    res.json(this.notificationManager.getData())
  }

  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(404)
    }
    next()
  }
}
module.exports = new NotificationController()