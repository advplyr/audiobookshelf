const fs = require('fs-extra')

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

function bytesPretty(bytes, decimals = 0) {
  if (bytes === 0) {
    return '0 Bytes'
  }
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
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
  _seconds = Math.round(_seconds)
  if (!_hours) {
    return `${_minutes}:${_seconds.toString().padStart(2, '0')}`
  }
  return `${_hours}:${_minutes.toString().padStart(2, '0')}:${_seconds.toString().padStart(2, '0')}`
}
module.exports.secondsToTimestamp = secondsToTimestamp