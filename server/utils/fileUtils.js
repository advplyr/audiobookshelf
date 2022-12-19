const fs = require('../libs/fsExtra')
const rra = require('../libs/recursiveReaddirAsync')
const axios = require('axios')
const Path = require('path')
const Logger = require('../Logger')
const { AudioMimeType } = require('./constants')

async function getFileStat(path) {
  try {
    var stat = await fs.stat(path)
    return {
      size: stat.size,
      atime: stat.atime,
      mtime: stat.mtime,
      ctime: stat.ctime,
      birthtime: stat.birthtime
    }
  } catch (err) {
    Logger.error('[fileUtils] Failed to stat', err)
    return false
  }
}
module.exports.getFileStat = getFileStat

async function getFileTimestampsWithIno(path) {
  try {
    var stat = await fs.stat(path, { bigint: true })
    return {
      size: Number(stat.size),
      mtimeMs: Number(stat.mtimeMs),
      ctimeMs: Number(stat.ctimeMs),
      birthtimeMs: Number(stat.birthtimeMs),
      ino: String(stat.ino)
    }
  } catch (err) {
    Logger.error('[fileUtils] Failed to getFileTimestampsWithIno', err)
    return false
  }
}
module.exports.getFileTimestampsWithIno = getFileTimestampsWithIno

async function getFileSize(path) {
  var stat = await getFileStat(path)
  if (!stat) return 0
  return stat.size || 0
}
module.exports.getFileSize = getFileSize


function getIno(path) {
  return fs.stat(path, { bigint: true }).then((data => String(data.ino))).catch((err) => {
    Logger.error('[Utils] Failed to get ino for path', path, err)
    return null
  })
}
module.exports.getIno = getIno

async function readTextFile(path) {
  try {
    var data = await fs.readFile(path)
    return String(data)
  } catch (error) {
    Logger.error(`[FileUtils] ReadTextFile error ${error}`)
    return ''
  }
}
module.exports.readTextFile = readTextFile

function bytesPretty(bytes, decimals = 0) {
  if (bytes === 0) {
    return '0 Bytes'
  }
  const k = 1024
  var dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  if (i > 2 && dm === 0) dm = 1
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
module.exports.bytesPretty = bytesPretty

async function recurseFiles(path, relPathToReplace = null) {
  path = path.replace(/\\/g, '/')
  if (!path.endsWith('/')) path = path + '/'

  if (relPathToReplace) {
    relPathToReplace = relPathToReplace.replace(/\\/g, '/')
    if (!relPathToReplace.endsWith('/')) relPathToReplace += '/'
  } else {
    relPathToReplace = path
  }

  const options = {
    mode: rra.LIST,
    recursive: true,
    stats: false,
    ignoreFolders: true,
    extensions: true,
    deep: true,
    realPath: true,
    normalizePath: true
  }
  var list = await rra.list(path, options)
  if (list.error) {
    Logger.error('[fileUtils] Recurse files error', list.error)
    return []
  }

  const directoriesToIgnore = []

  list = list.filter((item) => {
    if (item.error) {
      Logger.error(`[fileUtils] Recurse files file "${item.fullname}" has error`, item.error)
      return false
    }

    var relpath = item.fullname.replace(relPathToReplace, '')
    var reldirname = Path.dirname(relpath)
    if (reldirname === '.') reldirname = ''
    var dirname = Path.dirname(item.fullname)

    // Directory has a file named ".ignore" flag directory and ignore
    if (item.name === '.ignore' && reldirname && reldirname !== '.' && !directoriesToIgnore.includes(dirname)) {
      Logger.debug(`[fileUtils] .ignore found - ignoring directory "${reldirname}"`)
      directoriesToIgnore.push(dirname)
      return false
    }

    // Ignore any file if a directory or the filename starts with "."
    var pathStartsWithPeriod = relpath.split('/').find(p => p.startsWith('.'))
    if (pathStartsWithPeriod) {
      Logger.debug(`[fileUtils] Ignoring path has . "${relpath}"`)
      return false
    }

    return true
  }).filter(item => {
    // Filter out items in ignore directories
    if (directoriesToIgnore.some(dir => item.fullname.startsWith(dir))) {
      Logger.debug(`[fileUtils] Ignoring path in dir with .ignore "${item.fullname}"`)
      return false
    }
    return true
  }).map((item) => {
    var isInRoot = (item.path + '/' === relPathToReplace)
    return {
      name: item.name,
      path: item.fullname.replace(relPathToReplace, ''),
      dirpath: item.path,
      reldirpath: isInRoot ? '' : item.path.replace(relPathToReplace, ''),
      fullpath: item.fullname,
      extension: item.extension,
      deep: item.deep
    }
  })

  // Sort from least deep to most
  list.sort((a, b) => a.deep - b.deep)

  return list
}
module.exports.recurseFiles = recurseFiles

module.exports.downloadFile = async (url, filepath) => {
  Logger.debug(`[fileUtils] Downloading file to ${filepath}`)

  const writer = fs.createWriteStream(filepath)
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 30000
  })
  response.data.pipe(writer)
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}

module.exports.sanitizeFilename = (filename, colonReplacement = ' - ') => {
  if (typeof filename !== 'string') {
    return false
  }

  // Most file systems use number of bytes for max filename
  //   to support most filesystems we will use max of 255 bytes in utf-16
  //   Ref: https://doc.owncloud.com/server/next/admin_manual/troubleshooting/path_filename_length.html
  //   Issue: https://github.com/advplyr/audiobookshelf/issues/1261
  const MAX_FILENAME_BYTES = 255

  const replacement = ''
  const illegalRe = /[\/\?<>\\:\*\|"]/g
  const controlRe = /[\x00-\x1f\x80-\x9f]/g
  const reservedRe = /^\.+$/
  const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i
  const windowsTrailingRe = /[\. ]+$/
  const lineBreaks = /[\n\r]/g

  let sanitized = filename
    .replace(':', colonReplacement) // Replace first occurrence of a colon
    .replace(illegalRe, replacement)
    .replace(controlRe, replacement)
    .replace(reservedRe, replacement)
    .replace(lineBreaks, replacement)
    .replace(windowsReservedRe, replacement)
    .replace(windowsTrailingRe, replacement)

  // Check if basename is too many bytes
  const ext = Path.extname(sanitized) // separate out file extension
  const basename = Path.basename(sanitized, ext)
  const extByteLength = Buffer.byteLength(ext, 'utf16le')
  const basenameByteLength = Buffer.byteLength(basename, 'utf16le')
  if (basenameByteLength + extByteLength > MAX_FILENAME_BYTES) {
    const MaxBytesForBasename = MAX_FILENAME_BYTES - extByteLength
    let totalBytes = 0
    let trimmedBasename = ''

    // Add chars until max bytes is reached
    for (const char of basename) {
      totalBytes += Buffer.byteLength(char, 'utf16le')
      if (totalBytes > MaxBytesForBasename) break
      else trimmedBasename += char
    }

    trimmedBasename = trimmedBasename.trim()
    sanitized = trimmedBasename + ext
  }

  return sanitized
}

// Returns null if extname is not in our defined list of audio extnames
module.exports.getAudioMimeTypeFromExtname = (extname) => {
  if (!extname || !extname.length) return null
  const formatUpper = extname.slice(1).toUpperCase()
  if (AudioMimeType[formatUpper]) return AudioMimeType[formatUpper]
  return null
}

module.exports.removeFile = (path) => {
  if (!path) return false
  return fs.remove(path).then(() => true).catch((error) => {
    Logger.error(`[fileUtils] Failed remove file "${path}"`, error)
    return false
  })
}