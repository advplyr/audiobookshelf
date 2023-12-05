const path = require('path')
const which = require('../libs/which')
const fs = require('../libs/fsExtra')
const ffbinaries = require('../libs/ffbinaries')
const Logger = require('../Logger')

class BinaryManager {

  defaultRequiredBinaries = [
    { name: 'ffmpeg', envVariable: 'FFMPEG_PATH' },
    { name: 'ffprobe', envVariable: 'FFPROBE_PATH' }
  ]

  constructor(requiredBinaries = this.defaultRequiredBinaries) {
    this.requiredBinaries = requiredBinaries
    this.mainInstallPath = process.pkg ? path.dirname(process.execPath) : global.appRoot
    this.altInstallPath = global.ConfigPath
  }

  async init() {
    if (this.initialized) return
    const missingBinaries = await this.findRequiredBinaries()
    if (missingBinaries.length == 0) return
    await this.install(missingBinaries)
    const missingBinariesAfterInstall = await this.findRequiredBinaries()
    if (missingBinariesAfterInstall.length != 0) {
      Logger.error(`[BinaryManager] Failed to find or install required binaries: ${missingBinariesAfterInstall.join(', ')}`)
      process.exit(1)
    }
    this.initialized = true
  }

  async findRequiredBinaries() {
    const missingBinaries = []
    for (const binary of this.requiredBinaries) {
      const binaryPath = await this.findBinary(binary.name, binary.envVariable)
      if (binaryPath) {
        Logger.info(`[BinaryManager] Found ${binary.name} at ${binaryPath}`)
        Logger.info(`[BinaryManager] Updating process.env.${binary.envVariable}`)
        process.env[binary.envVariable] = binaryPath
      } else {
        Logger.info(`[BinaryManager] ${binary.name} not found`)
        missingBinaries.push(binary.name)
      }
    }
    return missingBinaries
  }

  async findBinary(name, envVariable) {
    const executable = name + (process.platform == 'win32' ? '.exe' : '')
    const defaultPath = process.env[envVariable]
    if (defaultPath && await fs.pathExists(defaultPath)) return defaultPath
    const whichPath = which.sync(executable, { nothrow: true })
    if (whichPath) return whichPath
    const mainInstallPath = path.join(this.mainInstallPath, executable)
    if (await fs.pathExists(mainInstallPath)) return mainInstallPath
    const altInstallPath = path.join(this.altInstallPath, executable)
    if (await fs.pathExists(altInstallPath)) return altInstallPath
    return null
  }

  async install(binaries) {
    if (binaries.length == 0) return
    Logger.info(`[BinaryManager] Installing binaries: ${binaries.join(', ')}`)
    let destination = this.mainInstallPath
    try {
      await fs.access(destination, fs.constants.W_OK)
    } catch (err) {
      destination = this.altInstallPath
    }
    await ffbinaries.downloadBinaries(binaries, { destination })
    Logger.info(`[BinaryManager] Binaries installed to ${destination}`)
  }

}

module.exports = BinaryManager