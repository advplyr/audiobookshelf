const Path = require('path')
const Logger = require('../Logger')
const Database = require('../Database')
const SocketAuthority = require('../SocketAuthority')
const TaskManager = require('../managers/TaskManager')
const fsExtra = require('../libs/fsExtra')
const { isUUID, parseSemverStrict } = require('../utils')

/**
 * @typedef PluginContext
 * @property {import('../Logger')} Logger
 * @property {import('../Database')} Database
 * @property {import('../SocketAuthority')} SocketAuthority
 * @property {import('../managers/TaskManager')} TaskManager
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
      Database,
      SocketAuthority,
      TaskManager
    }
  }

  /**
   * Validate and load a plugin from a directory
   * TODO: Validatation
   *
   * @param {string} dirname
   * @param {string} pluginPath
   * @returns {Promise<{manifest: Object, contents: any}>}
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
      instance: {
        init: pluginInstance.init,
        onAction: pluginInstance.onAction,
        onConfigSave: pluginInstance.onConfigSave
      }
    }
  }

  /**
   * Get all plugins from the /metadata/plugins directory
   */
  async getPluginsFromFileSystem() {
    await fsExtra.ensureDir(this.pluginMetadataPath)

    // Get all directories in the plugins directory
    const pluginDirs = await fsExtra.readdir(this.pluginMetadataPath, { withFileTypes: true, recursive: true }).then((files) => files.filter((file) => file.isDirectory()))

    const pluginsFound = []
    for (const pluginDir of pluginDirs) {
      Logger.debug(`[PluginManager] Checking if directory "${pluginDir.name}" is a plugin`)
      const plugin = await this.loadPlugin(pluginDir.name, Path.join(this.pluginMetadataPath, pluginDir.name))
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
    const pluginsFound = await this.getPluginsFromFileSystem()

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
      } else {
        await Database.pluginModel.create({
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
      if (plugin.instance.init) {
        Logger.info(`[PluginManager] Initializing plugin ${plugin.manifest.name}`)
        plugin.instance.init(this.pluginContext)
      }
    }
  }

  /**
   *
   * @param {string} pluginId
   * @param {string} actionName
   * @param {string} target
   * @param {Object} data
   * @returns
   */
  onAction(pluginId, actionName, target, data) {
    const plugin = this.plugins.find((plugin) => plugin.manifest.id === pluginId)
    if (!plugin) {
      Logger.error(`[PluginManager] Plugin ${pluginId} not found`)
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

  /**
   *
   * @param {string} pluginId
   * @param {Object} config
   */
  onConfigSave(pluginId, config) {
    const plugin = this.plugins.find((plugin) => plugin.manifest.id === pluginId)
    if (!plugin) {
      Logger.error(`[PluginManager] Plugin ${pluginId} not found`)
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
