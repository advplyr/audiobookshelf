/**
 * Called on initialization of the plugin
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 */
module.exports.init = async (context) => {
  context.Logger.info('[ExamplePlugin] Example plugin initialized')

  context.Database.mediaProgressModel.addHook('afterSave', (instance, options) => {
    context.Logger.debug(`[ExamplePlugin] mediaProgressModel afterSave hook for mediaProgress ${instance.id}`)
    handleMediaProgressUpdate(context, instance)
  })

  sendAdminMessageToast(context)
}

/**
 * Called when an extension action is triggered
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 * @param {string} actionName
 * @param {string} target
 * @param {*} data
 */
module.exports.onAction = async (context, actionName, target, data) => {
  context.Logger.info('[ExamplePlugin] Example plugin onAction', actionName, target, data)
}

/**
 * Called when the plugin config page is saved
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 * @param {*} config
 */
module.exports.onConfigSave = async (context, config) => {
  context.Logger.info('[ExamplePlugin] Example plugin onConfigSave', config)

  createTask(context)
}

//
// Helper functions
//

/**
 * Scrobble media progress update
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 * @param {import('../../../server/models/MediaProgress')} mediaProgress
 */
async function handleMediaProgressUpdate(context, mediaProgress) {
  const mediaItem = await mediaProgress.getMediaItem()
  if (!mediaItem) {
    context.Logger.error(`[ExamplePlugin] Media item not found for mediaProgress ${mediaProgress.id}`)
  } else {
    const mediaProgressDuration = mediaProgress.duration
    const progressPercent = mediaProgressDuration > 0 ? (mediaProgress.currentTime / mediaProgressDuration) * 100 : 0
    context.Logger.info(`[ExamplePlugin] Media progress update for "${mediaItem.title}" ${Math.round(progressPercent)}%`)
  }
}

/**
 * Test socket authority
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 */
async function sendAdminMessageToast(context) {
  setTimeout(() => {
    context.SocketAuthority.adminEmitter('admin_message', 'Hello from ExamplePlugin!')
  }, 10000)
}

/**
 * Test task manager
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 */
async function createTask(context) {
  const task = context.TaskManager.createAndAddTask('example_action', { text: 'Example Task' }, { text: 'This is an example task' }, true)
  setTimeout(() => {
    task.setFinished({ text: 'Example Task Finished' })
    context.TaskManager.taskFinished(task)
  }, 5000)
}
