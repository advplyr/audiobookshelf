const SocketAuthority = require('../SocketAuthority')
const Task = require('../objects/Task')

/**
 * @typedef TaskString
 * @property {string} text
 * @property {string} key
 * @property {string[]} [subs]
 */

class TaskManager {
  constructor() {
    /** @type {Task[]} */
    this.tasks = []
  }

  /**
   * Add task and emit socket task_started event
   *
   * @param {Task} task
   */
  addTask(task) {
    this.tasks.push(task)
    SocketAuthority.emitter('task_started', task.toJSON())
  }

  /**
   * Remove task and emit task_finished event
   *
   * @param {Task} task
   */
  taskFinished(task) {
    if (this.tasks.some((t) => t.id === task.id)) {
      this.tasks = this.tasks.filter((t) => t.id !== task.id)
      SocketAuthority.emitter('task_finished', task.toJSON())
    }
  }

  /**
   * Create new task and add
   *
   * @param {string} action
   * @param {TaskString} titleString
   * @param {TaskString|null} descriptionString
   * @param {boolean} showSuccess
   * @param {Object} [data]
   */
  createAndAddTask(action, titleString, descriptionString, showSuccess, data = {}) {
    const task = new Task()
    task.setData(action, titleString, descriptionString, showSuccess, data)
    this.addTask(task)
    return task
  }

  /**
   * Create new failed task and add
   *
   * @param {string} action
   * @param {TaskString} titleString
   * @param {TaskString|null} descriptionString
   * @param {TaskString} errorMessageString
   */
  createAndEmitFailedTask(action, titleString, descriptionString, errorMessageString) {
    const task = new Task()
    task.setData(action, titleString, descriptionString, false)
    task.setFailed(errorMessageString)
    SocketAuthority.emitter('task_started', task.toJSON())
    return task
  }
}
module.exports = new TaskManager()
