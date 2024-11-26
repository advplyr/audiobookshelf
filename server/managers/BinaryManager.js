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

    try {
      for (const file of filesToExtract) {
        const outputPath = path.join(destDir, file.outputFileName)
        if (!(await zip.entry(file.pathInsideZip))) {
          Logger.error(`[ZippedAssetDownloader] File ${file.pathInsideZip} not found in zip file ${zipPath}`)
          continue
        }
        await zip.extract(file.pathInsideZip, outputPath)
        Logger.debug(`[ZippedAssetDownloader] Extracted file ${file.pathInsideZip} to ${outputPath}`)

        // Set executable permission for Linux
        if (process.platform !== 'win32') {
          await fs.chmod(outputPath, 0o755)
        }
      }
    } catch (error) {
      Logger.error('[ZippedAssetDownloader] Error extracting files:', error)
      throw error
    } finally {
      await zip.close()
    }
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

class NunicodeDownloader extends ZippedAssetDownloader {
  constructor() {
    super()
    this.platformSuffix = this.getPlatformSuffix()
  }

  getPlatformSuffix() {
    const platform = process.platform
    const arch = process.arch

    if (platform === 'win32' && arch === 'x64') {
      return 'win-x64'
    } else if (platform === 'darwin' && (arch === 'x64' || arch === 'arm64')) {
      return 'osx-arm64'
    } else if (platform === 'linux' && arch === 'x64') {
      return 'linux-x64'
    } else if (platform === 'linux' && arch === 'arm64') {
      return 'linux-arm64'
    }

    return null
  }

  async getAssetUrl(releaseTag, assetName) {
    return `https://github.com/mikiher/nunicode-sqlite/releases/download/v${releaseTag}/${assetName}`
  }

  getAssetName(binaryName, releaseTag) {
    if (!this.platformSuffix) {
      throw new Error(`[NunicodeDownloader] Platform ${process.platform}-${process.arch} not supported`)
    }
    return `${binaryName}-${this.platformSuffix}.zip`
  }

  getAssetFileName(binaryName) {
    if (process.platform === 'win32') {
      return `${binaryName}.dll`
    } else if (process.platform === 'darwin') {
      return `${binaryName}.dylib`
    } else if (process.platform === 'linux') {
      return `${binaryName}.so`
    }

    throw new Error(`[NunicodeDownloader] Platform ${process.platform} not supported`)
  }
}

class Binary {
  constructor(name, type, envVariable, validVersions, source, required = true) {
    if (!name) throw new Error('Binary name is required')
    this.name = name
    if (!type) throw new Error('Binary type is required')
    this.type = type
    if (!envVariable) throw new Error('Binary environment variable name is required')
    this.envVariable = envVariable
    if (!validVersions || !validVersions.length) throw new Error(`No valid versions specified for ${type} ${name}. At least one version is required.`)
    this.validVersions = validVersions
    if (!source || !(source instanceof ZippedAssetDownloader)) throw new Error('Binary source is required, and must be an instance of ZippedAssetDownloader')
    this.source = source
    this.fileName = this.getFileName()
    this.required = required
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

  async isLibraryVersionValid(libraryPath) {
    try {
      const versionFilePath = libraryPath + '.ver'
      if (!(await fs.pathExists(versionFilePath))) return false
      const version = (await fs.readFile(versionFilePath, 'utf8')).trim()
      return this.validVersions.some((validVersion) => version.startsWith(validVersion))
    } catch (err) {
      Logger.error(`[Binary] Failed to check version of ${libraryPath}`, err)
      return false
    }
  }

  async isExecutableVersionValid(executablePath) {
    try {
      const { stdout } = await this.exec('"' + executablePath + '"' + ' -version')
      const version = stdout.match(/version\s([\d\.]+)/)?.[1]
      if (!version) return false
      return this.validVersions.some((validVersion) => version.startsWith(validVersion))
    } catch (err) {
      Logger.error(`[Binary] Failed to check version of ${executablePath}`, err)
      return false
    }
  }

  async isGood(binaryPath) {
    try {
      if (!binaryPath || !(await fs.pathExists(binaryPath))) return false
      if (this.type === 'library') return await this.isLibraryVersionValid(binaryPath)
      else if (this.type === 'executable') return await this.isExecutableVersionValid(binaryPath)
      else return true
    } catch (err) {
      Logger.error(`[Binary] Failed to check ${this.type} ${this.name} at ${binaryPath}`, err)
      return false
    }
  }

  async download(destination) {
    const version = this.validVersions[0]
    try {
      await this.source.downloadBinary(this.name, version, destination)
      // if it's a library, write the version string to a file
      if (this.type === 'library') {
        const libraryPath = path.join(destination, this.fileName)
        await fs.writeFile(libraryPath + '.ver', version)
      }
    } catch (err) {
      Logger.error(`[Binary] Failed to download ${this.type} ${this.name} version ${version} to ${destination}`, err)
    }
  }
}

const ffbinaries = new FFBinariesDownloader()
const nunicode = new NunicodeDownloader()

class BinaryManager {
  defaultRequiredBinaries = [
    new Binary('ffmpeg', 'executable', 'FFMPEG_PATH', ['5.1'], ffbinaries), // ffmpeg executable
    new Binary('ffprobe', 'executable', 'FFPROBE_PATH', ['5.1'], ffbinaries), // ffprobe executable
    new Binary('libnusqlite3', 'library', 'NUSQLITE3_PATH', ['1.2'], nunicode, false) // nunicode sqlite3 extension
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
        if (!process.env[binary.envVariable] && binary.required) {
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
    const missingRequiredBinryNames = missingBinariesAfterInstall.filter((binary) => binary.required).map((binary) => binary.name)
    if (missingRequiredBinryNames.length) {
      Logger.error(`[BinaryManager] Failed to find or install required binaries: ${missingRequiredBinryNames.join(', ')}`)
      process.exit(1)
    }
    this.initialized = true
  }

  /**
   * Remove binary
   *
   * @param {string} destination
   * @param {Binary} binary
   */
  async removeBinary(destination, binary) {
    try {
      const binaryPath = path.join(destination, binary.fileName)
      if (await fs.pathExists(binaryPath)) {
        Logger.debug(`[BinaryManager] Removing binary: ${binaryPath}`)
        await fs.remove(binaryPath)
      }
    } catch (err) {
      Logger.error(`[BinaryManager] Error removing binary: ${binaryPath}`)
    }
  }

  /**
   * Remove old binaries
   *
   * @param {Binary[]} binaries
   */
  async removeOldBinaries(binaries) {
    for (const binary of binaries) {
      await this.removeBinary(this.mainInstallDir, binary)
      await this.removeBinary(this.altInstallDir, binary)
    }
  }

  /**
   * Find required binaries and return array of binary names that are missing
   *
   * @returns {Promise<Binary[]>} Array of missing binaries
   */
  async findRequiredBinaries() {
    const missingBinaries = []
    for (const binary of this.requiredBinaries) {
      const binaryPath = await binary.find(this.mainInstallDir, this.altInstallDir)
      if (binaryPath) {
        Logger.info(`[BinaryManager] Found valid ${binary.type} ${binary.name} at ${binaryPath}`)
        if (process.env[binary.envVariable] !== binaryPath) {
          Logger.info(`[BinaryManager] Updating process.env.${binary.envVariable}`)
          process.env[binary.envVariable] = binaryPath
        }
      } else {
        Logger.info(`[BinaryManager] ${binary.name} not found or not a valid version`)
        missingBinaries.push(binary)
      }
    }
    return missingBinaries
  }

  /**
   * Install missing binaries
   *
   * @param {Binary[]} binaries
   */
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
module.exports.ffbinaries = ffbinaries // for testing
module.exports.nunicode = nunicode // for testing
