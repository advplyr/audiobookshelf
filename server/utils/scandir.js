const Path = require('path')
const dir = require('node-dir')
const Logger = require('../Logger')

const AUDIO_FORMATS = ['m4b', 'mp3', 'm4a']
const INFO_FORMATS = ['nfo']
const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'webp']
const EBOOK_FORMATS = ['epub', 'pdf']

function getPaths(path) {
  return new Promise((resolve) => {
    dir.paths(path, function (err, res) {
      if (err) {
        Logger.error(err)
        resolve(false)
      }
      resolve(res)
    })
  })
}

function isAudioFile(path) {
  if (!path) return false
  var ext = Path.extname(path)
  if (!ext) return false
  return AUDIO_FORMATS.includes(ext.slice(1).toLowerCase())
}

function groupFilesIntoAudiobookPaths(paths) {
  // Step 1: Normalize path, Remove leading "/", Filter out files in root dir
  var pathsFiltered = paths.map(path => Path.normalize(path.slice(1))).filter(path => Path.parse(path).dir)

  // Step 2: Sort by least number of directories
  pathsFiltered.sort((a, b) => {
    var pathsA = Path.dirname(a).split(Path.sep).length
    var pathsB = Path.dirname(b).split(Path.sep).length
    return pathsA - pathsB
  })

  // Step 2.5: Seperate audio files and other files
  var audioFilePaths = []
  var otherFilePaths = []
  pathsFiltered.forEach(path => {
    if (isAudioFile(path)) audioFilePaths.push(path)
    else otherFilePaths.push(path)
  })

  // Step 3: Group audio files in audiobooks
  var audiobookGroup = {}
  audioFilePaths.forEach((path) => {
    var dirparts = Path.dirname(path).split(Path.sep)
    var numparts = dirparts.length
    var _path = ''

    // Iterate over directories in path
    for (let i = 0; i < numparts; i++) {
      var dirpart = dirparts.shift()
      _path = Path.join(_path, dirpart)


      if (audiobookGroup[_path]) { // Directory already has files, add file
        var relpath = Path.join(dirparts.join(Path.sep), Path.basename(path))
        audiobookGroup[_path].push(relpath)
        return
      } else if (!dirparts.length) { // This is the last directory, create group
        audiobookGroup[_path] = [Path.basename(path)]
        return
      }
    }
  })

  // Step 4: Add other files into audiobook groups
  otherFilePaths.forEach((path) => {
    var dirparts = Path.dirname(path).split(Path.sep)
    var numparts = dirparts.length
    var _path = ''

    // Iterate over directories in path
    for (let i = 0; i < numparts; i++) {
      var dirpart = dirparts.shift()
      _path = Path.join(_path, dirpart)
      if (audiobookGroup[_path]) { // Directory is audiobook group
        var relpath = Path.join(dirparts.join(Path.sep), Path.basename(path))
        audiobookGroup[_path].push(relpath)
        return
      }
    }
  })
  return audiobookGroup
}
module.exports.groupFilesIntoAudiobookPaths = groupFilesIntoAudiobookPaths

function cleanFileObjects(basepath, abrelpath, files) {
  return files.map((file) => {
    var ext = Path.extname(file)
    return {
      filetype: getFileType(ext),
      filename: Path.basename(file),
      path: Path.join(abrelpath, file), // /AUDIOBOOK/PATH/filename.mp3
      fullPath: Path.join(basepath, file), // /audiobooks/AUDIOBOOK/PATH/filename.mp3
      ext: ext
    }
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

// Primary scan: abRootPath is /audiobooks
async function scanRootDir(abRootPath, serverSettings = {}) {
  var parseSubtitle = !!serverSettings.scannerParseSubtitle

  var pathdata = await getPaths(abRootPath)
  var filepaths = pathdata.files.map(filepath => {
    return Path.normalize(filepath).replace(abRootPath, '')
  })

  var audiobookGrouping = groupFilesIntoAudiobookPaths(filepaths)

  if (!Object.keys(audiobookGrouping).length) {
    Logger.error('Root path has no audiobooks')
    return []
  }

  var audiobooks = []
  for (const audiobookPath in audiobookGrouping) {
    var audiobookData = getAudiobookDataFromDir(abRootPath, audiobookPath, parseSubtitle)

    var fileObjs = cleanFileObjects(audiobookData.fullPath, audiobookPath, audiobookGrouping[audiobookPath])
    audiobooks.push({
      ...audiobookData,
      audioFiles: fileObjs.filter(f => f.filetype === 'audio'),
      otherFiles: fileObjs.filter(f => f.filetype !== 'audio')
    })
  }
  return audiobooks
}
module.exports.scanRootDir = scanRootDir

// Input relative filepath, output all details that can be parsed
function getAudiobookDataFromDir(abRootPath, dir, parseSubtitle = false) {
  var splitDir = dir.split(Path.sep)

  // Audio files will always be in the directory named for the title
  var title = splitDir.pop()
  var series = null
  var author = null
  // If there are at least 2 more directories, next furthest will be the series
  if (splitDir.length > 1) series = splitDir.pop()
  if (splitDir.length > 0) author = splitDir.pop()

  // There could be many more directories, but only the top 3 are used for naming /author/series/title/


  var publishYear = null
  // If Title is of format 1999 - Title, then use 1999 as publish year
  var publishYearMatch = title.match(/^([0-9]{4}) - (.+)/)
  if (publishYearMatch && publishYearMatch.length > 2) {
    if (!isNaN(publishYearMatch[1])) {
      publishYear = publishYearMatch[1]
      title = publishYearMatch[2]
    }
  }

  // Subtitle can be parsed from the title if user enabled
  var subtitle = null
  if (parseSubtitle && title.includes(' - ')) {
    var splitOnSubtitle = title.split(' - ')
    title = splitOnSubtitle.shift()
    subtitle = splitOnSubtitle.join(' - ')
  }

  return {
    author,
    title,
    subtitle,
    series,
    publishYear,
    path: dir, // relative audiobook path i.e. /Author Name/Book Name/..
    fullPath: Path.join(abRootPath, dir) // i.e. /audiobook/Author Name/Book Name/..
  }
}

async function getAudiobookFileData(abRootPath, audiobookPath, serverSettings = {}) {
  var parseSubtitle = !!serverSettings.scannerParseSubtitle

  var paths = await getPaths(audiobookPath)
  var filepaths = paths.files

  // Sort by least number of directories
  filepaths.sort((a, b) => {
    var pathsA = Path.dirname(a).split(Path.sep).length
    var pathsB = Path.dirname(b).split(Path.sep).length
    return pathsA - pathsB
  })

  var audiobookDir = Path.normalize(audiobookPath).replace(abRootPath, '').slice(1)
  var audiobookData = getAudiobookDataFromDir(abRootPath, audiobookDir, parseSubtitle)
  var audiobook = {
    ...audiobookData,
    audioFiles: [],
    otherFiles: []
  }

  filepaths.forEach((filepath) => {
    var relpath = Path.normalize(filepath).replace(abRootPath, '').slice(1)
    var extname = Path.extname(filepath)
    var basename = Path.basename(filepath)
    var fileObj = {
      filetype: getFileType(extname),
      filename: basename,
      path: relpath,
      fullPath: filepath,
      ext: extname
    }
    if (fileObj.filetype === 'audio') {
      audiobook.audioFiles.push(fileObj)
    } else {
      audiobook.otherFiles.push(fileObj)
    }
  })
  return audiobook
}
module.exports.getAudiobookFileData = getAudiobookFileData