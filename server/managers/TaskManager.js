const SocketAuthority = require('../SocketAuthority')
const Task = require('../objects/Task')

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
   * @param {string} title
   * @param {string} description
   * @param {boolean} showSuccess
   * @param {Object} [data]
   */
  createAndAddTask(action, title, description, showSuccess, data = {}) {
    const task = new Task()
    task.setData(action, title, description, showSuccess, data)
    this.addTask(task)
    return task
  }

  /**
   * Create new failed task and add
   *
   * @param {string} action
   * @param {string} title
   * @param {string} description
   * @param {string} errorMessage
   */
  createAndEmitFailedTask(action, title, description, errorMessage) {
    const task = new Task()
    task.setData(action, title, description, false)
    task.setFailed(errorMessage)
    SocketAuthority.emitter('task_started', task.toJSON())
    return task
  }
}
module.exports = new TaskManager()
