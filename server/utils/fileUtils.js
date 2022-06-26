const fs = require('fs-extra')
const rra = require('recursive-readdir-async')
const axios = require('axios')
const Path = require('path')
const Logger = require('../Logger')

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
    console.error('Failed to stat', err)
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
    console.error('Failed to getFileTimestampsWithIno', err)
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
    if (directoriesToIgnore.includes(Path.dirname(item.fullname))) {
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
    responseType: 'stream'
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

  // Max is actually 255-260 for windows but this leaves padding incase ext wasnt put on yet
  const MAX_FILENAME_LEN = 240

  var replacement = ''
  var illegalRe = /[\/\?<>\\:\*\|"]/g
  var controlRe = /[\x00-\x1f\x80-\x9f]/g
  var reservedRe = /^\.+$/
  var windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i
  var windowsTrailingRe = /[\. ]+$/
  var lineBreaks = /[\n\r]/g

  sanitized = filename
    .replace(':', colonReplacement) // Replace first occurrence of a colon
    .replace(illegalRe, replacement)
    .replace(controlRe, replacement)
    .replace(reservedRe, replacement)
    .replace(lineBreaks, replacement)
    .replace(windowsReservedRe, replacement)
    .replace(windowsTrailingRe, replacement)

  if (sanitized.length > MAX_FILENAME_LEN) {
    var lenToRemove = sanitized.length - MAX_FILENAME_LEN
    var ext = Path.extname(sanitized)
    var basename = Path.basename(sanitized, ext)
    basename = basename.slice(0, basename.length - lenToRemove)
    sanitized = basename + ext
  }

  return sanitized
}
