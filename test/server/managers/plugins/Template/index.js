/**
 * Called on initialization of the plugin
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 */
module.exports.init = async (context) => {
  context.Logger.info('[TemplatePlugin] plugin initialized')
  // Can be used to initialize plugin config and/or setup Database hooks
}

/**
 * Called when an extension action is triggered
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 * @param {string} actionName
 * @param {string} target
 * @param {Object} data
 * @returns {Promise<boolean|{error: string}>}
 */
module.exports.onAction = async (context, actionName, target, data) => {
  context.Logger.info('[TemplatePlugin] plugin onAction', actionName, target, data)
  return true
}

/**
 * Called when the plugin config page is saved
 *
 * @param {import('../../../server/managers/PluginManager').PluginContext} context
 * @param {Object} config
 * @returns {Promise<boolean|{error: string}>}
 */
module.exports.onConfigSave = async (context, config) => {
  context.Logger.info('[TemplatePlugin] plugin onConfigSave', config)
  // Maintener is responsible for validating and saving the config to their `pluginInstance`
  return true
}
