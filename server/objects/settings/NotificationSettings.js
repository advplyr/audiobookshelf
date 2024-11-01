const Logger = require('../../Logger')
const Notification = require('../Notification')
const { isNullOrNaN } = require('../../utils')

class NotificationSettings {
  constructor(settings = null) {
    this.id = 'notification-settings'
    this.appriseType = 'api'
    this.appriseApiUrl = null
    this.notifications = []
    this.maxFailedAttempts = 5
    this.maxNotificationQueue = 20 // once reached events will be ignored
    this.notificationDelay = 1000 // ms delay between firing notifications

    if (settings) {
      this.construct(settings)
    }
  }

  construct(settings) {
    this.appriseType = settings.appriseType
    this.appriseApiUrl = settings.appriseApiUrl || null
    this.notifications = (settings.notifications || []).map((n) => new Notification(n))
    this.maxFailedAttempts = settings.maxFailedAttempts || 5
    this.maxNotificationQueue = settings.maxNotificationQueue || 20
    this.notificationDelay = settings.notificationDelay || 1000
  }

  toJSON() {
    return {
      id: this.id,
      appriseType: this.appriseType,
      appriseApiUrl: this.appriseApiUrl,
      notifications: this.notifications.map((n) => n.toJSON()),
      maxFailedAttempts: this.maxFailedAttempts,
      maxNotificationQueue: this.maxNotificationQueue,
      notificationDelay: this.notificationDelay
    }
  }

  get isUseable() {
    return !!this.appriseApiUrl
  }

  /**
   * @param {string} eventName
   * @returns {boolean} - TRUE if there are active notifications for the event
   */
  getHasActiveNotificationsForEvent(eventName) {
    return this.notifications.some((n) => n.eventName === eventName && n.enabled)
  }

  /**
   * @param {string} eventName
   * @returns {Notification[]}
   */
  getActiveNotificationsForEvent(eventName) {
    return this.notifications.filter((n) => n.eventName === eventName && n.enabled)
  }

  getNotification(id) {
    return this.notifications.find((n) => n.id === id)
  }

  removeNotification(id) {
    if (this.notifications.some((n) => n.id === id)) {
      this.notifications = this.notifications.filter((n) => n.id !== id)
      return true
    }
    return false
  }

  update(payload) {
    if (!payload) return false

    var hasUpdates = false
    if (payload.appriseApiUrl !== this.appriseApiUrl) {
      this.appriseApiUrl = payload.appriseApiUrl || null
      hasUpdates = true
    }

    const _maxFailedAttempts = isNullOrNaN(payload.maxFailedAttempts) ? 5 : Number(payload.maxFailedAttempts)
    if (_maxFailedAttempts !== this.maxFailedAttempts) {
      this.maxFailedAttempts = _maxFailedAttempts
      hasUpdates = true
    }

    const _maxNotificationQueue = isNullOrNaN(payload.maxNotificationQueue) ? 20 : Number(payload.maxNotificationQueue)
    if (_maxNotificationQueue !== this.maxNotificationQueue) {
      this.maxNotificationQueue = _maxNotificationQueue
      hasUpdates = true
    }

    return hasUpdates
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
    const notification = this.notifications.find((n) => n.id === payload.id)
    if (!notification) {
      Logger.error(`[NotificationSettings] updateNotification: Notification not found ${payload.id}`)
      return false
    }

    return notification.update(payload)
  }
}
module.exports = NotificationSettings
