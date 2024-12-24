/**
 * Called on initialization of the plugin
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 */
module.exports.init = async (context) => {
  // Set default config on first init
  if (!context.pluginInstance.config) {
    context.Logger.info('[ExamplePlugin] First init. Setting default config')
    context.pluginInstance.config = {
      requestAddress: '',
      enable: false
    }
    await context.pluginInstance.save()
  }

  context.Database.mediaProgressModel.addHook('afterSave', (instance, options) => {
    context.Logger.debug(`[ExamplePlugin] mediaProgressModel afterSave hook for mediaProgress ${instance.id}`)
    handleMediaProgressUpdate(context, instance)
  })

  context.Logger.info('[ExamplePlugin] Example plugin initialized')
}

/**
 * Called when an extension action is triggered
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 * @param {string} actionName
 * @param {string} target
 * @param {*} data
 * @returns {Promise<boolean|{error: string}>}
 */
module.exports.onAction = async (context, actionName, target, data) => {
  context.Logger.info('[ExamplePlugin] Example plugin onAction', actionName, target, data)

  createTask(context)

  return true
}

/**
 * Called when the plugin config page is saved
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 * @param {*} config
 * @returns {Promise<boolean|{error: string}>}
 */
module.exports.onConfigSave = async (context, config) => {
  context.Logger.info('[ExamplePlugin] Example plugin onConfigSave', config)

  if (!config.requestAddress || typeof config.requestAddress !== 'string') {
    context.Logger.error('[ExamplePlugin] Invalid request address')
    return {
      error: 'Invalid request address'
    }
  }
  if (typeof config.enable !== 'boolean') {
    context.Logger.error('[ExamplePlugin] Invalid enable value')
    return {
      error: 'Invalid enable value'
    }
  }

  // Config would need to be validated
  const updatedConfig = {
    requestAddress: config.requestAddress,
    enable: config.enable
  }
  context.pluginInstance.config = updatedConfig
  await context.pluginInstance.save()
  context.Logger.info('[ExamplePlugin] Example plugin config saved', updatedConfig)
  return true
}

//
// Helper functions
//
let numProgressSyncs = 0

/**
 * Send media progress update to external requestAddress defined in config
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 * @param {import('../../../server/models/MediaProgress')} mediaProgress
 */
async function handleMediaProgressUpdate(context, mediaProgress) {
  // Need to reload the model instance since it was passed in during init and may have values changed
  await context.pluginInstance.reload()

  if (!context.pluginInstance.config?.enable) {
    return
  }
  const requestAddress = context.pluginInstance.config.requestAddress
  if (!requestAddress) {
    context.Logger.error('[ExamplePlugin] Request address not set')
    return
  }

  const mediaItem = await mediaProgress.getMediaItem()
  if (!mediaItem) {
    context.Logger.error(`[ExamplePlugin] Media item not found for mediaProgress ${mediaProgress.id}`)
  } else {
    const mediaProgressDuration = mediaProgress.duration
    const progressPercent = mediaProgressDuration > 0 ? (mediaProgress.currentTime / mediaProgressDuration) * 100 : 0
    context.Logger.info(`[ExamplePlugin] Media progress update for "${mediaItem.title}" ${Math.round(progressPercent)}% (total numProgressSyncs: ${numProgressSyncs})`)

    fetch(requestAddress, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: mediaItem.title,
        progress: progressPercent
      })
    })
      .then(() => {
        context.Logger.info(`[ExamplePlugin] Media progress update sent for "${mediaItem.title}" ${Math.round(progressPercent)}%`)
        numProgressSyncs++
        sendAdminMessageToast(context, `Synced "${mediaItem.title}" (total syncs: ${numProgressSyncs})`)
      })
      .catch((error) => {
        context.Logger.error(`[ExamplePlugin] Error sending media progress update: ${error.message}`)
      })
  }
}

/**
 * Test socket authority
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 * @param {string} message
 */
async function sendAdminMessageToast(context, message) {
  context.SocketAuthority.adminEmitter('admin_message', message)
}

/**
 * Test task manager
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 */
async function createTask(context) {
  const task = context.TaskManager.createAndAddTask('example_action', { text: 'Example Task' }, { text: 'This is an example task' }, true)
  const pluginConfigEnabled = !!context.pluginInstance.config.enable

  setTimeout(() => {
    task.setFinished({ text: `Plugin is ${pluginConfigEnabled ? 'enabled' : 'disabled'}` })
    context.TaskManager.taskFinished(task)
  }, 5000)
}
