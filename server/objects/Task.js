const uuidv4 = require("uuid").v4

class Task {
  constructor() {
    /** @type {string} */
    this.id = null
    /** @type {string} */
    this.action = null // e.g. embed-metadata, encode-m4b, etc
    /** @type {Object} custom data */
    this.data = null // additional info for the action like libraryItemId

    /** @type {string} */
    this.title = null
    /** @type {string} */
    this.description = null
    /** @type {string} */
    this.error = null
    /** @type {boolean} client should keep the task visible after success */
    this.showSuccess = false

    /** @type {boolean} */
    this.isFailed = false
    /** @type {boolean} */
    this.isFinished = false

    /** @type {number} */
    this.startedAt = null
    /** @type {number} */
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

  /**
   * Set initial task data
   * 
   * @param {string} action 
   * @param {string} title 
   * @param {string} description 
   * @param {boolean} showSuccess 
   * @param {Object} [data] 
   */
  setData(action, title, description, showSuccess, data = {}) {
    this.id = uuidv4()
    this.action = action
    this.data = { ...data }
    this.title = title
    this.description = description
    this.showSuccess = showSuccess
    this.startedAt = Date.now()
  }

  /**
   * Set task as failed
   * 
   * @param {string} message error message
   */
  setFailed(message) {
    this.error = message
    this.isFailed = true
    this.failedAt = Date.now()
    this.setFinished()
  }

  /**
   * Set task as finished
   * 
   * @param {string} [newDescription] update description
   */
  setFinished(newDescription = null) {
    if (newDescription) {
      this.description = newDescription
    }
    this.isFinished = true
    this.finishedAt = Date.now()
  }
}
module.exports = Task