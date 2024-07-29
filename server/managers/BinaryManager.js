const child_process = require('child_process')
const { promisify } = require('util')
const exec = promisify(child_process.exec)
const path = require('path')
const axios = require('axios')
const which = require('../libs/which')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const fileUtils = require('../utils/fileUtils')
const StreamZip = require('../libs/nodeStreamZip')

class GithubAssetDownloader {
  constructor(owner, repo) {
    this.owner = owner
    this.repo = repo
    this.assetCache = {}
  }

  async getAssetUrl(releaseTag, assetName) {
    // Check if the assets information is already cached for the release tag
    if (this.assetCache[releaseTag]) {
      Logger.debug(`[GithubAssetDownloader] Repo ${this.repo} release ${releaseTag}: assets found in cache.`)
    } else {
      // Get the release information
      const releaseUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/releases/tags/${releaseTag}`
      const releaseResponse = await axios.get(releaseUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'axios'
        }
      })

      // Cache the assets information for the release tag
      this.assetCache[releaseTag] = releaseResponse.data.assets
      Logger.debug(`[GithubAssetDownloader] Repo ${this.repo} release ${releaseTag}: assets fetched from API.`)
    }

    // Find the asset URL
    const assets = this.assetCache[releaseTag]
    const asset = assets.find((asset) => asset.name === assetName)
    if (!asset) {
      throw new Error(`[GithubAssetDownloader] Repo ${this.repo} release ${releaseTag}: asset ${assetName} not found`)
    }

    return asset.browser_download_url
  }

  async downloadAsset(assetUrl, destDir) {
    const zipPath = path.join(destDir, 'temp.zip')
    const writer = fs.createWriteStream(zipPath)

    const assetResponse = await axios({
      url: assetUrl,
      method: 'GET',
      responseType: 'stream'
    })

    assetResponse.data.pipe(writer)

    await new Promise((resolve, reject) => {
      writer.on('finish', () => {
        Logger.debug(`[GithubAssetDownloader] Downloaded asset ${assetUrl} to ${zipPath}`)
        resolve()
      })
      writer.on('error', (err) => {
        Logger.error(`[GithubAssetDownloader] Error downloading asset ${assetUrl}: ${err.message}`)
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
      Logger.debug(`[GithubAssetDownloader] Extracted file ${file.pathInsideZip} to ${outputPath}`)

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
      Logger.error(`[GithubAssetDownloader] Error downloading or extracting files: ${error.message}`)
      throw error
    } finally {
      if (zipPath) await fs.remove(zipPath)
    }
  }
}

class FFBinariesDownloader extends GithubAssetDownloader {
  constructor() {
    super('ffbinaries', 'ffbinaries-prebuilt')
  }

  getPlatformSuffix() {
    const platform = process.platform
    const arch = process.arch

    switch (platform) {
      case 'win32':
        return 'win-64'
      case 'darwin':
        return 'macos-64'
      case 'linux':
        switch (arch) {
          case 'x64':
            return 'linux-64'
          case 'x32':
          case 'ia32':
            return 'linux-32'
          case 'arm64':
            return 'linux-arm-64'
          case 'arm':
            return 'linux-armhf-32'
          default:
            throw new Error(`Unsupported architecture: ${arch}`)
        }
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  async downloadBinary(binaryName, releaseTag, destDir) {
    const platformSuffix = this.getPlatformSuffix()
    const assetName = `${binaryName}-${releaseTag}-${platformSuffix}.zip`
    const fileName = process.platform === 'win32' ? `${binaryName}.exe` : binaryName
    const filesToExtract = [{ pathInsideZip: fileName, outputFileName: fileName }]
    releaseTag = `v${releaseTag}`

    await this.downloadAndExtractFiles(releaseTag, assetName, filesToExtract, destDir)
  }
}

class SQLeanDownloader extends GithubAssetDownloader {
  constructor() {
    super('nalgeon', 'sqlean')
  }

  getPlatformSuffix() {
    const platform = process.platform
    const arch = process.arch

    switch (platform) {
      case 'win32':
        return arch === 'x64' ? 'win-x64' : 'win-x86'
      case 'darwin':
        return arch === 'arm64' ? 'macos-arm64' : 'macos-x86'
      case 'linux':
        return arch === 'arm64' ? 'linux-arm64' : 'linux-x86'
      default:
        throw new Error(`Unsupported platform or architecture: ${platform}, ${arch}`)
    }
  }

  getLibraryName(binaryName) {
    const platform = process.platform

    switch (platform) {
      case 'win32':
        return `${binaryName}.dll`
      case 'darwin':
        return `${binaryName}.dylib`
      case 'linux':
        return `${binaryName}.so`
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  async downloadBinary(binaryName, releaseTag, destDir) {
    const platformSuffix = this.getPlatformSuffix()
    const assetName = `sqlean-${platformSuffix}.zip`
    const fileName = this.getLibraryName(binaryName)
    const filesToExtract = [{ pathInsideZip: fileName, outputFileName: fileName }]

    await this.downloadAndExtractFiles(releaseTag, assetName, filesToExtract, destDir)
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
    if (this.type === 'executable') {
      return this.name + (process.platform == 'win32' ? '.exe' : '')
    } else if (this.type === 'library') {
      return this.name + (process.platform == 'win32' ? '.dll' : '.so')
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
const sqlean = new SQLeanDownloader()
module.exports.sqlean = sqlean // for testing

class BinaryManager {
  defaultRequiredBinaries = [
    new Binary('ffmpeg', 'executable', 'FFMPEG_PATH', ['5.1'], ffbinaries), // ffmpeg executable
    new Binary('ffprobe', 'executable', 'FFPROBE_PATH', ['5.1'], ffbinaries), // ffprobe executable
    new Binary('unicode', 'library', 'SQLEAN_UNICODE_PATH', ['0.24.2'], sqlean) // sqlean unicode extension
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
