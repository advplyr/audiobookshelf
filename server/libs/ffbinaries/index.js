const os = require('os')
const path = require('path')
const axios = require('axios')
const fse = require('../fsExtra')
const async = require('../async')
const StreamZip = require('../nodeStreamZip')
const { finished } = require('stream/promises')

var API_URL = 'https://ffbinaries.com/api/v1'

var RUNTIME_CACHE = {}
var errorMsgs = {
  connectionIssues: 'Couldn\'t connect to ffbinaries.com API. Check your Internet connection.',
  parsingVersionData: 'Couldn\'t parse retrieved version data.',
  parsingVersionList: 'Couldn\'t parse the list of available versions.',
  notFound: 'Requested data not found.',
  incorrectVersionParam: '"version" parameter must be a string.'
}

function ensureDirSync(dir) {
  try {
    fse.accessSync(dir)
  } catch (e) {
    fse.mkdirSync(dir)
  }
}

/**
 * Resolves the platform key based on input string
 */
function resolvePlatform(input) {
  var rtn = null

  switch (input) {
    case 'mac':
    case 'osx':
    case 'mac-64':
    case 'osx-64':
      rtn = 'osx-64'
      break

    case 'linux':
    case 'linux-32':
      rtn = 'linux-32'
      break

    case 'linux-64':
      rtn = 'linux-64'
      break

    case 'linux-arm':
    case 'linux-armel':
      rtn = 'linux-armel'
      break

    case 'linux-armhf':
      rtn = 'linux-armhf'
      break

    case 'win':
    case 'win-32':
    case 'windows':
    case 'windows-32':
      rtn = 'windows-32'
      break

    case 'win-64':
    case 'windows-64':
      rtn = 'windows-64'
      break

    default:
      rtn = null
  }

  return rtn
}
/**
 * Detects the platform of the machine the script is executed on.
 * Object can be provided to detect platform from info derived elsewhere.
 *
 * @param {object} osinfo Contains "type" and "arch" properties
 */
function detectPlatform(osinfo) {
  var inputIsValid = typeof osinfo === 'object' && typeof osinfo.type === 'string' && typeof osinfo.arch === 'string'
  var type = (inputIsValid ? osinfo.type : os.type()).toLowerCase()
  var arch = (inputIsValid ? osinfo.arch : os.arch()).toLowerCase()

  if (type === 'darwin') {
    return 'osx-64'
  }

  if (type === 'windows_nt') {
    return arch === 'x64' ? 'windows-64' : 'windows-32'
  }

  if (type === 'linux') {
    if (arch === 'arm' || arch === 'arm64') {
      return 'linux-armel'
    }
    return arch === 'x64' ? 'linux-64' : 'linux-32'
  }

  return null
}
/**
 * Gets the binary filename (appends exe in Windows)
 *
 * @param {string} component "ffmpeg", "ffplay", "ffprobe" or "ffserver"
 * @param {platform} platform "ffmpeg", "ffplay", "ffprobe" or "ffserver"
 */
function getBinaryFilename(component, platform) {
  var platformCode = resolvePlatform(platform)
  if (platformCode === 'windows-32' || platformCode === 'windows-64') {
    return component + '.exe'
  }
  return component
}

function listPlatforms() {
  return ['osx-64', 'linux-32', 'linux-64', 'linux-armel', 'linux-armhf', 'windows-32', 'windows-64']
}

/**
 * 
 * @returns {Promise<string[]>} array of version strings
 */
function listVersions() {
  if (RUNTIME_CACHE.versionsAll) {
    return RUNTIME_CACHE.versionsAll
  }
  return axios.get(API_URL).then((res) => {
    if (!res.data?.versions || !Object.keys(res.data.versions)?.length) {
      throw new Error(errorMsgs.parsingVersionList)
    }
    const versionKeys = Object.keys(res.data.versions)
    RUNTIME_CACHE.versionsAll = versionKeys
    return versionKeys
  })
}
/**
 * Gets full data set from ffbinaries.com
 */
function getVersionData(version) {
  if (RUNTIME_CACHE[version]) {
    return RUNTIME_CACHE[version]
  }

  if (version && typeof version !== 'string') {
    throw new Error(errorMsgs.incorrectVersionParam)
  }

  var url = version ? '/version/' + version : '/latest'

  return axios.get(`${API_URL}${url}`).then((res) => {
    RUNTIME_CACHE[version] = res.data
    return res.data
  }).catch((error) => {
    if (error.response?.status == 404) {
      throw new Error(errorMsgs.notFound)
    } else {
      throw new Error(errorMsgs.connectionIssues)
    }
  })
}

/**
 * Download file(s) and save them in the specified directory
 */
async function downloadUrls(components, urls, opts) {
  const destinationDir = opts.destination
  const results = []
  const remappedUrls = []

  if (components && !Array.isArray(components)) {
    components = [components]
  } else if (!components || !Array.isArray(components)) {
    components = []
  }

  // returns an array of objects like this: {component: 'ffmpeg', url: 'https://...'}
  if (typeof urls === 'object') {
    for (const key in urls) {
      if (components.includes(key) && urls[key]) {
        remappedUrls.push({
          component: key,
          url: urls[key]
        })
      }
    }
  }


  async function extractZipToDestination(zipFilename) {
    const oldpath = path.join(destinationDir, zipFilename)
    const zip = new StreamZip.async({ file: oldpath })
    const count = await zip.extract(null, destinationDir)
    await zip.close()
  }


  await async.each(remappedUrls, async function (urlObject) {
    try {
      const url = urlObject.url

      const zipFilename = url.split('/').pop()
      const binFilenameBase = urlObject.component
      const binFilename = getBinaryFilename(binFilenameBase, opts.platform || detectPlatform())
      
      let runningTotal = 0
      let totalFilesize
      let interval

      
      if (typeof opts.tickerFn === 'function') {
        opts.tickerInterval = parseInt(opts.tickerInterval, 10)
        const tickerInterval = (!Number.isNaN(opts.tickerInterval)) ? opts.tickerInterval : 1000
        const tickData = { filename: zipFilename, progress: 0 }

        // Schedule next ticks
        interval = setInterval(function () {
          if (totalFilesize && runningTotal == totalFilesize) {
            return clearInterval(interval)
          }
          tickData.progress = totalFilesize > -1 ? runningTotal / totalFilesize : 0

          opts.tickerFn(tickData)
        }, tickerInterval)
      }
      

      // Check if file already exists in target directory
      const binPath = path.join(destinationDir, binFilename)
      if (!opts.force && await fse.pathExists(binPath)) {
        // if the accessSync method doesn't throw we know the binary already exists
        results.push({
          filename: binFilename,
          path: destinationDir,
          status: 'File exists',
          code: 'FILE_EXISTS'
        })
        clearInterval(interval)
        return
      }

      if (opts.quiet) clearInterval(interval)

      const zipPath = path.join(destinationDir, zipFilename)
      const zipFileTempName = zipPath + '.part'
      const zipFileFinalName = zipPath

      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
      })
      totalFilesize = response.headers?.['content-length'] || []

      const writer = fse.createWriteStream(zipFileTempName)
      response.data.on('data', (chunk) => {        
        runningTotal += chunk.length
      }) 
      response.data.pipe(writer)
      await finished(writer)
      await fse.rename(zipFileTempName, zipFileFinalName)
      await extractZipToDestination(zipFilename)
      await fse.remove(zipFileFinalName)

      results.push({
        filename: binFilename,
        path: destinationDir,
        size: Math.floor(totalFilesize / 1024 / 1024 * 1000) / 1000 + 'MB',
        status: 'File extracted to destination (downloaded from "' + url + '")',
        code: 'DONE_CLEAN'
      })
    } catch (err) {
      console.error(`Failed to download or extract file for component: ${urlObject.component}`, err)
    }
  })

  return results
}

/**
 * Gets binaries for the platform
 * It will get the data from ffbinaries, pick the correct files
 * and save it to the specified directory
 *
 * @param {Array} components
 * @param {Object} [opts]
 */
async function downloadBinaries(components, opts = {}) {
  var platform = resolvePlatform(opts.platform) || detectPlatform()

  opts.destination = path.resolve(opts.destination || '.')
  ensureDirSync(opts.destination)

  const versionData = await getVersionData(opts.version)
  const urls = versionData?.bin?.[platform]
  if (!urls) {
    throw new Error('No URLs!')
  }

  return await downloadUrls(components, urls, opts)
}

module.exports = {
  downloadBinaries: downloadBinaries,
  getVersionData: getVersionData,
  listVersions: listVersions,
  listPlatforms: listPlatforms,
  detectPlatform: detectPlatform,
  resolvePlatform: resolvePlatform,
  getBinaryFilename: getBinaryFilename
}