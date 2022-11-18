class TaskManager {
  constructor(emitter) {
    this.emitter = emitter

    this.tasks = []
  }

  addTask(task) {
    this.tasks.push(task)
    this.emitter('task_started', task.toJSON())
  }

  taskFinished(task) {
    if (this.tasks.some(t => t.id === task.id)) {
      this.tasks = this.tasks.filter(t => t.id !== task.id)
      this.emitter('task_finished', task.toJSON())
    }
  }
}
module.exports = TaskManager