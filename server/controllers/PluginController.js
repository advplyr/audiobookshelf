const { Request, Response } = require('express')
const PluginManager = require('../managers/PluginManager')
const Logger = require('../Logger')

class PluginController {
  constructor() {}

  /**
   * POST: /api/plugins/action
   *
   * @param {Request} req
   * @param {Response} res
   */
  handleAction(req, res) {
    const pluginSlug = req.body.pluginSlug
    const actionName = req.body.pluginAction
    const target = req.body.target
    const data = req.body.data
    Logger.info(`[PluginController] Handle plugin action ${pluginSlug} ${actionName} ${target}`, data)
    PluginManager.onAction(pluginSlug, actionName, target, data)
    res.sendStatus(200)
  }
}
module.exports = new PluginController()
