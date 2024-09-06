const child_process = require('child_process')
const { promisify } = require('util')
const exec = promisify(child_process.exec)
const os = require('os')
const axios = require('axios')
const path = require('path')
const which = require('../libs/which')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const fileUtils = require('../utils/fileUtils')
const StreamZip = require('../libs/nodeStreamZip')

class ZippedAssetDownloader {
  constructor() {
    this.assetCache = {}
  }

  getReleaseUrl(releaseTag) {
    throw new Error('Not implemented')
  }

  extractAssetUrl(assets, assetName) {
    throw new Error('Not implemented')
  }

  getAssetName(binaryName, releaseTag) {
    throw new Error('Not implemented')
  }

  getAssetFileName(binaryName) {
    throw new Error('Not implemented')
  }

  async getAssetUrl(releaseTag, assetName) {
    // Check if the assets information is already cached for the release tag
    if (this.assetCache[releaseTag]) {
      Logger.debug(`[ZippedAssetDownloader] release ${releaseTag}: assets found in cache.`)
    } else {
      // Get the release information
      const releaseUrl = this.getReleaseUrl(releaseTag)
      const releaseResponse = await axios.get(releaseUrl, { headers: { 'User-Agent': 'axios' } })

      // Cache the assets information for the release tag
      this.assetCache[releaseTag] = releaseResponse.data
      Logger.debug(`[ZippedAssetDownloader] release ${releaseTag}: assets fetched from API.`)
    }

    const assets = this.assetCache[releaseTag]
    const assetUrl = this.extractAssetUrl(assets, assetName)

    return assetUrl
  }

  async downloadAsset(assetUrl, destDir) {
    const zipPath = path.join(destDir, 'temp.zip')
    const writer = fs.createWriteStream(zipPath)

    const assetResponse = await axios({ url: assetUrl, responseType: 'stream' })

    assetResponse.data.pipe(writer)

    await new Promise((resolve, reject) => {
      writer.on('finish', () => {
        Logger.debug(`[ZippedAssetDownloader] Downloaded asset ${assetUrl} to ${zipPath}`)
        resolve()
      })
      writer.on('error', (err) => {
        Logger.error(`[ZippedAssetDownloader] Error downloading asset ${assetUrl}: ${err.message}`)
        reject(err)
      })
    })

    return zipPath
  }

  async extractFiles(zipPath, filesToExtract, destDir) {
    const zip = new StreamZip.async({ file: zipPath })

    for (const file of filesToExtract) {
      const outputPath = path.join(destDir, file.outputFileName)
      await zip.extract(file.pathInsideZip, outputPath)
      Logger.debug(`[ZippedAssetDownloader] Extracted file ${file.pathInsideZip} to ${outputPath}`)

      // Set executable permission for Linux
      if (process.platform !== 'win32') {
        await fs.chmod(outputPath, 0o755)
      }
    }

    await zip.close()
  }

  async downloadAndExtractFiles(releaseTag, assetName, filesToExtract, destDir) {
    let zipPath
    try {
      await fs.ensureDir(destDir)
      const assetUrl = await this.getAssetUrl(releaseTag, assetName)
      zipPath = await this.downloadAsset(assetUrl, destDir)
      await this.extractFiles(zipPath, filesToExtract, destDir)
    } catch (error) {
      Logger.error(`[ZippedAssetDownloader] Error downloading or extracting files: ${error.message}`)
      throw error
    } finally {
      if (zipPath) await fs.remove(zipPath)
    }
  }

  async downloadBinary(binaryName, releaseTag, destDir) {
    const assetName = this.getAssetName(binaryName, releaseTag)
    const fileName = this.getAssetFileName(binaryName)
    const filesToExtract = [{ pathInsideZip: fileName, outputFileName: fileName }]

    await this.downloadAndExtractFiles(releaseTag, assetName, filesToExtract, destDir)
  }
}

class FFBinariesDownloader extends ZippedAssetDownloader {
  constructor() {
    super()
    this.platformSuffix = this.getPlatformSuffix()
  }

  getPlatformSuffix() {
    var type = os.type().toLowerCase()
    var arch = os.arch().toLowerCase()

    if (type === 'darwin') {
      return 'osx-64'
    }

    if (type === 'windows_nt') {
      return arch === 'x64' ? 'windows-64' : 'windows-32'
    }

    if (type === 'linux') {
      if (arch === 'arm') return 'linux-armel'
      if (arch === 'arm64') return 'linux-arm64'
      return arch === 'x64' ? 'linux-64' : 'linux-32'
    }

    return null
  }

  getReleaseUrl(releaseTag) {
    return `https://ffbinaries.com/api/v1/version/${releaseTag}`
  }

  extractAssetUrl(assets, assetName) {
    const assetUrl = assets?.bin?.[this.platformSuffix]?.[assetName]

    if (!assetUrl) {
      throw new Error(`[FFBinariesDownloader] Asset ${assetName} not found for platform ${this.platformSuffix}`)
    }

    return assetUrl
  }

  getAssetName(binaryName, releaseTag) {
    return binaryName
  }

  getAssetFileName(binaryName) {
    return process.platform === 'win32' ? `${binaryName}.exe` : binaryName
  }
}

class Binary {
  constructor(name, type, envVariable, validVersions, source) {
    this.name = name
    this.type = type
    this.envVariable = envVariable
    this.validVersions = validVersions
    this.source = source
    this.fileName = this.getFileName()
    this.exec = exec
  }

  async find(mainInstallDir, altInstallDir) {
    // 1. check path specified in environment variable
    const defaultPath = process.env[this.envVariable]
    if (await this.isGood(defaultPath)) return defaultPath
    // 2. find the first instance of the binary in the PATH environment variable
    if (this.type === 'executable') {
      const whichPath = which.sync(this.fileName, { nothrow: true })
      if (await this.isGood(whichPath)) return whichPath
    }
    // 3. check main install path (binary root dir)
    const mainInstallPath = path.join(mainInstallDir, this.fileName)
    if (await this.isGood(mainInstallPath)) return mainInstallPath
    // 4. check alt install path (/config)
    const altInstallPath = path.join(altInstallDir, this.fileName)
    if (await this.isGood(altInstallPath)) return altInstallPath
    return null
  }

  getFileName() {
    const platform = process.platform

    if (this.type === 'executable') {
      return this.name + (platform == 'win32' ? '.exe' : '')
    } else if (this.type === 'library') {
      return this.name + (platform == 'win32' ? '.dll' : platform == 'darwin' ? '.dylib' : '.so')
    } else {
      return this.name
    }
  }

  async isGood(binaryPath) {
    if (!binaryPath || !(await fs.pathExists(binaryPath))) return false
    if (!this.validVersions.length) return true
    if (this.type === 'library') return true
    try {
      const { stdout } = await this.exec('"' + binaryPath + '"' + ' -version')
      const version = stdout.match(/version\s([\d\.]+)/)?.[1]
      if (!version) return false
      return this.validVersions.some((validVersion) => version.startsWith(validVersion))
    } catch (err) {
      Logger.error(`[Binary] Failed to check version of ${binaryPath}`)
      return false
    }
  }

  async download(destination) {
    await this.source.downloadBinary(this.name, this.validVersions[0], destination)
  }
}

const ffbinaries = new FFBinariesDownloader()
module.exports.ffbinaries = ffbinaries // for testing
//const sqlean = new SQLeanDownloader()
//module.exports.sqlean = sqlean // for testing

class BinaryManager {
  defaultRequiredBinaries = [
    new Binary('ffmpeg', 'executable', 'FFMPEG_PATH', ['5.1'], ffbinaries), // ffmpeg executable
    new Binary('ffprobe', 'executable', 'FFPROBE_PATH', ['5.1'], ffbinaries) // ffprobe executable
    // TODO: Temporarily disabled due to db corruption issues
    // new Binary('unicode', 'library', 'SQLEAN_UNICODE_PATH', ['0.24.2'], sqlean) // sqlean unicode extension
  ]

  constructor(requiredBinaries = this.defaultRequiredBinaries) {
    this.requiredBinaries = requiredBinaries
    this.mainInstallDir = process.pkg ? path.dirname(process.execPath) : global.appRoot
    this.altInstallDir = global.ConfigPath
    this.initialized = false
  }

  async init() {
    // Optional skip binaries check
    if (process.env.SKIP_BINARIES_CHECK === '1') {
      for (const binary of this.requiredBinaries) {
        if (!process.env[binary.envVariable]) {
          await Logger.fatal(`[BinaryManager] Environment variable ${binary.envVariable} must be set`)
          process.exit(1)
        }
      }
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

  async removeBinary(destination, binary) {
    const binaryPath = path.join(destination, binary.fileName)
    if (await fs.pathExists(binaryPath)) {
      Logger.debug(`[BinaryManager] Removing binary: ${binaryPath}`)
      await fs.remove(binaryPath)
    }
  }

  async removeOldBinaries(binaries) {
    for (const binary of binaries) {
      await this.removeBinary(this.mainInstallDir, binary)
      await this.removeBinary(this.altInstallDir, binary)
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
      const binaryPath = await binary.find(this.mainInstallDir, this.altInstallDir)
      if (binaryPath) {
        Logger.info(`[BinaryManager] Found valid binary ${binary.name} at ${binaryPath}`)
        if (process.env[binary.envVariable] !== binaryPath) {
          Logger.info(`[BinaryManager] Updating process.env.${binary.envVariable}`)
          process.env[binary.envVariable] = binaryPath
        }
      } else {
        Logger.info(`[BinaryManager] ${binary.name} not found or version too old`)
        missingBinaries.push(binary)
      }
    }
    return missingBinaries
  }

  async install(binaries) {
    if (!binaries.length) return
    Logger.info(`[BinaryManager] Installing binaries: ${binaries.map((binary) => binary.name).join(', ')}`)
    let destination = (await fileUtils.isWritable(this.mainInstallDir)) ? this.mainInstallDir : this.altInstallDir
    for (const binary of binaries) {
      await binary.download(destination)
    }
    Logger.info(`[BinaryManager] Binaries installed to ${destination}`)
  }
}

module.exports = BinaryManager
module.exports.Binary = Binary // for testing
