class Notification {
  constructor(notification = null) {
    this.id = null
    this.libraryId = null
    this.eventName = ''
    this.urls = []
    this.titleTemplate = ''
    this.bodyTemplate = ''
    this.type = 'info'
    this.enabled = false

    this.createdAt = null

    if (notification) {
      this.construct(notification)
    }
  }

  construct(notification) {
    this.id = notification.id
    this.libraryId = notification.libraryId || null
    this.eventName = notification.eventName
    this.urls = notification.urls || []
    this.titleTemplate = notification.titleTemplate || ''
    this.bodyTemplate = notification.bodyTemplate || ''
    this.type = notification.type || 'info'
    this.enabled = !!notification.enabled
    this.createdAt = notification.createdAt
  }

  toJSON() {
    return {
      id: this.id,
      libraryId: this.libraryId,
      eventName: this.eventName,
      urls: this.urls,
      titleTemplate: this.titleTemplate,
      bodyTemplate: this.bodyTemplate,
      enabled: this.enabled,
      type: this.type,
      createdAt: this.createdAt
    }
  }

  parseTitleTemplate(data) {
    // TODO: Implement template parsing
    return 'Test Title'
  }

  parseBodyTemplate(data) {
    // TODO: Implement template parsing
    return 'Test Body'
  }

  getApprisePayload(data) {
    return {
      urls: this.urls,
      title: this.parseTitleTemplate(data),
      body: this.parseBodyTemplate(data)
    }
  }
}
module.exports = Notification