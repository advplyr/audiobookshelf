const { getId } = require('../utils/index')

class Task {
  constructor() {
    this.id = null
    this.action = null // e.g. embed-metadata, encode-m4b, etc
    this.data = null // additional info for the action like libraryItemId

    this.title = null
    this.description = null
    this.error = null
    this.showSuccess = false // If true client side should keep the task visible after success

    this.isFailed = false
    this.isFinished = false

    this.startedAt = null
    this.finishedAt = null
  }

  toJSON() {
    return {
      id: this.id,
      action: this.action,
      data: this.data ? { ...this.data } : {},
      title: this.title,
      description: this.description,
      error: this.error,
      showSuccess: this.showSuccess,
      isFailed: this.isFailed,
      isFinished: this.isFinished,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt
    }
  }

  setData(action, title, description, showSuccess, data = {}) {
    this.id = getId(action)
    this.action = action
    this.data = { ...data }
    this.title = title
    this.description = description
    this.showSuccess = showSuccess
    this.startedAt = Date.now()
  }

  setFailed(message) {
    this.error = message
    this.isFailed = true
    this.failedAt = Date.now()
    this.setFinished()
  }

  setFinished(newDescription = null) {
    if (newDescription) {
      this.description = newDescription
    }
    this.isFinished = true
    this.finishedAt = Date.now()
  }
}
module.exports = Task