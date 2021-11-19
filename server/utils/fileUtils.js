const fs = require('fs-extra')
const rra = require('recursive-readdir-async')
const axios = require('axios')
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

async function getFileSize(path) {
  var stat = await getFileStat(path)
  if (!stat) return 0
  return stat.size || 0
}
module.exports.getFileSize = getFileSize

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

function elapsedPretty(seconds) {
  var minutes = Math.floor(seconds / 60)
  if (minutes < 70) {
    return `${minutes} min`
  }
  var hours = Math.floor(minutes / 60)
  minutes -= hours * 60
  if (!minutes) {
    return `${hours} hr`
  }
  return `${hours} hr ${minutes} min`
}
module.exports.elapsedPretty = elapsedPretty

function secondsToTimestamp(seconds) {
  var _seconds = seconds
  var _minutes = Math.floor(seconds / 60)
  _seconds -= _minutes * 60
  var _hours = Math.floor(_minutes / 60)
  _minutes -= _hours * 60
  _seconds = Math.floor(_seconds)
  if (!_hours) {
    return `${_minutes}:${_seconds.toString().padStart(2, '0')}`
  }
  return `${_hours}:${_minutes.toString().padStart(2, '0')}:${_seconds.toString().padStart(2, '0')}`
}
module.exports.secondsToTimestamp = secondsToTimestamp

function setFileOwner(path, uid, gid) {
  try {
    return fs.chown(path, uid, gid).then(() => true)
  } catch (err) {
    console.error('Failed set file owner', err)
    return false
  }
}
module.exports.setFileOwner = setFileOwner

async function recurseFiles(path) {
  path = path.replace(/\\/g, '/')
  if (!path.endsWith('/')) path = path + '/'

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

  list = list.filter((item) => {
    if (item.error) {
      Logger.error(`[fileUtils] Recurse files file "${item.fullName}" has error`, item.error)
      return false
    }

    // Ignore any file if a directory or the filename starts with "."
    var relpath = item.fullname.replace(path, '')
    var pathStartsWithPeriod = relpath.split('/').find(p => p.startsWith('.'))
    if (pathStartsWithPeriod) {
      Logger.debug(`[fileUtils] Ignoring path has . "${relpath}"`)
      return false
    }

    return true
  }).map((item) => ({
    name: item.name,
    path: item.fullname.replace(path, ''),
    dirpath: item.path,
    reldirpath: item.path.replace(path, ''),
    fullpath: item.fullname,
    extension: item.extension,
    deep: item.deep
  }))

  // Sort from least deep to most
  list.sort((a, b) => a.deep - b.deep)

  // list.forEach((l) => {
  //   console.log(`${l.deep}: ${l.path}`)
  // })
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