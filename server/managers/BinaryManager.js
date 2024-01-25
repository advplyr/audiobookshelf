const child_process = require('child_process')
const { promisify } = require('util')
const exec = promisify(child_process.exec)
const path = require('path')
const which = require('../libs/which')
const fs = require('../libs/fsExtra')
const ffbinaries = require('../libs/ffbinaries')
const Logger = require('../Logger')
const fileUtils = require('../utils/fileUtils')

class BinaryManager {

  defaultRequiredBinaries = [
    { name: 'ffmpeg', envVariable: 'FFMPEG_PATH' },
    { name: 'ffprobe', envVariable: 'FFPROBE_PATH' }
  ]

  goodVersions = [ '5.1', '6' ]

  constructor(requiredBinaries = this.defaultRequiredBinaries) {
    this.requiredBinaries = requiredBinaries
    this.mainInstallPath = process.pkg ? path.dirname(process.execPath) : global.appRoot
    this.altInstallPath = global.ConfigPath
    this.exec = exec
  }

  async init() {
    if (this.initialized) return
    const missingBinaries = await this.findRequiredBinaries()
    if (missingBinaries.length == 0) return
    await this.removeOldBinaries(missingBinaries)
    await this.install(missingBinaries)
    const missingBinariesAfterInstall = await this.findRequiredBinaries()
    if (missingBinariesAfterInstall.length != 0) {
      Logger.error(`[BinaryManager] Failed to find or install required binaries: ${missingBinariesAfterInstall.join(', ')}`)
      process.exit(1)
    }
    this.initialized = true
  }

  async removeOldBinaries(binaryNames) {
    for (const binaryName of binaryNames) {
      const executable = this.getExecutableFileName(binaryName)
      const mainInstallPath = path.join(this.mainInstallPath, executable)
      const altInstallPath = path.join(this.altInstallPath, executable)
      Logger.debug(`[BinaryManager] Removing old binaries: ${mainInstallPath}, ${altInstallPath}`)
      await fs.remove(mainInstallPath)
      await fs.remove(altInstallPath)
    }
  }

  async findRequiredBinaries() {
    const missingBinaries = []
    for (const binary of this.requiredBinaries) {
      const binaryPath = await this.findBinary(binary.name, binary.envVariable)
      if (binaryPath) {
        Logger.info(`[BinaryManager] Found good ${binary.name} at ${binaryPath}`)
        if (process.env[binary.envVariable] !== binaryPath) {
          Logger.info(`[BinaryManager] Updating process.env.${binary.envVariable}`)
          process.env[binary.envVariable] = binaryPath
        }
      } else {
        Logger.info(`[BinaryManager] ${binary.name} not found or version too old`)
        missingBinaries.push(binary.name)
      }
    }
    return missingBinaries
  }

  async findBinary(name, envVariable) {
    const executable = this.getExecutableFileName(name)
    const defaultPath = process.env[envVariable]
    if (await this.isBinaryGood(defaultPath)) return defaultPath
    const whichPath = which.sync(executable, { nothrow: true })
    if (await this.isBinaryGood(whichPath)) return whichPath
    const mainInstallPath = path.join(this.mainInstallPath, executable)
    if (await this.isBinaryGood(mainInstallPath)) return mainInstallPath
    const altInstallPath = path.join(this.altInstallPath, executable)
    if (await this.isBinaryGood(altInstallPath)) return altInstallPath
    return null
  }

  async isBinaryGood(binaryPath) {
    if (!binaryPath || !await fs.pathExists(binaryPath)) return false
    try {
      const { stdout } = await this.exec('"' + binaryPath + '"' + ' -version')
      const version = stdout.match(/version\s([\d\.]+)/)?.[1]
      if (!version) return false
      return this.goodVersions.some(goodVersion => version.startsWith(goodVersion))
    } catch (err) {
      Logger.error(`[BinaryManager] Failed to check version of ${binaryPath}`)
      return false
    }
  }

  async install(binaries) {
    if (binaries.length == 0) return
    Logger.info(`[BinaryManager] Installing binaries: ${binaries.join(', ')}`)
    let destination = await fileUtils.isWritable(this.mainInstallPath) ? this.mainInstallPath : this.altInstallPath
    await ffbinaries.downloadBinaries(binaries, { destination, version: '6.1', force: true })
    Logger.info(`[BinaryManager] Binaries installed to ${destination}`)
  }

  getExecutableFileName(name) {
    return name + (process.platform == 'win32' ? '.exe' : '')
  }
}

module.exports = BinaryManager