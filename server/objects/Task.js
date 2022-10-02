const { getId } = require('../utils/index')

class Task {
  constructor() {
    this.id = null
    this.action = null // e.g. embed-metadata, encode-m4b, etc
    this.data = null // additional info for the action like libraryItemId

    this.title = null
    this.description = null
    this.error = null

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
      isFailed: this.isFailed,
      isFinished: this.isFinished,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt
    }
  }

  setData(action, title, description, data = {}) {
    this.id = getId(action)
    this.action = action
    this.data = { ...data }
    this.title = title
    this.description = description
    this.startedAt = Date.now()
  }

  setFailed(message) {
    this.error = message
    this.isFailed = true
    this.failedAt = Date.now()
    this.setFinished()
  }

  setFinished() {
    this.isFinished = true
    this.finishedAt = Date.now()
  }
}
module.exports = Task