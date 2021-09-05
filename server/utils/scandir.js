const Path = require('path')
const dir = require('node-dir')
const Logger = require('../Logger')
const { cleanString } = require('./index')

const AUDIO_FORMATS = ['m4b', 'mp3', 'm4a']
const INFO_FORMATS = ['nfo']
const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'webp']
const EBOOK_FORMATS = ['epub', 'pdf']

function getPaths(path) {
  return new Promise((resolve) => {
    dir.paths(path, function (err, res) {
      if (err) {
        console.error(err)
        resolve(false)
      }
      resolve(res)
    })
  })
}

function getFileType(ext) {
  var ext_cleaned = ext.toLowerCase()
  if (ext_cleaned.startsWith('.')) ext_cleaned = ext_cleaned.slice(1)
  if (AUDIO_FORMATS.includes(ext_cleaned)) return 'audio'
  if (INFO_FORMATS.includes(ext_cleaned)) return 'info'
  if (IMAGE_FORMATS.includes(ext_cleaned)) return 'image'
  if (EBOOK_FORMATS.includes(ext_cleaned)) return 'ebook'
  return 'unknown'
}

async function getAllAudiobookFiles(abRootPath, serverSettings = {}) {
  var parseSubtitle = !!serverSettings.scannerParseSubtitle

  var paths = await getPaths(abRootPath)
  var audiobooks = {}

  paths.files.forEach((filepath) => {
    var relpath = Path.normalize(filepath).replace(abRootPath, '').slice(1)
    var pathformat = Path.parse(relpath)
    var path = pathformat.dir

    if (!path) {
      Logger.error('Ignoring file in root dir', filepath)
      return
    }

    // If relative file directory has 3 folders, then the middle folder will be series
    var splitDir = pathformat.dir.split(Path.sep)
    var author = null
    if (splitDir.length > 1) author = splitDir.shift()
    var series = null
    if (splitDir.length > 1) series = splitDir.shift()
    var title = splitDir.shift()

    var publishYear = null
    var subtitle = null

    // If Title is of format 1999 - Title, then use 1999 as publish year
    var publishYearMatch = title.match(/^([0-9]{4}) - (.+)/)
    if (publishYearMatch && publishYearMatch.length > 2) {
      if (!isNaN(publishYearMatch[1])) {
        publishYear = publishYearMatch[1]
        title = publishYearMatch[2]
      }
    }

    if (parseSubtitle && title.includes(' - ')) {
      var splitOnSubtitle = title.split(' - ')
      title = splitOnSubtitle.shift()
      subtitle = splitOnSubtitle.join(' - ')
    }

    if (!audiobooks[path]) {
      audiobooks[path] = {
        author,
        title,
        subtitle,
        series: cleanString(series),
        publishYear: publishYear,
        path: path,
        fullPath: Path.join(abRootPath, path),
        audioFiles: [],
        otherFiles: []
      }
    }
    var fileObj = {
      filetype: getFileType(pathformat.ext),
      filename: pathformat.base,
      path: relpath,
      fullPath: filepath,
      ext: pathformat.ext
    }
    if (fileObj.filetype === 'audio') {
      audiobooks[path].audioFiles.push(fileObj)
    } else {
      audiobooks[path].otherFiles.push(fileObj)
    }
  })
  return Object.values(audiobooks)
}
module.exports.getAllAudiobookFiles = getAllAudiobookFiles