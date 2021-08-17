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
  return null
}

async function getAllAudiobookFiles(path) {
  console.log('getAllAudiobooks', path)
  var paths = await getPaths(path)
  var books = {}

  paths.files.forEach((filepath) => {
    var relpath = filepath.replace(path, '').slice(1)
    var pathformat = Path.parse(relpath)
    var authordir = Path.dirname(pathformat.dir)
    var bookdir = Path.basename(pathformat.dir)
    if (!books[bookdir]) {
      books[bookdir] = {
        author: authordir,
        title: bookdir,
        path: pathformat.dir,
        fullPath: Path.join(path, pathformat.dir),
        parts: [],
        infos: [],
        images: [],
        ebooks: [],
        otherFiles: []
      }
    }

    var filetype = getFileType(pathformat.ext)
    if (filetype === 'abpart') {
      books[bookdir].parts.push(`${pathformat.name}${pathformat.ext}`)
    } else if (filetype === 'info') {
      books[bookdir].infos.push(`${pathformat.name}${pathformat.ext}`)
    } else if (filetype === 'image') {
      books[bookdir].images.push(`${pathformat.name}${pathformat.ext}`)
    } else if (filetype === 'ebook') {
      books[bookdir].ebooks.push(`${pathformat.name}${pathformat.ext}`)
    } else {
      Logger.warn('Invalid file type', pathformat.name, pathformat.ext)
      books[bookdir].otherFiles.push(`${pathformat.name}${pathformat.ext}`)
    }
  })
  return Object.values(books)
}
module.exports.getAllAudiobookFiles = getAllAudiobookFiles