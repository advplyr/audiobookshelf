const Logger = require('../Logger')
const { version } = require('../../package.json')

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

  getData(req, res) {
    res.json(this.notificationManager.getData())
  }

  async fireTestEvent(req, res) {
    await this.notificationManager.triggerNotification('onTest', { version: `v${version}` }, req.query.fail === '1')
    res.sendStatus(200)
  }

  async createNotification(req, res) {
    const success = this.db.notificationSettings.createNotification(req.body)

    if (success) {
      await this.db.updateEntity('settings', this.db.notificationSettings)
    }
    res.json(this.db.notificationSettings)
  }

  async deleteNotification(req, res) {
    if (this.db.notificationSettings.removeNotification(req.notification.id)) {
      await this.db.updateEntity('settings', this.db.notificationSettings)
    }
    res.json(this.db.notificationSettings)
  }

  async updateNotification(req, res) {
    const success = this.db.notificationSettings.updateNotification(req.body)
    if (success) {
      await this.db.updateEntity('settings', this.db.notificationSettings)
    }
    res.json(this.db.notificationSettings)
  }

  async sendNotificationTest(req, res) {
    if (!this.db.notificationSettings.isUseable) return res.status(500).send('Apprise is not configured')

    const success = await this.notificationManager.sendTestNotification(req.notification)
    if (success) res.sendStatus(200)
    else res.sendStatus(500)
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