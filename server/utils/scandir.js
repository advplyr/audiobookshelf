const Path = require('path')
const fs = require('fs-extra')
const Logger = require('../Logger')
const { recurseFiles, getFileTimestampsWithIno } = require('./fileUtils')
const globals = require('./globals')
const LibraryFile = require('../objects/files/LibraryFile')
const { response } = require('express')
const e = require('express')

function isMediaFile(mediaType, ext) {
  // if (!path) return false
  // var ext = Path.extname(path)
  if (!ext) return false
  var extclean = ext.slice(1).toLowerCase()
  if (mediaType === 'podcast') return globals.SupportedAudioTypes.includes(extclean)
  return globals.SupportedAudioTypes.includes(extclean) || globals.SupportedEbookTypes.includes(extclean)
}

// TODO: Function needs to be re-done
// Input: array of relative file paths
// Output: map of files grouped into potential item dirs
function groupFilesIntoLibraryItemPaths(paths) {
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
  var itemGroup = {}
  pathsFiltered.forEach((path) => {
    var dirparts = Path.dirname(path).split('/')
    var numparts = dirparts.length
    var _path = ''

    // Iterate over directories in path
    for (let i = 0; i < numparts; i++) {
      var dirpart = dirparts.shift()
      _path = Path.posix.join(_path, dirpart)

      if (itemGroup[_path]) { // Directory already has files, add file
        var relpath = Path.posix.join(dirparts.join('/'), Path.basename(path))
        itemGroup[_path].push(relpath)
        return
      } else if (!dirparts.length) { // This is the last directory, create group
        itemGroup[_path] = [Path.basename(path)]
        return
      } else if (dirparts.length === 1 && /^cd\d{1,3}$/i.test(dirparts[0])) { // Next directory is the last and is a CD dir, create group
        itemGroup[_path] = [Path.posix.join(dirparts[0], Path.basename(path))]
        return
      }
    }
  })
  return itemGroup
}
module.exports.groupFilesIntoLibraryItemPaths = groupFilesIntoLibraryItemPaths

// Input: array of relative file items (see recurseFiles)
// Output: map of files grouped into potential libarary item dirs
function groupFileItemsIntoLibraryItemDirs(mediaType, fileItems) {
  // Step 1: Filter out non-media files in root dir (with depth of 0)
  var itemsFiltered = fileItems.filter(i => {
    return i.deep > 0 || isMediaFile(mediaType, i.extension)
  })

  // Step 2: Seperate media files and other files
  //     - Directories without a media file will not be included
  var mediaFileItems = []
  var otherFileItems = []
  itemsFiltered.forEach(item => {
    if (isMediaFile(mediaType, item.extension)) mediaFileItems.push(item)
    else otherFileItems.push(item)
  })

  // Step 3: Group audio files in library items
  var libraryItemGroup = {}
  mediaFileItems.forEach((item) => {
    var dirparts = item.reldirpath.split('/').filter(p => !!p)
    var numparts = dirparts.length
    var _path = ''

    if (!dirparts.length) {
      // Media file in root
      libraryItemGroup[item.name] = item.name
    } else {
      // Iterate over directories in path
      for (let i = 0; i < numparts; i++) {
        var dirpart = dirparts.shift()
        _path = Path.posix.join(_path, dirpart)

        if (libraryItemGroup[_path]) { // Directory already has files, add file
          var relpath = Path.posix.join(dirparts.join('/'), item.name)
          libraryItemGroup[_path].push(relpath)
          return
        } else if (!dirparts.length) { // This is the last directory, create group
          libraryItemGroup[_path] = [item.name]
          return
        } else if (dirparts.length === 1 && /^cd\d{1,3}$/i.test(dirparts[0])) { // Next directory is the last and is a CD dir, create group
          libraryItemGroup[_path] = [Path.posix.join(dirparts[0], item.name)]
          return
        }
      }
    }
  })

  // Step 4: Add other files into library item groups
  otherFileItems.forEach((item) => {
    var dirparts = item.reldirpath.split('/')
    var numparts = dirparts.length
    var _path = ''

    // Iterate over directories in path
    for (let i = 0; i < numparts; i++) {
      var dirpart = dirparts.shift()
      _path = Path.posix.join(_path, dirpart)
      if (libraryItemGroup[_path]) { // Directory is audiobook group
        var relpath = Path.posix.join(dirparts.join('/'), item.name)
        libraryItemGroup[_path].push(relpath)
        return
      }
    }
  })
  return libraryItemGroup
}

function cleanFileObjects(libraryItemPath, files) {
  return Promise.all(files.map(async (file) => {
    var filePath = Path.posix.join(libraryItemPath, file)
    var newLibraryFile = new LibraryFile()
    await newLibraryFile.setDataFromPath(filePath, file)
    return newLibraryFile
  }))
}

// Scan folder
async function scanFolder(libraryMediaType, folder, serverSettings = {}) {
  var folderPath = folder.fullPath.replace(/\\/g, '/')

  var pathExists = await fs.pathExists(folderPath)
  if (!pathExists) {
    Logger.error(`[scandir] Invalid folder path does not exist "${folderPath}"`)
    return []
  }

  var fileItems = await recurseFiles(folderPath)
  var basePath = folderPath

  const isOpenAudibleFolder = fileItems.find(fi => fi.deep === 0 && fi.name === 'books.json')
  if (isOpenAudibleFolder) {
    Logger.info(`[scandir] Detected Open Audible Folder, looking in books folder`)
    basePath = Path.posix.join(folderPath, 'books')
    fileItems = await recurseFiles(basePath)
    Logger.debug(`[scandir] ${fileItems.length} files found in books folder`)
  }

  var libraryItemGrouping = groupFileItemsIntoLibraryItemDirs(libraryMediaType, fileItems)

  if (!Object.keys(libraryItemGrouping).length) {
    Logger.error(`Root path has no media folders: ${folderPath}`)
    return []
  }

  var isFile = false // item is not in a folder
  var items = []
  for (const libraryItemPath in libraryItemGrouping) {
    var libraryItemData = null
    var fileObjs = []
    if (libraryItemPath === libraryItemGrouping[libraryItemPath]) {
      // Media file in root only get title
      libraryItemData = {
        mediaMetadata: {
          title: Path.basename(libraryItemPath, Path.extname(libraryItemPath))
        },
        path: Path.posix.join(basePath, libraryItemPath),
        relPath: libraryItemPath
      }
      fileObjs = await cleanFileObjects(basePath, [libraryItemPath])
      isFile = true
    } else {
      libraryItemData = getDataFromMediaDir(libraryMediaType, folderPath, libraryItemPath, serverSettings)
      fileObjs = await cleanFileObjects(libraryItemData.path, libraryItemGrouping[libraryItemPath])
    }

    var libraryItemFolderStats = await getFileTimestampsWithIno(libraryItemData.path)
    items.push({
      folderId: folder.id,
      libraryId: folder.libraryId,
      ino: libraryItemFolderStats.ino,
      mtimeMs: libraryItemFolderStats.mtimeMs || 0,
      ctimeMs: libraryItemFolderStats.ctimeMs || 0,
      birthtimeMs: libraryItemFolderStats.birthtimeMs || 0,
      path: libraryItemData.path,
      relPath: libraryItemData.relPath,
      isFile,
      media: {
        metadata: libraryItemData.mediaMetadata || null
      },
      libraryFiles: fileObjs
    })
  }
  return items
}
module.exports.scanFolder = scanFolder

// Input relative filepath, output all details that can be parsed
function getBookDataFromDir(folderPath, relPath, parseSubtitle = false) {
  relPath = relPath.replace(/\\/g, '/')
  var splitDir = relPath.split('/')

  var title = splitDir.pop() // Audio files will always be in the directory named for the title
  series = (splitDir.length > 1) ? splitDir.pop() : null // If there are at least 2 more directories, next furthest will be the series
  author = (splitDir.length > 0) ? splitDir.pop() : null // There could be many more directories, but only the top 3 are used for naming /author/series/title/

  // The title directory may contain various other pieces of metadata, these functions extract it.
  var [title, narrators] = getNarrator(title)
  if (series) { var [title, sequence] = getSequence(title) }
  var [title, publishedYear] = getPublishedYear(title)
  if (parseSubtitle) { var [title, subtitle] = getSubtitle(title) } // Subtitle can be parsed from the title if user enabled

  return {
    mediaMetadata: {
      author,
      title,
      subtitle,
      series,
      sequence,
      publishedYear,
      narrators,
    },
    relPath: relPath, // relative audiobook path i.e. /Author Name/Book Name/..
    path: Path.posix.join(folderPath, relPath) // i.e. /audiobook/Author Name/Book Name/..
  }
}

function getNarrator(folder) {
  let pattern = /^(?<title>.*)\{(?<narrators>.*)\} *$/
  let match = folder.match(pattern)
  return match ? [match.groups.title.trimEnd(), match.groups.narrators] : [folder, null]
}

function getSequence(title) {
  // Valid ways of including a volume number:
  // Book 2 - Title Here - Subtitle Here
  // Title Here - Subtitle Here - Vol 12
  // Title Here - volume 9 - Subtitle Here
  // Vol. 3 Title Here - Subtitle Here
  // 1980 - Book 2-Title Here
  // Title Here-Volume 999-Subtitle Here
  // 2 - Book Title
  // 100 - Book Title
  // 0.5 - Book Title

  // Matches a valid volume string, capturing each section for later processing.
  let pattern = /^(vol\.? |volume |book )?(\d{1,3}(?:\.\d{1,2})?)(.*)/i

  let volumeNumber = null
  let parts = title.split('-')
  for (let i = 0; i < parts.length; i++) {
    let match = parts[i].trim().match(pattern)
    if (match && !(match[3].trim() && !match[1])) { // "101 Dalmations" shouldn't match
      volumeNumber = match[2]
      parts[i] = match[3]
      if (!parts[i].trim()) { parts.splice(i, 1) }
      break
    }
  }
  title = parts.join(' - ')

  return [title, volumeNumber]
}

function getPublishedYear(title) {
  var publishedYear = null

  pattern = /^ *\(?([0-9]{4})\)? *- *(.+)/ //Matches #### - title or (####) - title
  var match = title.match(pattern)
  if (match) {
    publishedYear = match[1]
    title = match[2]
  }

  return [title, publishedYear]
}

function getSubtitle(title) {
  // Subtitle is everything after " - "
  var splitTitle = title.split(' - ')
  return [splitTitle.shift().trim(), splitTitle.join(' - ').trim()]
}

function getPodcastDataFromDir(folderPath, relPath) {
  relPath = relPath.replace(/\\/g, '/')
  var splitDir = relPath.split('/')

  // Audio files will always be in the directory named for the title
  var title = splitDir.pop()
  return {
    mediaMetadata: {
      title
    },
    relPath: relPath, // relative audiobook path i.e. /Author Name/Book Name/..
    path: Path.posix.join(folderPath, relPath) // i.e. /audiobook/Author Name/Book Name/..
  }
}

function getDataFromMediaDir(libraryMediaType, folderPath, relPath, serverSettings) {
  if (libraryMediaType === 'podcast') {
    return getPodcastDataFromDir(folderPath, relPath)
  } else {
    var parseSubtitle = !!serverSettings.scannerParseSubtitle
    return getBookDataFromDir(folderPath, relPath, parseSubtitle)
  }
}

// Called from Scanner.js
async function getLibraryItemFileData(libraryMediaType, folder, libraryItemPath, serverSettings = {}) {
  var fileItems = await recurseFiles(libraryItemPath)

  libraryItemPath = libraryItemPath.replace(/\\/g, '/')
  var folderFullPath = folder.fullPath.replace(/\\/g, '/')

  var libraryItemDir = libraryItemPath.replace(folderFullPath, '').slice(1)
  var libraryItemData = getDataFromMediaDir(libraryMediaType, folderFullPath, libraryItemDir, serverSettings)
  var libraryItemDirStats = await getFileTimestampsWithIno(libraryItemData.path)
  var libraryItem = {
    ino: libraryItemDirStats.ino,
    mtimeMs: libraryItemDirStats.mtimeMs || 0,
    ctimeMs: libraryItemDirStats.ctimeMs || 0,
    birthtimeMs: libraryItemDirStats.birthtimeMs || 0,
    folderId: folder.id,
    libraryId: folder.libraryId,
    path: libraryItemData.path,
    relPath: libraryItemData.relPath,
    media: {
      metadata: libraryItemData.mediaMetadata || null
    },
    libraryFiles: []
  }

  for (let i = 0; i < fileItems.length; i++) {
    var fileItem = fileItems[i]
    var newLibraryFile = new LibraryFile()
    // fileItem.path is the relative path
    await newLibraryFile.setDataFromPath(fileItem.fullpath, fileItem.path)
    libraryItem.libraryFiles.push(newLibraryFile)
  }
  return libraryItem
}
module.exports.getLibraryItemFileData = getLibraryItemFileData
