const SocketAuthority = require('../SocketAuthority')

class TaskManager {
  constructor() {
    this.tasks = []
  }

  addTask(task) {
    this.tasks.push(task)
    SocketAuthority.emitter('task_started', task.toJSON())
  }

  taskFinished(task) {
    if (this.tasks.some(t => t.id === task.id)) {
      this.tasks = this.tasks.filter(t => t.id !== task.id)
      SocketAuthority.emitter('task_finished', task.toJSON())
    }
  }
}
module.exports = TaskManager