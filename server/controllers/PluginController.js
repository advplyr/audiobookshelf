const { Request, Response } = require('express')
const PluginManager = require('../managers/PluginManager')
const Logger = require('../Logger')

class PluginController {
  constructor() {}

  /**
   * POST: /api/plugins/:id/action
   *
   * @param {Request} req
   * @param {Response} res
   */
  handleAction(req, res) {
    const pluginId = req.params.id
    const actionName = req.body.pluginAction
    const target = req.body.target
    const data = req.body.data
    Logger.info(`[PluginController] Handle plugin action ${pluginId} ${actionName} ${target}`, data)
    PluginManager.onAction(pluginId, actionName, target, data)
    res.sendStatus(200)
  }

  /**
   * POST: /api/plugins/:id/config
   *
   * @param {*} req
   * @param {*} res
   */
  handleConfigSave(req, res) {
    const pluginId = req.params.id
    const config = req.body.config
    Logger.info(`[PluginController] Saving config for plugin ${pluginId}`, config)
    PluginManager.onConfigSave(pluginId, config)
    res.sendStatus(200)
  }
}
module.exports = new PluginController()
