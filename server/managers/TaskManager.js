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
    if (this.tasks.some(t => t.id === task.id)) {
      this.tasks = this.tasks.filter(t => t.id !== task.id)
      SocketAuthority.emitter('task_finished', task.toJSON())
    }
  }
}
module.exports = new TaskManager()