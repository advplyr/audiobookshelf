import type { RequestHandler } from 'express'
import Task from '../../../server/objects/Task'
import TaskManager from '../../../server/managers/TaskManager'
import ApiCacheManager from '../../../server/managers/ApiCacheManager'

export function managerContracts() {
  const task: Task = TaskManager.createAndAddTask('import', { text: 'Import' }, null, true, null)
  TaskManager.taskFinished(task)
  const cache = new ApiCacheManager()
  const middleware: RequestHandler = cache.middleware
  cache.clear({ model: { name: 'mediaProgress' } }, 'afterBulkUpdate')
  return { task, middleware }
}
