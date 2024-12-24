const Path = require('path')
const Logger = require('../Logger')
const Database = require('../Database')
const SocketAuthority = require('../SocketAuthority')
const TaskManager = require('../managers/TaskManager')
const ShareManager = require('../managers/ShareManager')
const RssFeedManager = require('../managers/RssFeedManager')
const PodcastManager = require('../managers/PodcastManager')
const fsExtra = require('../libs/fsExtra')
const { isUUID, parseSemverStrict } = require('../utils')

/**
 * @typedef PluginContext
 * @property {import('../Logger')} Logger
 * @property {import('../Database')} Database
 * @property {import('../SocketAuthority')} SocketAuthority
 * @property {import('../managers/TaskManager')} TaskManager
 * @property {import('../models/Plugin')} pluginInstance
 * @property {import('../managers/ShareManager')} ShareManager
 * @property {import('../managers/RssFeedManager')} RssFeedManager
 * @property {import('../managers/PodcastManager')} PodcastManager
 */

/**
 * @typedef PluginData
 * @property {string} id
 * @property {Object} manifest
 * @property {import('../models/Plugin')} instance
 * @property {Function} init
 * @property {Function} onAction
 * @property {Function} onConfigSave
 */

class PluginManager {
  constructor() {
    /** @type {PluginData[]} */
    this.plugins = []
  }

  get pluginMetadataPath() {
    return Path.posix.join(global.MetadataPath, 'plugins')
  }

  get pluginManifests() {
    return this.plugins.map((plugin) => plugin.manifest)
  }

  /**
   *
   * @param {import('../models/Plugin')} pluginInstance
   * @returns {PluginContext}
   */
  getPluginContext(pluginInstance) {
    return {
      Logger,
      Database,
      SocketAuthority,
      TaskManager,
      pluginInstance,
      ShareManager,
      RssFeedManager,
      PodcastManager
    }
  }

  /**
   *
   * @param {string} id
   * @returns {PluginData}
   */
  getPluginDataById(id) {
    return this.plugins.find((plugin) => plugin.manifest.id === id)
  }

  /**
   * Validate and load a plugin from a directory
   * TODO: Validatation
   *
   * @param {string} dirname
   * @param {string} pluginPath
   * @returns {Promise<PluginData>}
   */
  async loadPlugin(dirname, pluginPath) {
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
    if (!isUUID(manifestJson.id)) {
      Logger.error(`Invalid plugin ID in manifest for plugin ${pluginPath}`)
      return null
    }
    if (!parseSemverStrict(manifestJson.version)) {
      Logger.error(`Invalid plugin version in manifest for plugin ${pluginPath}`)
      return null
    }
    // TODO: Enforcing plugin name to be the same as the directory name? Ensures plugins are identifiable in the file system. May have issues with unicode characters.
    if (dirname !== manifestJson.name) {
      Logger.error(`Plugin directory name "${dirname}" does not match manifest name "${manifestJson.name}"`)
      return null
    }

    let pluginContents = null
    try {
      pluginContents = require(Path.join(pluginPath, indexFile.name))
    } catch (error) {
      Logger.error(`Error loading plugin ${pluginPath}`, error)
      return null
    }

    if (typeof pluginContents.init !== 'function') {
      Logger.error(`Plugin ${pluginPath} does not have an init function`)
      return null
    }

    return {
      id: manifestJson.id,
      manifest: manifestJson,
      init: pluginContents.init,
      onAction: pluginContents.onAction,
      onConfigSave: pluginContents.onConfigSave
    }
  }

  /**
   * Get all plugins from the /metadata/plugins directory
   */
  async getPluginsFromDirPath(pluginsPath) {
    // Get all directories in the plugins directory
    const pluginDirs = await fsExtra.readdir(pluginsPath, { withFileTypes: true }).then((files) => files.filter((file) => file.isDirectory()))

    const pluginsFound = []
    for (const pluginDir of pluginDirs) {
      Logger.debug(`[PluginManager] Checking if directory "${pluginDir.name}" is a plugin`)
      const plugin = await this.loadPlugin(pluginDir.name, Path.join(pluginsPath, pluginDir.name))
      if (plugin) {
        Logger.debug(`[PluginManager] Found plugin "${plugin.manifest.name}"`)
        pluginsFound.push(plugin)
      }
    }

    return pluginsFound
  }

  /**
   * Load plugins from the /metadata/plugins directory and update the database
   */
  async loadPlugins() {
    await fsExtra.ensureDir(this.pluginMetadataPath)

    const pluginsFound = await this.getPluginsFromDirPath(this.pluginMetadataPath)

    if (process.env.DEV_PLUGINS_PATH) {
      const devPluginsFound = await this.getPluginsFromDirPath(process.env.DEV_PLUGINS_PATH)
      if (!devPluginsFound.length) {
        Logger.warn(`[PluginManager] No plugins found in DEV_PLUGINS_PATH: ${process.env.DEV_PLUGINS_PATH}`)
      } else {
        pluginsFound.push(...devPluginsFound)
      }
    }

    const existingPlugins = await Database.pluginModel.findAll()

    // Add new plugins or update existing plugins
    for (const plugin of pluginsFound) {
      const existingPlugin = existingPlugins.find((p) => p.id === plugin.manifest.id)
      if (existingPlugin) {
        // TODO: Should automatically update?
        if (existingPlugin.version !== plugin.manifest.version) {
          Logger.info(`[PluginManager] Updating plugin "${plugin.manifest.name}" version from "${existingPlugin.version}" to version "${plugin.manifest.version}"`)
          await existingPlugin.update({ version: plugin.manifest.version, isMissing: false })
        } else if (existingPlugin.isMissing) {
          Logger.info(`[PluginManager] Plugin "${plugin.manifest.name}" was missing but is now found`)
          await existingPlugin.update({ isMissing: false })
        } else {
          Logger.debug(`[PluginManager] Plugin "${plugin.manifest.name}" already exists in the database with version "${plugin.manifest.version}"`)
        }
        plugin.instance = existingPlugin
      } else {
        plugin.instance = await Database.pluginModel.create({
          id: plugin.manifest.id,
          name: plugin.manifest.name,
          version: plugin.manifest.version
        })
        Logger.info(`[PluginManager] Added plugin "${plugin.manifest.name}" to the database`)
      }
    }

    // Mark missing plugins
    for (const plugin of existingPlugins) {
      const foundPlugin = pluginsFound.find((p) => p.manifest.id === plugin.id)
      if (!foundPlugin && !plugin.isMissing) {
        Logger.info(`[PluginManager] Plugin "${plugin.name}" not found or invalid - marking as missing`)
        await plugin.update({ isMissing: true })
      }
    }

    this.plugins = pluginsFound
  }

  /**
   * Load and initialize all plugins
   */
  async init() {
    await this.loadPlugins()

    for (const plugin of this.plugins) {
      Logger.info(`[PluginManager] Initializing plugin ${plugin.manifest.name}`)
      plugin.init(this.getPluginContext(plugin.instance))
    }
  }

  /**
   *
   * @param {PluginData} plugin
   * @param {string} actionName
   * @param {string} target
   * @param {Object} data
   * @returns {Promise<boolean|{error:string}>}
   */
  onAction(plugin, actionName, target, data) {
    if (!plugin.onAction) {
      Logger.error(`[PluginManager] onAction not implemented for plugin ${plugin.manifest.name}`)
      return false
    }

    const pluginExtension = plugin.manifest.extensions.find((extension) => extension.name === actionName)
    if (!pluginExtension) {
      Logger.error(`[PluginManager] Extension ${actionName} not found for plugin ${plugin.manifest.name}`)
      return false
    }

    Logger.info(`[PluginManager] Calling onAction for plugin ${plugin.manifest.name}`)
    return plugin.onAction(this.getPluginContext(plugin.instance), actionName, target, data)
  }

  /**
   *
   * @param {PluginData} plugin
   * @param {Object} config
   * @returns {Promise<boolean|{error:string}>}
   */
  onConfigSave(plugin, config) {
    if (!plugin.onConfigSave) {
      Logger.error(`[PluginManager] onConfigSave not implemented for plugin ${plugin.manifest.name}`)
      return false
    }

    Logger.info(`[PluginManager] Calling onConfigSave for plugin ${plugin.manifest.name}`)
    return plugin.onConfigSave(this.getPluginContext(plugin.instance), config)
  }
}
module.exports = new PluginManager()
