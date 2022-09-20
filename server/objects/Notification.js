class Notification {
  constructor(notification = null) {
    this.id = null
    this.eventName = ''
    this.urls = []
    this.titleTemplate = ''
    this.bodyTemplate = ''
    this.enabled = false

    this.createdAt = null

    if (notification) {
      this.construct(notification)
    }
  }

  construct(notification) {
    this.id = notification.id
    this.eventName = notification.eventName
    this.urls = notification.urls || []
    this.titleTemplate = notification.titleTemplate || ''
    this.bodyTemplate = notification.bodyTemplate || ''
    this.enabled = !!notification.enabled
    this.createdAt = notification.createdAt
  }

  toJSON() {
    return {
      id: this.id,
      eventName: this.eventName,
      urls: this.urls,
      titleTemplate: this.titleTemplate,
      bodyTemplate: this.bodyTemplate,
      enabled: this.enabled,
      createdAt: this.createdAt
    }
  }
}
module.exports = Notification