const Path = require('path')
const Logger = require('../Logger')
const Database = require('../Database')
const PluginAbstract = require('../PluginAbstract')
const fs = require('fs').promises
const fsExtra = require('../libs/fsExtra')

/**
 * @typedef PluginContext
 * @property {import('../../server/Logger')} Logger
 * @property {import('../../server/Database')} Database
 */

class PluginManager {
  constructor() {
    this.plugins = []
  }

  get pluginMetadataPath() {
    return Path.posix.join(global.MetadataPath, 'plugins')
  }

  get pluginData() {
    return this.plugins.map((plugin) => plugin.manifest)
  }

  /**
   * @returns {PluginContext}
   */
  get pluginContext() {
    return {
      Logger,
      Database
    }
  }

  /**
   *
   * @param {string} pluginPath
   * @returns {Promise<{manifest: Object, contents: PluginAbstract}>}
   */
  async loadPlugin(pluginPath) {
    const pluginFiles = await fsExtra.readdir(pluginPath, { withFileTypes: true }).then((files) => files.filter((file) => !file.isDirectory()))

    if (!pluginFiles.length) {
      Logger.error(`No files found in plugin ${pluginPath}`)
      return null
    }
    const manifestFile = pluginFiles.find((file) => file.name === 'manifest.json')
    if (!manifestFile) {
      Logger.error(`No manifest found for plugin ${pluginPath}`)
      return null
    }
    const indexFile = pluginFiles.find((file) => file.name === 'index.js')
    if (!indexFile) {
      Logger.error(`No index file found for plugin ${pluginPath}`)
      return null
    }

    let manifestJson = null
    try {
      manifestJson = await fsExtra.readFile(Path.join(pluginPath, manifestFile.name), 'utf8').then((data) => JSON.parse(data))
    } catch (error) {
      Logger.error(`Error parsing manifest file for plugin ${pluginPath}`, error)
      return null
    }

    // TODO: Validate manifest json

    let pluginInstance = null
    try {
      pluginInstance = require(Path.join(pluginPath, indexFile.name))
    } catch (error) {
      Logger.error(`Error loading plugin ${pluginPath}`, error)
      return null
    }

    if (typeof pluginInstance.init !== 'function') {
      Logger.error(`Plugin ${pluginPath} does not have an init function`)
      return null
    }

    return {
      manifest: manifestJson,
      instance: pluginInstance
    }
  }

  async loadPlugins() {
    await fsExtra.ensureDir(this.pluginMetadataPath)

    const pluginDirs = await fsExtra.readdir(this.pluginMetadataPath, { withFileTypes: true, recursive: true }).then((files) => files.filter((file) => file.isDirectory()))

    for (const pluginDir of pluginDirs) {
      Logger.info(`[PluginManager] Loading plugin ${pluginDir.name}`)
      const plugin = await this.loadPlugin(Path.join(this.pluginMetadataPath, pluginDir.name))
      if (plugin) {
        Logger.info(`[PluginManager] Loaded plugin ${plugin.manifest.name}`)
        this.plugins.push(plugin)
      }
    }
  }

  async init() {
    await this.loadPlugins()

    for (const plugin of this.plugins) {
      if (plugin.instance.init) {
        Logger.info(`[PluginManager] Initializing plugin ${plugin.manifest.name}`)
        plugin.instance.init(this.pluginContext)
      }
    }
  }

  onAction(pluginSlug, actionName, target, data) {
    const plugin = this.plugins.find((plugin) => plugin.manifest.slug === pluginSlug)
    if (!plugin) {
      Logger.error(`[PluginManager] Plugin ${pluginSlug} not found`)
      return
    }

    const pluginExtension = plugin.manifest.extensions.find((extension) => extension.name === actionName)
    if (!pluginExtension) {
      Logger.error(`[PluginManager] Extension ${actionName} not found for plugin ${plugin.manifest.name}`)
      return
    }

    if (plugin.instance.onAction) {
      Logger.info(`[PluginManager] Calling onAction for plugin ${plugin.manifest.name}`)
      plugin.instance.onAction(this.pluginContext, actionName, target, data)
    }
  }

  onConfigSave(pluginSlug, config) {
    const plugin = this.plugins.find((plugin) => plugin.manifest.slug === pluginSlug)
    if (!plugin) {
      Logger.error(`[PluginManager] Plugin ${pluginSlug} not found`)
      return
    }

    if (plugin.instance.onConfigSave) {
      Logger.info(`[PluginManager] Calling onConfigSave for plugin ${plugin.manifest.name}`)
      plugin.instance.onConfigSave(this.pluginContext, config)
    }
  }

  pluginExists(name) {
    return this.plugins.some((plugin) => plugin.name === name)
  }

  registerPlugin(plugin) {
    if (!plugin.name) {
      throw new Error('The plugin name and package are required')
    }

    if (this.pluginExists(plugin.name)) {
      throw new Error(`Cannot add existing plugin ${plugin.name}`)
    }

    try {
      // Try to load the plugin
      const pluginPath = Path.join(this.pluginMetadataPath, plugin.name)
      const packageContents = require(pluginPath)
      console.log('packageContents', packageContents)
      packageContents.init()
      this.plugins.push(packageContents)
    } catch (error) {
      console.log(`Cannot load plugin ${plugin.name}`, error)
    }
  }
}
module.exports = new PluginManager()
