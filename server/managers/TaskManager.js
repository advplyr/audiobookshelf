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
   * Emit task event. Tasks with a userId are only emitted to that user,
   * all other tasks are emitted to every client
   *
   * @param {string} evt
   * @param {Task} task
   */
  emitTask(evt, task) {
    if (task.userId) {
      SocketAuthority.clientEmitter(task.userId, evt, task.toJSON())
    } else {
      SocketAuthority.emitter(evt, task.toJSON())
    }
  }

  /**
   * Add task and emit socket task_started event
   *
   * @param {Task} task
   */
  addTask(task) {
    this.tasks.push(task)
    this.emitTask('task_started', task)
  }

  /**
   * Emit task_updated event for a task that is still running
   *
   * @param {Task} task
   */
  taskUpdated(task) {
    if (this.tasks.some((t) => t.id === task.id)) {
      this.emitTask('task_updated', task)
    }
  }

  /**
   * Remove task and emit task_finished event
   *
   * @param {Task} task
   */
  taskFinished(task) {
    if (this.tasks.some((t) => t.id === task.id)) {
      this.tasks = this.tasks.filter((t) => t.id !== task.id)
      this.emitTask('task_finished', task)
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
   * @param {string} [userId] when set the task is only emitted to this user
   */
  createAndAddTask(action, titleString, descriptionString, showSuccess, data = {}, userId = null) {
    const task = new Task()
    task.setData(action, titleString, descriptionString, showSuccess, data, userId)
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
   * @param {string} [userId] when set the task is only emitted to this user
   */
  createAndEmitFailedTask(action, titleString, descriptionString, errorMessageString, userId = null) {
    const task = new Task()
    task.setData(action, titleString, descriptionString, false, {}, userId)
    task.setFailed(errorMessageString)
    this.emitTask('task_started', task)
    return task
  }
}
module.exports = new TaskManager()
