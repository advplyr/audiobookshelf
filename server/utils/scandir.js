const Path = require('path')
const { filePathToPOSIX } = require('./fileUtils')
const globals = require('./globals')
const LibraryFile = require('../objects/files/LibraryFile')
const parseNameString = require('./parsers/parseNameString')

/**
 * @typedef LibraryItemFilenameMetadata
 * @property {string} title
 * @property {string} subtitle Book mediaType only
 * @property {string} asin Book mediaType only
 * @property {string[]} authors Book mediaType only
 * @property {string[]} narrators Book mediaType only
 * @property {string} seriesName Book mediaType only
 * @property {string} seriesSequence Book mediaType only
 * @property {string} publishedYear Book mediaType only
 */

function isMediaFile(mediaType, ext, audiobooksOnly = false) {
  if (!ext) return false
  const extclean = ext.slice(1).toLowerCase()
  if (mediaType === 'podcast' || mediaType === 'music') return globals.SupportedAudioTypes.includes(extclean)
  else if (mediaType === 'video') return globals.SupportedVideoTypes.includes(extclean)
  else if (audiobooksOnly) return globals.SupportedAudioTypes.includes(extclean)
  return globals.SupportedAudioTypes.includes(extclean) || globals.SupportedEbookTypes.includes(extclean)
}

function checkFilepathIsAudioFile(filepath) {
  const ext = Path.extname(filepath)
  if (!ext) return false
  const extclean = ext.slice(1).toLowerCase()
  return globals.SupportedAudioTypes.includes(extclean)
}
module.exports.checkFilepathIsAudioFile = checkFilepathIsAudioFile

/**
 * TODO: Function needs to be re-done
 * @param {string} mediaType 
 * @param {string[]} paths array of relative file paths
 * @returns {Record<string,string[]>} map of files grouped into potential libarary item dirs
 */
function groupFilesIntoLibraryItemPaths(mediaType, paths) {
  // Step 1: Clean path, Remove leading "/", Filter out non-media files in root dir
  var nonMediaFilePaths = []
  var pathsFiltered = paths.map(path => {
    return path.startsWith('/') ? path.slice(1) : path
  }).filter(path => {
    let parsedPath = Path.parse(path)
    // Is not in root dir OR is a book media file
    if (parsedPath.dir) {
      if (!isMediaFile(mediaType, parsedPath.ext, false)) { // Seperate out non-media files
        nonMediaFilePaths.push(path)
        return false
      }
      return true
    } else if (mediaType === 'book' && isMediaFile(mediaType, parsedPath.ext, false)) { // (book media type supports single file audiobooks/ebooks in root dir)
      return true
    }
    return false
  })

  // Step 2: Sort by least number of directories
  pathsFiltered.sort((a, b) => {
    var pathsA = Path.dirname(a).split('/').length
    var pathsB = Path.dirname(b).split('/').length
    return pathsA - pathsB
  })

  // Step 3: Group files in dirs
  var itemGroup = {}
  pathsFiltered.forEach((path) => {
    var dirparts = Path.dirname(path).split('/').filter(p => !!p && p !== '.') //  dirname returns . if no directory
    var numparts = dirparts.length
    var _path = ''

    if (!numparts) {
      // Media file in root
      itemGroup[path] = path
    } else {
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
    }
  })

  // Step 4: Add in non-media files if they fit into item group
  if (nonMediaFilePaths.length) {

    for (const nonMediaFilePath of nonMediaFilePaths) {
      const pathDir = Path.dirname(nonMediaFilePath)
      const filename = Path.basename(nonMediaFilePath)
      const dirparts = pathDir.split('/')
      const numparts = dirparts.length
      let _path = ''

      // Iterate over directories in path
      for (let i = 0; i < numparts; i++) {
        const dirpart = dirparts.shift()
        _path = Path.posix.join(_path, dirpart)
        if (itemGroup[_path]) { // Directory is a group
          const relpath = Path.posix.join(dirparts.join('/'), filename)
          itemGroup[_path].push(relpath)
        } else if (!dirparts.length) {
          itemGroup[_path] = [filename]
        }
      }
    }
  }

  return itemGroup
}
module.exports.groupFilesIntoLibraryItemPaths = groupFilesIntoLibraryItemPaths

/**
 * @param {string} mediaType 
 * @param {{name:string, path:string, dirpath:string, reldirpath:string, fullpath:string, extension:string, deep:number}[]} fileItems (see recurseFiles)
 * @param {boolean} [audiobooksOnly=false] 
 * @returns {Record<string,string[]>} map of files grouped into potential libarary item dirs
 */
function groupFileItemsIntoLibraryItemDirs(mediaType, fileItems, audiobooksOnly = false) {
  // Handle music where every audio file is a library item
  if (mediaType === 'music') {
    const audioFileGroup = {}
    fileItems.filter(i => isMediaFile(mediaType, i.extension, audiobooksOnly)).forEach((item) => {
      audioFileGroup[item.path] = item.path
    })
    return audioFileGroup
  }

  // Step 1: Filter out non-book-media files in root dir (with depth of 0)
  const itemsFiltered = fileItems.filter(i => {
    return i.deep > 0 || ((mediaType === 'book' || mediaType === 'video' || mediaType === 'music') && isMediaFile(mediaType, i.extension, audiobooksOnly))
  })

  // Step 2: Seperate media files and other files
  //     - Directories without a media file will not be included
  const mediaFileItems = []
  const otherFileItems = []
  itemsFiltered.forEach(item => {
    if (isMediaFile(mediaType, item.extension, audiobooksOnly)) mediaFileItems.push(item)
    else otherFileItems.push(item)
  })

  // Step 3: Group audio files in library items
  const libraryItemGroup = {}
  mediaFileItems.forEach((item) => {
    const dirparts = item.reldirpath.split('/').filter(p => !!p)
    const numparts = dirparts.length
    let _path = ''

    if (!dirparts.length) {
      // Media file in root
      libraryItemGroup[item.name] = item.name
    } else {
      // Iterate over directories in path
      for (let i = 0; i < numparts; i++) {
        const dirpart = dirparts.shift()
        _path = Path.posix.join(_path, dirpart)

        if (libraryItemGroup[_path]) { // Directory already has files, add file
          const relpath = Path.posix.join(dirparts.join('/'), item.name)
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
    const dirparts = item.reldirpath.split('/')
    const numparts = dirparts.length
    let _path = ''

    // Iterate over directories in path
    for (let i = 0; i < numparts; i++) {
      const dirpart = dirparts.shift()
      _path = Path.posix.join(_path, dirpart)
      if (libraryItemGroup[_path]) { // Directory is audiobook group
        const relpath = Path.posix.join(dirparts.join('/'), item.name)
        libraryItemGroup[_path].push(relpath)
        return
      }
    }
  })
  return libraryItemGroup
}
module.exports.groupFileItemsIntoLibraryItemDirs = groupFileItemsIntoLibraryItemDirs

/**
 * Get LibraryFile from filepath
 * @param {string} libraryItemPath 
 * @param {string[]} files 
 * @returns {import('../objects/files/LibraryFile')}
 */
function buildLibraryFile(libraryItemPath, files) {
  return Promise.all(files.map(async (file) => {
    const filePath = Path.posix.join(libraryItemPath, file)
    const newLibraryFile = new LibraryFile()
    await newLibraryFile.setDataFromPath(filePath, file)
    return newLibraryFile
  }))
}
module.exports.buildLibraryFile = buildLibraryFile

/**
 * Get details parsed from filenames
 * 
 * @param {string} relPath 
 * @param {boolean} parseSubtitle 
 * @returns {LibraryItemFilenameMetadata}
 */
function getBookDataFromDir(relPath, parseSubtitle = false) {
  const splitDir = relPath.split('/')

  var folder = splitDir.pop() // Audio files will always be in the directory named for the title
  series = (splitDir.length > 1) ? splitDir.pop() : null // If there are at least 2 more directories, next furthest will be the series
  author = (splitDir.length > 0) ? splitDir.pop() : null // There could be many more directories, but only the top 3 are used for naming /author/series/title/

  // The  may contain various other pieces of metadata, these functions extract it.
  var [folder, asin] = getASIN(folder)
  var [folder, narrators] = getNarrator(folder)
  var [folder, sequence] = series ? getSequence(folder) : [folder, null]
  var [folder, publishedYear] = getPublishedYear(folder)
  var [title, subtitle] = parseSubtitle ? getSubtitle(folder) : [folder, null]


  return {
    title,
    subtitle,
    asin,
    authors: parseNameString.parse(author)?.names || [],
    narrators: parseNameString.parse(narrators)?.names || [],
    seriesName: series,
    seriesSequence: sequence,
    publishedYear
  }
}
module.exports.getBookDataFromDir = getBookDataFromDir

/**
 * Extract narrator from folder name
 * 
 * @param {string} folder 
 * @returns {[string, string]} [folder, narrator]
 */
function getNarrator(folder) {
  let pattern = /^(?<title>.*) \{(?<narrators>.*)\}$/
  let match = folder.match(pattern)
  return match ? [match.groups.title, match.groups.narrators] : [folder, null]
}

/**
 * Extract series sequence from folder name
 * 
 * @example
 * 'Book 2 - Title - Subtitle'
 * 'Title - Subtitle - Vol 12'
 * 'Title - volume 9 - Subtitle'
 * 'Vol. 3 Title Here - Subtitle'
 * '1980 - Book 2 - Title'
 * 'Volume 12. Title - Subtitle'
 * '100 - Book Title'
 * '6. Title'
 * '0.5 - Book Title'
 * 
 * @param {string} folder 
 * @returns {[string, string]} [folder, sequence]
 */
function getSequence(folder) {
  // Matches a valid volume string. Also matches a book whose title starts with a 1 to 3 digit number. Will handle that later.
  let pattern = /^(?<volumeLabel>vol\.? |volume |book )?(?<sequence>\d{0,3}(?:\.\d{1,2})?)(?<trailingDot>\.?)(?: (?<suffix>.*))?$/i

  let volumeNumber = null
  let parts = folder.split(' - ')
  for (let i = 0; i < parts.length; i++) {
    let match = parts[i].match(pattern)
    // This excludes '101 Dalmations' but includes '101. Dalmations'
    if (match && !(match.groups.suffix && !(match.groups.volumeLabel || match.groups.trailingDot))) {
      volumeNumber = isNaN(match.groups.sequence) ? match.groups.sequence : Number(match.groups.sequence).toString()
      parts[i] = match.groups.suffix
      if (!parts[i]) { parts.splice(i, 1) }
      break
    }
  }

  folder = parts.join(' - ')
  return [folder, volumeNumber]
}

/**
 * Extract published year from folder name
 * 
 * @param {string} folder 
 * @returns {[string, string]} [folder, publishedYear]
 */
function getPublishedYear(folder) {
  var publishedYear = null

  pattern = /^ *\(?([0-9]{4})\)? * - *(.+)/ //Matches #### - title or (####) - title
  var match = folder.match(pattern)
  if (match) {
    publishedYear = match[1]
    folder = match[2]
  }

  return [folder, publishedYear]
}

/**
 * Extract subtitle from folder name
 * 
 * @param {string} folder 
 * @returns {[string, string]} [folder, subtitle]
 */
function getSubtitle(folder) {
  // Subtitle is everything after " - "
  var splitTitle = folder.split(' - ')
  return [splitTitle.shift(), splitTitle.join(' - ')]
}

/**
 * Extract asin from folder name
 * 
 * @param {string} folder 
 * @returns {[string, string]} [folder, asin]
 */
function getASIN(folder) {
  let asin = null

  let pattern = /(?: |^)\[([A-Z0-9]{10})](?= |$)/ // Matches "[B0015T963C]"
  const match = folder.match(pattern)
  if (match) {
    asin = match[1]
    folder = folder.replace(match[0], '')
  }
  return [folder.trim(), asin]
}

/**
 * 
 * @param {string} relPath 
 * @returns {LibraryItemFilenameMetadata}
 */
function getPodcastDataFromDir(relPath) {
  const splitDir = relPath.split('/')

  // Audio files will always be in the directory named for the title
  const title = splitDir.pop()
  return {
    title
  }
}

/**
 * 
 * @param {string} libraryMediaType 
 * @param {string} folderPath 
 * @param {string} relPath 
 * @returns {{ mediaMetadata: LibraryItemFilenameMetadata, relPath: string, path: string}}
 */
function getDataFromMediaDir(libraryMediaType, folderPath, relPath) {
  relPath = filePathToPOSIX(relPath)
  let fullPath = Path.posix.join(folderPath, relPath)
  let mediaMetadata = null

  if (libraryMediaType === 'podcast') {
    mediaMetadata = getPodcastDataFromDir(relPath)
  } else { // book
    mediaMetadata = getBookDataFromDir(relPath, !!global.ServerSettings.scannerParseSubtitle)
  }

  return {
    mediaMetadata,
    relPath,
    path: fullPath
  }
}
module.exports.getDataFromMediaDir = getDataFromMediaDir
