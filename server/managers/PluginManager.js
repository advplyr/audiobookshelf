const Path = require('path')
const Logger = require('../Logger')
const PluginAbstract = require('../PluginAbstract')
const fs = require('fs').promises

class PluginManager {
  constructor() {
    this.plugins = []
  }

  get pluginExtensions() {
    return this.plugins
      .filter((plugin) => plugin.manifest.extensions?.length)
      .map((plugin) => {
        return {
          name: plugin.manifest.name,
          slug: plugin.manifest.slug,
          extensions: plugin.manifest.extensions
        }
      })
  }

  get pluginContext() {
    return {
      Logger
    }
  }

  /**
   *
   * @param {string} pluginPath
   * @returns {Promise<{manifest: Object, contents: PluginAbstract}>}
   */
  async loadPlugin(pluginPath) {
    const pluginFiles = await fs.readdir(pluginPath, { withFileTypes: true }).then((files) => files.filter((file) => !file.isDirectory()))

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
      manifestJson = await fs.readFile(Path.join(pluginPath, manifestFile.name), 'utf8').then((data) => JSON.parse(data))
    } catch (error) {
      Logger.error(`Error parsing manifest file for plugin ${pluginPath}`, error)
      return null
    }

    // TODO: Validate manifest json

    let pluginContents = null
    try {
      pluginContents = require(Path.join(pluginPath, indexFile.name))
    } catch (error) {
      Logger.error(`Error loading plugin ${pluginPath}`, error)
      return null
    }

    return {
      manifest: manifestJson,
      contents: pluginContents
    }
  }

  async loadPlugins() {
    const pluginDirs = await fs.readdir(global.PluginsPath, { withFileTypes: true, recursive: true }).then((files) => files.filter((file) => file.isDirectory()))
    console.log('pluginDirs', pluginDirs)

    for (const pluginDir of pluginDirs) {
      Logger.info(`[PluginManager] Loading plugin ${pluginDir.name}`)
      const plugin = await this.loadPlugin(Path.join(global.PluginsPath, pluginDir.name))
      if (plugin) {
        Logger.info(`[PluginManager] Loaded plugin ${plugin.manifest.name}`)
        this.plugins.push(plugin)
      }
    }
  }

  async init() {
    await this.loadPlugins()

    for (const plugin of this.plugins) {
      if (plugin.contents.init) {
        Logger.info(`[PluginManager] Initializing plugin ${plugin.manifest.name}`)
        plugin.contents.init(this.pluginContext)
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

    if (plugin.contents.onAction) {
      Logger.info(`[PluginManager] Calling onAction for plugin ${plugin.manifest.name}`)
      plugin.contents.onAction(this.pluginContext, actionName, target, data)
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
      const pluginPath = Path.join(global.PluginsPath, plugin.name)
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
