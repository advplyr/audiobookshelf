const Path = require('path')
const fs = require('fs-extra')
const dir = require('node-dir')
const Logger = require('../Logger')
const { getIno } = require('./index')
const globals = require('./globals')

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

function isBookFile(path) {
  if (!path) return false
  var ext = Path.extname(path)
  if (!ext) return false
  var extclean = ext.slice(1).toLowerCase()
  return globals.SupportedAudioTypes.includes(extclean) || globals.SupportedEbookTypes.includes(extclean)
}

// Input: array of relative file paths
// Output: map of files grouped into potential audiobook dirs
function groupFilesIntoAudiobookPaths(paths, useAllFileTypes = false) {
  // Step 1: Normalize path, Remove leading "/", Filter out files in root dir
  var pathsFiltered = paths.map(path => Path.normalize(path.slice(1))).filter(path => Path.parse(path).dir)

  // Step 2: Sort by least number of directories
  pathsFiltered.sort((a, b) => {
    var pathsA = Path.dirname(a).split(Path.sep).length
    var pathsB = Path.dirname(b).split(Path.sep).length
    return pathsA - pathsB
  })

  // Step 2.5: Seperate audio/ebook files and other files (optional)
  //              - Directories without an audio or ebook file will not be included
  var bookFilePaths = []
  var otherFilePaths = []
  pathsFiltered.forEach(path => {
    if (isBookFile(path) || useAllFileTypes) bookFilePaths.push(path)
    else otherFilePaths.push(path)
  })

  // Step 3: Group audio files in audiobooks
  var audiobookGroup = {}
  bookFilePaths.forEach((path) => {
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
  if (globals.SupportedAudioTypes.includes(ext_cleaned)) return 'audio'
  if (ext_cleaned === 'nfo') return 'info'
  if (ext_cleaned === 'txt') return 'text'
  if (globals.SupportedImageTypes.includes(ext_cleaned)) return 'image'
  if (globals.SupportedEbookTypes.includes(ext_cleaned)) return 'ebook'
  return 'unknown'
}

// Scan folder
async function scanRootDir(folder, serverSettings = {}) {
  var folderPath = folder.fullPath
  var parseSubtitle = !!serverSettings.scannerParseSubtitle

  var pathExists = await fs.pathExists(folderPath)
  if (!pathExists) {
    Logger.error(`[scandir] Invalid folder path does not exist "${folderPath}"`)
    return []
  }

  var pathdata = await getPaths(folderPath)
  var filepaths = pathdata.files.map(filepath => {
    return Path.normalize(filepath).replace(folderPath, '')
  })

  var audiobookGrouping = groupFilesIntoAudiobookPaths(filepaths)

  if (!Object.keys(audiobookGrouping).length) {
    Logger.error('Root path has no audiobooks', filepaths)
    return []
  }

  var audiobooks = []
  for (const audiobookPath in audiobookGrouping) {
    var audiobookData = getAudiobookDataFromDir(folderPath, audiobookPath, parseSubtitle)

    var fileObjs = cleanFileObjects(audiobookData.fullPath, audiobookPath, audiobookGrouping[audiobookPath])
    for (let i = 0; i < fileObjs.length; i++) {
      fileObjs[i].ino = await getIno(fileObjs[i].fullPath)
    }
    var audiobookIno = await getIno(audiobookData.fullPath)
    audiobooks.push({
      folderId: folder.id,
      libraryId: folder.libraryId,
      ino: audiobookIno,
      ...audiobookData,
      audioFiles: fileObjs.filter(f => f.filetype === 'audio'),
      otherFiles: fileObjs.filter(f => f.filetype !== 'audio')
    })
  }
  return audiobooks
}
module.exports.scanRootDir = scanRootDir

// Input relative filepath, output all details that can be parsed
function getAudiobookDataFromDir(folderPath, dir, parseSubtitle = false) {
  var splitDir = dir.split(Path.sep)

  // Audio files will always be in the directory named for the title
  var title = splitDir.pop()
  var series = null
  var author = null
  // If there are at least 2 more directories, next furthest will be the series
  if (splitDir.length > 1) series = splitDir.pop()
  if (splitDir.length > 0) author = splitDir.pop()
  // There could be many more directories, but only the top 3 are used for naming /author/series/title/


  // If in a series directory check for volume number match
  /* ACCEPTS:
    Book 2 - Title Here - Subtitle Here
    Title Here - Subtitle Here - Vol 12
    Title Here - volume 9 - Subtitle Here
    Vol. 3 Title Here - Subtitle Here
    1980 - Book 2-Title Here
    Title Here-Volume 999-Subtitle Here
  */
  var volumeNumber = null
  if (series) {
    var volumeMatch = title.match(/(-? ?)\b((?:Book|Vol.?|Volume) (\d{1,3}))\b( ?-?)/i)
    if (volumeMatch && volumeMatch.length > 3 && volumeMatch[2] && volumeMatch[3]) {
      volumeNumber = volumeMatch[3]
      var replaceChunk = volumeMatch[2]

      // "1980 - Book 2-Title Here"
      // Group 1 would be "- "
      // Group 3 would be "-"
      // Only remove the first group
      if (volumeMatch[1]) {
        replaceChunk = volumeMatch[1] + replaceChunk
      } else if (volumeMatch[4]) {
        replaceChunk += volumeMatch[4]
      }
      title = title.replace(replaceChunk, '').trim()
    }
  }


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
  // Subtitle is everything after " - "
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
    volumeNumber,
    publishYear,
    path: dir, // relative audiobook path i.e. /Author Name/Book Name/..
    fullPath: Path.join(folderPath, dir) // i.e. /audiobook/Author Name/Book Name/..
  }
}

async function getAudiobookFileData(folder, audiobookPath, serverSettings = {}) {
  var parseSubtitle = !!serverSettings.scannerParseSubtitle

  var paths = await getPaths(audiobookPath)
  var filepaths = paths.files

  // Sort by least number of directories
  filepaths.sort((a, b) => {
    var pathsA = Path.dirname(a).split(Path.sep).length
    var pathsB = Path.dirname(b).split(Path.sep).length
    return pathsA - pathsB
  })

  var audiobookDir = Path.normalize(audiobookPath).replace(folder.fullPath, '').slice(1)
  var audiobookData = getAudiobookDataFromDir(folder.fullPath, audiobookDir, parseSubtitle)
  var audiobook = {
    ino: await getIno(audiobookData.fullPath),
    folderId: folder.id,
    libraryId: folder.libraryId,
    ...audiobookData,
    audioFiles: [],
    otherFiles: []
  }

  for (let i = 0; i < filepaths.length; i++) {
    var filepath = filepaths[i]

    var relpath = Path.normalize(filepath).replace(folder.fullPath, '').slice(1)
    var extname = Path.extname(filepath)
    var basename = Path.basename(filepath)
    var ino = await getIno(filepath)
    var fileObj = {
      ino,
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
  }
  return audiobook
}
module.exports.getAudiobookFileData = getAudiobookFileData