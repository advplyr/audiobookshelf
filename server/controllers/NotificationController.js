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

  async createNotification(req, res) {
    const success = this.db.notificationSettings.createNotification(req.body)

    if (success) {
      await this.db.updateEntity('settings', this.db.notificationSettings)
    }
    res.sendStatus(200)
  }

  getData(req, res) {
    res.json(this.notificationManager.getData())
  }

  async deleteNotification(req, res) {
    if (this.db.notificationSettings.removeNotification(req.notification.id)) {
      await this.db.updateEntity('settings', this.db.notificationSettings)
    }
    res.sendStatus(200)
  }

  async updateNotification(req, res) {
    const success = this.db.notificationSettings.updateNotification(req.body)

    if (success) {
      await this.db.updateEntity('settings', this.db.notificationSettings)
    }
    res.sendStatus(200)
  }

  sendNotificationTest(req, res) {
    this.notificationManager.onTest()
    res.sendStatus(200)
  }

  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(404)
    }

    if (req.params.id) {
      const notification = this.db.notificationSettings.getNotification(req.params.id)
      if (!notification) {
        return res.sendStatus(404)
      }
      req.notification = notification
    }

    next()
  }
}
module.exports = new NotificationController()