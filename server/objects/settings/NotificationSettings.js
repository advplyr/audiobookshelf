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
    this.notifications = (settings.notifications || []).map(n => ({ ...n }))
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

  update(payload) {
    if (!payload) return false
    if (payload.appriseApiUrl !== this.appriseApiUrl) {
      this.appriseApiUrl = payload.appriseApiUrl || null
      return true
    }
    return false
  }

  addNewEvent(payload) {
    if (!payload) return false
    // TODO: validate

    const notification = new Notification()
    notification.setData(payload)
    this.notifications.push(notification)
    return true
  }

  updateEvent(payload) {
    if (!payload) return false
    const notification = this.notifications.find(n => n.id === payload.id)
    if (!notification) return false

    return notification.update(payload)
  }
}
module.exports = NotificationSettings