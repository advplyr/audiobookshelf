const Path = require('path')
const dir = require('node-dir')
const Logger = require('../Logger')

const AUDIOBOOK_PARTS_FORMATS = ['m4b', 'mp3']
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
  if (AUDIOBOOK_PARTS_FORMATS.includes(ext_cleaned)) return 'abpart'
  if (INFO_FORMATS.includes(ext_cleaned)) return 'info'
  if (IMAGE_FORMATS.includes(ext_cleaned)) return 'image'
  if (EBOOK_FORMATS.includes(ext_cleaned)) return 'ebook'
  return 'unknown'
}

async function getAllAudiobookFiles(abRootPath) {
  var paths = await getPaths(abRootPath)
  var audiobooks = {}

  paths.files.forEach((filepath) => {
    var relpath = filepath.replace(abRootPath, '').slice(1)
    var pathformat = Path.parse(relpath)
    var path = pathformat.dir

    // If relative file directory has 3 folders, then the middle folder will be series
    var splitDir = pathformat.dir.split(Path.sep)
    if (splitDir.length === 1) {
      Logger.error('Invalid file in root dir', filepath)
      return
    }
    var author = splitDir.shift()
    var series = null
    if (splitDir.length > 1) series = splitDir.shift()
    var title = splitDir.shift()

    var publishYear = null

    // If Title is of format 1999 - Title, then use 1999 as publish year
    var publishYearMatch = title.match(/^([0-9]{4}) - (.+)/)
    if (publishYearMatch && publishYearMatch.length > 2) {
      if (!isNaN(publishYearMatch[1])) {
        publishYear = publishYearMatch[1]
        title = publishYearMatch[2]
      }
    }

    if (!audiobooks[path]) {
      audiobooks[path] = {
        author: author,
        title: title,
        series: series,
        publishYear: publishYear,
        path: relpath,
        fullPath: Path.join(abRootPath, path),
        parts: [],
        otherFiles: []
      }
    }

    var filetype = getFileType(pathformat.ext)
    if (filetype === 'abpart') {
      audiobooks[path].parts.push(pathformat.base)
    } else {
      var fileObj = {
        filetype: filetype,
        filename: pathformat.base,
        path: relpath,
        fullPath: filepath,
        ext: pathformat.ext
      }
      audiobooks[path].otherFiles.push(fileObj)
    }
  })
  return Object.values(audiobooks)
}
module.exports.getAllAudiobookFiles = getAllAudiobookFiles