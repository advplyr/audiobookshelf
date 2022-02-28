const Path = require('path')
const fs = require('fs-extra')
const Logger = require('../Logger')
const { recurseFiles, getFileTimestampsWithIno } = require('./fileUtils')
const globals = require('./globals')

function isBookFile(path) {
  if (!path) return false
  var ext = Path.extname(path)
  if (!ext) return false
  var extclean = ext.slice(1).toLowerCase()
  return globals.SupportedAudioTypes.includes(extclean) || globals.SupportedEbookTypes.includes(extclean)
}

// TODO: Function needs to be re-done
// Input: array of relative file paths
// Output: map of files grouped into potential audiobook dirs
function groupFilesIntoAudiobookPaths(paths) {
  // Step 1: Clean path, Remove leading "/", Filter out files in root dir
  var pathsFiltered = paths.map(path => {
    return path.startsWith('/') ? path.slice(1) : path
  }).filter(path => Path.parse(path).dir)

  // Step 2: Sort by least number of directories
  pathsFiltered.sort((a, b) => {
    var pathsA = Path.dirname(a).split('/').length
    var pathsB = Path.dirname(b).split('/').length
    return pathsA - pathsB
  })

  // Step 3: Group files in dirs
  var audiobookGroup = {}
  pathsFiltered.forEach((path) => {
    var dirparts = Path.dirname(path).split('/')
    var numparts = dirparts.length
    var _path = ''

    // Iterate over directories in path
    for (let i = 0; i < numparts; i++) {
      var dirpart = dirparts.shift()
      _path = Path.posix.join(_path, dirpart)

      if (audiobookGroup[_path]) { // Directory already has files, add file
        var relpath = Path.posix.join(dirparts.join('/'), Path.basename(path))
        audiobookGroup[_path].push(relpath)
        return
      } else if (!dirparts.length) { // This is the last directory, create group
        audiobookGroup[_path] = [Path.basename(path)]
        return
      }
    }
  })
  return audiobookGroup
}
module.exports.groupFilesIntoAudiobookPaths = groupFilesIntoAudiobookPaths

// Input: array of relative file items (see recurseFiles)
// Output: map of files grouped into potential audiobook dirs
function groupFileItemsIntoBooks(fileItems) {
  // Step 1: Filter out files in root dir (with depth of 0)
  var itemsFiltered = fileItems.filter(i => i.deep > 0)

  // Step 2: Seperate audio/ebook files and other files
  //     - Directories without an audio or ebook file will not be included
  var bookFileItems = []
  var otherFileItems = []
  itemsFiltered.forEach(item => {
    if (isBookFile(item.fullpath)) bookFileItems.push(item)
    else otherFileItems.push(item)
  })

  // Step 3: Group audio files in audiobooks
  var audiobookGroup = {}
  bookFileItems.forEach((item) => {
    var dirparts = item.reldirpath.split('/')
    var numparts = dirparts.length
    var _path = ''

    // Iterate over directories in path
    for (let i = 0; i < numparts; i++) {
      var dirpart = dirparts.shift()
      _path = Path.posix.join(_path, dirpart)

      if (audiobookGroup[_path]) { // Directory already has files, add file
        var relpath = Path.posix.join(dirparts.join('/'), item.name)
        audiobookGroup[_path].push(relpath)
        return
      } else if (!dirparts.length) { // This is the last directory, create group
        audiobookGroup[_path] = [item.name]
        return
      }
    }
  })

  // Step 4: Add other files into audiobook groups
  otherFileItems.forEach((item) => {
    var dirparts = item.reldirpath.split('/')
    var numparts = dirparts.length
    var _path = ''

    // Iterate over directories in path
    for (let i = 0; i < numparts; i++) {
      var dirpart = dirparts.shift()
      _path = Path.posix.join(_path, dirpart)
      if (audiobookGroup[_path]) { // Directory is audiobook group
        var relpath = Path.posix.join(dirparts.join('/'), item.name)
        audiobookGroup[_path].push(relpath)
        return
      }
    }
  })
  return audiobookGroup
}

function cleanFileObjects(basepath, abrelpath, files) {
  return Promise.all(files.map(async (file) => {
    var fullPath = Path.posix.join(basepath, file)
    var fileTsData = await getFileTimestampsWithIno(fullPath)

    var ext = Path.extname(file)
    return {
      filetype: getFileType(ext),
      filename: Path.basename(file),
      path: Path.posix.join(abrelpath, file), // /AUDIOBOOK/PATH/filename.mp3
      fullPath, // /audiobooks/AUDIOBOOK/PATH/filename.mp3
      ext: ext,
      ...fileTsData
    }
  }))
}

function getFileType(ext) {
  var ext_cleaned = ext.toLowerCase()
  if (ext_cleaned.startsWith('.')) ext_cleaned = ext_cleaned.slice(1)
  if (globals.SupportedAudioTypes.includes(ext_cleaned)) return 'audio'
  if (globals.SupportedImageTypes.includes(ext_cleaned)) return 'image'
  if (globals.SupportedEbookTypes.includes(ext_cleaned)) return 'ebook'
  if (ext_cleaned === 'nfo') return 'info'
  if (ext_cleaned === 'txt') return 'text'
  if (ext_cleaned === 'opf') return 'opf'
  return 'unknown'
}

// Scan folder
async function scanRootDir(folder, serverSettings = {}) {
  var folderPath = folder.fullPath.replace(/\\/g, '/')
  var parseSubtitle = !!serverSettings.scannerParseSubtitle

  var pathExists = await fs.pathExists(folderPath)
  if (!pathExists) {
    Logger.error(`[scandir] Invalid folder path does not exist "${folderPath}"`)
    return []
  }

  var fileItems = await recurseFiles(folderPath)

  var audiobookGrouping = groupFileItemsIntoBooks(fileItems)

  if (!Object.keys(audiobookGrouping).length) {
    Logger.error('Root path has no books', fileItems.length)
    return []
  }

  var audiobooks = []
  for (const audiobookPath in audiobookGrouping) {
    var audiobookData = getAudiobookDataFromDir(folderPath, audiobookPath, parseSubtitle)

    var fileObjs = await cleanFileObjects(audiobookData.fullPath, audiobookPath, audiobookGrouping[audiobookPath])
    var audiobookFolderStats = await getFileTimestampsWithIno(audiobookData.fullPath)
    audiobooks.push({
      folderId: folder.id,
      libraryId: folder.libraryId,
      ino: audiobookFolderStats.ino,
      mtimeMs: audiobookFolderStats.mtimeMs || 0,
      ctimeMs: audiobookFolderStats.ctimeMs || 0,
      birthtimeMs: audiobookFolderStats.birthtimeMs || 0,
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
  dir = dir.replace(/\\/g, '/')
  var splitDir = dir.split('/')

  // Audio files will always be in the directory named for the title
  var title = splitDir.pop()
  var series = null
  var author = null
  // If there are at least 2 more directories, next furthest will be the series
  if (splitDir.length > 1) series = splitDir.pop()
  if (splitDir.length > 0) author = splitDir.pop()
  // There could be many more directories, but only the top 3 are used for naming /author/series/title/


  // If in a series directory check for volume number match
  /* ACCEPTS
    Book 2 - Title Here - Subtitle Here
    Title Here - Subtitle Here - Vol 12
    Title Here - volume 9 - Subtitle Here
    Vol. 3 Title Here - Subtitle Here
    1980 - Book 2-Title Here
    Title Here-Volume 999-Subtitle Here
    2 - Book Title
    100 - Book Title
    0.5 - Book Title
  */
  var volumeNumber = null
  if (series) {
    // Added 1.7.1: If title starts with a # that is 3 digits or less (or w/ 2 decimal), then use as volume number
    var volumeMatch = title.match(/^(\d{1,3}(?:\.\d{1,2})?) - ./)
    if (volumeMatch && volumeMatch.length > 1) {
      volumeNumber = volumeMatch[1]
      title = title.replace(`${volumeNumber} - `, '')
    } else {
      // Match volumes with decimal (OLD: /(-? ?)\b((?:Book|Vol.?|Volume) (\d{1,3}))\b( ?-?)/i)
      var volumeMatch = title.match(/(-? ?)\b((?:Book|Vol.?|Volume) (\d{0,3}(?:\.\d{1,2})?))\b( ?-?)/i)
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
  }


  var publishYear = null
  // If Title is of format 1999 OR (1999) - Title, then use 1999 as publish year
  var publishYearMatch = title.match(/^(\(?[0-9]{4}\)?) - (.+)/)
  if (publishYearMatch && publishYearMatch.length > 2 && publishYearMatch[1]) {
    // Strip parentheses 
    if (publishYearMatch[1].startsWith('(') && publishYearMatch[1].endsWith(')')) {
      publishYearMatch[1] = publishYearMatch[1].slice(1, -1)
    }
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
    fullPath: Path.posix.join(folderPath, dir) // i.e. /audiobook/Author Name/Book Name/..
  }
}

async function getAudiobookFileData(folder, audiobookPath, serverSettings = {}) {
  var parseSubtitle = !!serverSettings.scannerParseSubtitle

  var fileItems = await recurseFiles(audiobookPath, folder.fullPath)

  audiobookPath = audiobookPath.replace(/\\/g, '/')
  var folderFullPath = folder.fullPath.replace(/\\/g, '/')

  var audiobookDir = audiobookPath.replace(folderFullPath, '').slice(1)
  var audiobookData = getAudiobookDataFromDir(folderFullPath, audiobookDir, parseSubtitle)
  var audiobookFolderStats = await getFileTimestampsWithIno(audiobookData.fullPath)
  var audiobook = {
    ino: audiobookFolderStats.ino,
    mtimeMs: audiobookFolderStats.mtimeMs || 0,
    ctimeMs: audiobookFolderStats.ctimeMs || 0,
    birthtimeMs: audiobookFolderStats.birthtimeMs || 0,
    folderId: folder.id,
    libraryId: folder.libraryId,
    ...audiobookData,
    audioFiles: [],
    otherFiles: []
  }

  for (let i = 0; i < fileItems.length; i++) {
    var fileItem = fileItems[i]

    var fileStatData = await getFileTimestampsWithIno(fileItem.fullpath)
    var fileObj = {
      filetype: getFileType(fileItem.extension),
      filename: fileItem.name,
      path: fileItem.path,
      fullPath: fileItem.fullpath,
      ext: fileItem.extension,
      ...fileStatData
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