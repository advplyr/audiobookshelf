const Logger = require('../../Logger')
const Notification = require('../Notification')

class NotificationSettings {
  constructor(settings = null) {
    this.id = 'notification-settings'
    this.appriseType = 'api'
    this.appriseApiUrl = null
    this.notifications = []

    if (settings) {
      this.construct(settings)
    }
  }

  construct(settings) {
    this.appriseType = settings.appriseType
    this.appriseApiUrl = settings.appriseApiUrl || null
    this.notifications = (settings.notifications || []).map(n => new Notification(n))
  }

  toJSON() {
    return {
      id: this.id,
      appriseType: this.appriseType,
      appriseApiUrl: this.appriseApiUrl,
      notifications: this.notifications.map(n => n.toJSON())
    }
  }

  get isUseable() {
    return !!this.appriseApiUrl
  }

  getNotificationsForEvent(eventName) {
    return this.notifications.filter(n => n.eventName === eventName)
  }

  getNotification(id) {
    return this.notifications.find(n => n.id === id)
  }

  removeNotification(id) {
    if (this.notifications.some(n => n.id === id)) {
      this.notifications = this.notifications.filter(n => n.id !== id)
      return true
    }
    return false
  }

  update(payload) {
    if (!payload) return false
    if (payload.appriseApiUrl !== this.appriseApiUrl) {
      this.appriseApiUrl = payload.appriseApiUrl || null
      return true
    }
    return false
  }

  createNotification(payload) {
    if (!payload) return false
    if (!payload.eventName || !payload.urls.length) return false

    const notification = new Notification()
    notification.setData(payload)
    this.notifications.push(notification)
    return true
  }

  updateNotification(payload) {
    if (!payload) return false
    const notification = this.notifications.find(n => n.id === payload.id)
    if (!notification) {
      Logger.error(`[NotificationSettings] updateNotification: Notification not found ${payload.id}`)
      return false
    }

    return notification.update(payload)
  }
}
module.exports = NotificationSettings