import Logger from '../../Logger'
import Notification from '../Notification'
import utils from '../../utils'

const { isNullOrNaN } = utils

type NotificationSettingsData = {
  appriseType?: string
  appriseApiUrl?: string | null
  notifications?: NonNullable<ConstructorParameters<typeof Notification>[0]>[] | null
  maxFailedAttempts?: number
  maxNotificationQueue?: number
  notificationDelay?: number
}

type NotificationSettingsUpdate = {
  appriseApiUrl?: string | null
  maxFailedAttempts?: unknown
  maxNotificationQueue?: unknown
}

class NotificationSettings {
  declare id: string
  declare appriseType: string | undefined
  declare appriseApiUrl: string | null
  declare notifications: Notification[]
  declare maxFailedAttempts: number
  declare maxNotificationQueue: number
  declare notificationDelay: number

  constructor(settings: NotificationSettingsData | null = null) {
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

  construct(settings: NotificationSettingsData) {
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
  getHasActiveNotificationsForEvent(eventName: string) {
    return this.notifications.some((n) => n.eventName === eventName && n.enabled)
  }

  /**
   * @param {string} eventName
   * @returns {Notification[]}
   */
  getActiveNotificationsForEvent(eventName: string) {
    return this.notifications.filter((n) => n.eventName === eventName && n.enabled)
  }

  getNotification(id: string) {
    return this.notifications.find((n) => n.id === id)
  }

  removeNotification(id: string) {
    if (this.notifications.some((n) => n.id === id)) {
      this.notifications = this.notifications.filter((n) => n.id !== id)
      return true
    }
    return false
  }

  update(payload: NotificationSettingsUpdate | null | undefined) {
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

  createNotification(payload: Parameters<Notification['setData']>[0] | null | undefined) {
    if (!payload) return false
    if (!payload.eventName || !payload.urls.length) return false

    const notification = new Notification()
    notification.setData(payload)
    this.notifications.push(notification)
    return true
  }

  updateNotification(payload: (Parameters<Notification['update']>[0] & { id?: string }) | null | undefined) {
    if (!payload) return false
    const notification = this.notifications.find((n) => n.id === payload.id)
    if (!notification) {
      Logger.error(`[NotificationSettings] updateNotification: Notification not found ${payload.id}`)
      return false
    }

    return notification.update(payload)
  }
}
export = NotificationSettings
