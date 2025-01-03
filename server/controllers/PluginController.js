const { Request, Response, NextFunction } = require('express')
const PluginManager = require('../managers/PluginManager')
const Logger = require('../Logger')

class PluginController {
  constructor() {}

  /**
   *
   * @param {Request} req
   * @param {Response} res
   */
  getConfig(req, res) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }

    res.json({
      config: req.pluginData.instance.config
    })
  }

  /**
   * POST: /api/plugins/:id/action
   *
   * @param {Request} req
   * @param {Response} res
   */
  async handleAction(req, res) {
    const actionName = req.body.pluginAction
    const target = req.body.target
    const data = req.body.data
    Logger.info(`[PluginController] Handle plugin "${req.pluginData.manifest.name}" action ${actionName} ${target}`, data)
    const actionData = await PluginManager.onAction(req.pluginData, actionName, target, data)
    if (!actionData || actionData.error) {
      return res.status(400).send(actionData?.error || 'Error performing action')
    }
    res.sendStatus(200)
  }

  /**
   * POST: /api/plugins/:id/config
   *
   * @param {Request} req
   * @param {Response} res
   */
  async handleConfigSave(req, res) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }
    if (!req.body.config || typeof req.body.config !== 'object') {
      return res.status(400).send('Invalid config')
    }

    const config = req.body.config
    Logger.info(`[PluginController] Handle save config for plugin ${req.pluginData.manifest.name}`, config)
    const saveData = await PluginManager.onConfigSave(req.pluginData, config)
    if (!saveData || saveData.error) {
      return res.status(400).send(saveData?.error || 'Error saving config')
    }
    res.sendStatus(200)
  }

  /**
   *
   * @param {Request} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    if (req.params.id) {
      const pluginData = PluginManager.getPluginDataById(req.params.id)
      if (!pluginData) {
        return res.sendStatus(404)
      }
      await pluginData.instance.reload()
      req.pluginData = pluginData
    }
    next()
  }
}
module.exports = new PluginController()
