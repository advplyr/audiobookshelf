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
    { name: 'ffmpeg', envVariable: 'FFMPEG_PATH', validVersions: ['5.1'] },
    { name: 'ffprobe', envVariable: 'FFPROBE_PATH', validVersions: ['5.1'] }
  ]

  constructor(requiredBinaries = this.defaultRequiredBinaries) {
    this.requiredBinaries = requiredBinaries
    this.mainInstallPath = process.pkg ? path.dirname(process.execPath) : global.appRoot
    this.altInstallPath = global.ConfigPath
    this.initialized = false
    this.exec = exec
  }

  async init() {
    // Optional skip binaries check
    if (process.env.SKIP_BINARIES_CHECK === '1') {
      Logger.info('[BinaryManager] Skipping check for binaries')
      return
    }

    if (this.initialized) return

    const missingBinaries = await this.findRequiredBinaries()
    if (missingBinaries.length == 0) return
    await this.removeOldBinaries(missingBinaries)
    await this.install(missingBinaries)
    const missingBinariesAfterInstall = await this.findRequiredBinaries()
    if (missingBinariesAfterInstall.length) {
      Logger.error(`[BinaryManager] Failed to find or install required binaries: ${missingBinariesAfterInstall.join(', ')}`)
      process.exit(1)
    }
    this.initialized = true
  }

  /**
   * Remove old/invalid binaries in main or alt install path
   * 
   * @param {string[]} binaryNames 
   */
  async removeOldBinaries(binaryNames) {
    for (const binaryName of binaryNames) {
      const executable = this.getExecutableFileName(binaryName)
      const mainInstallPath = path.join(this.mainInstallPath, executable)
      if (await fs.pathExists(mainInstallPath)) {
        Logger.debug(`[BinaryManager] Removing old binary: ${mainInstallPath}`)
        await fs.remove(mainInstallPath)
      }
      const altInstallPath = path.join(this.altInstallPath, executable)
      if (await fs.pathExists(altInstallPath)) {
        Logger.debug(`[BinaryManager] Removing old binary: ${altInstallPath}`)
        await fs.remove(altInstallPath)
      }
    }
  }

  /**
   * Find required binaries and return array of binary names that are missing
   * 
   * @returns {Promise<string[]>}
   */
  async findRequiredBinaries() {
    const missingBinaries = []
    for (const binary of this.requiredBinaries) {
      const binaryPath = await this.findBinary(binary.name, binary.envVariable, binary.validVersions)
      if (binaryPath) {
        Logger.info(`[BinaryManager] Found valid binary ${binary.name} at ${binaryPath}`)
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

  /**
   * Find absolute path for binary
   * 
   * @param {string} name 
   * @param {string} envVariable 
   * @param {string[]} [validVersions]
   * @returns {Promise<string>} Path to binary
   */
  async findBinary(name, envVariable, validVersions = []) {
    const executable = this.getExecutableFileName(name)
    // 1. check path specified in environment variable
    const defaultPath = process.env[envVariable]
    if (await this.isBinaryGood(defaultPath, validVersions)) return defaultPath
    // 2. find the first instance of the binary in the PATH environment variable
    const whichPath = which.sync(executable, { nothrow: true })
    if (await this.isBinaryGood(whichPath, validVersions)) return whichPath
    // 3. check main install path (binary root dir)
    const mainInstallPath = path.join(this.mainInstallPath, executable)
    if (await this.isBinaryGood(mainInstallPath, validVersions)) return mainInstallPath
    // 4. check alt install path (/config)
    const altInstallPath = path.join(this.altInstallPath, executable)
    if (await this.isBinaryGood(altInstallPath, validVersions)) return altInstallPath
    return null
  }

  /**
   * Check binary path exists and optionally check version is valid
   * 
   * @param {string} binaryPath 
   * @param {string[]} [validVersions]
   * @returns {Promise<boolean>}
   */
  async isBinaryGood(binaryPath, validVersions = []) {
    if (!binaryPath || !await fs.pathExists(binaryPath)) return false
    if (!validVersions.length) return true
    try {
      const { stdout } = await this.exec('"' + binaryPath + '"' + ' -version')
      const version = stdout.match(/version\s([\d\.]+)/)?.[1]
      if (!version) return false
      return validVersions.some(validVersion => version.startsWith(validVersion))
    } catch (err) {
      Logger.error(`[BinaryManager] Failed to check version of ${binaryPath}`)
      return false
    }
  }

  /**
   * 
   * @param {string[]} binaries 
   */
  async install(binaries) {
    if (!binaries.length) return
    Logger.info(`[BinaryManager] Installing binaries: ${binaries.join(', ')}`)
    let destination = await fileUtils.isWritable(this.mainInstallPath) ? this.mainInstallPath : this.altInstallPath
    await ffbinaries.downloadBinaries(binaries, { destination, version: '5.1', force: true })
    Logger.info(`[BinaryManager] Binaries installed to ${destination}`)
  }

  /**
   * Append .exe to binary name for Windows
   * 
   * @param {string} name 
   * @returns {string}
   */
  getExecutableFileName(name) {
    return name + (process.platform == 'win32' ? '.exe' : '')
  }
}

module.exports = BinaryManager