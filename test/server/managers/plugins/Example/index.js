class ExamplePlugin {
  constructor() {
    this.name = 'Example'
  }

  /**
   *
   * @param {import('../../server/managers/PluginManager').PluginContext} context
   */
  async init(context) {
    context.Logger.info('[ExamplePlugin] Example plugin loaded successfully')

    context.Database.mediaProgressModel.addHook('afterSave', (instance, options) => {
      context.Logger.debug(`[ExamplePlugin] mediaProgressModel afterSave hook for mediaProgress ${instance.id}`)
      this.handleMediaProgressUpdate(context, instance)
    })
  }

  /**
   * @param {import('../../server/managers/PluginManager').PluginContext} context
   * @param {import('../../server/models/MediaProgress')} mediaProgress
   */
  async handleMediaProgressUpdate(context, mediaProgress) {
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
   *
   * @param {import('../../server/managers/PluginManager').PluginContext} context
   * @param {string} actionName
   * @param {string} target
   * @param {*} data
   */
  async onAction(context, actionName, target, data) {
    context.Logger.info('[ExamplePlugin] Example plugin onAction', actionName, target, data)
  }

  /**
   *
   * @param {import('../../server/managers/PluginManager').PluginContext} context
   * @param {*} config
   */
  async onConfigSave(context, config) {
    context.Logger.info('[ExamplePlugin] Example plugin onConfigSave', config)
  }
}
module.exports = new ExamplePlugin()
