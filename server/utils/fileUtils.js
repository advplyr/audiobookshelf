const axios = require('axios')
const Path = require('path')
const ssrfFilter = require('ssrf-req-filter')
const exec = require('child_process').exec
const fs = require('../libs/fsExtra')
const rra = require('../libs/recursiveReaddirAsync')
const Logger = require('../Logger')
const { AudioMimeType } = require('./constants')

/**
 * Make sure folder separator is POSIX for Windows file paths. e.g. "C:\Users\Abs" becomes "C:/Users/Abs"
 *
 * @param {String} path - Ugly file path
 * @return {String} Pretty posix file path
 */
const filePathToPOSIX = (path) => {
  if (!global.isWin || !path) return path
  return path.startsWith('\\\\') ? '\\\\' + path.slice(2).replace(/\\/g, '/') : path.replace(/\\/g, '/')
}
module.exports.filePathToPOSIX = filePathToPOSIX

/**
 * Check path is a child of or equal to another path
 *
 * @param {string} parentPath
 * @param {string} childPath
 * @returns {boolean}
 */
function isSameOrSubPath(parentPath, childPath) {
  parentPath = filePathToPOSIX(parentPath)
  childPath = filePathToPOSIX(childPath)
  if (parentPath === childPath) return true
  const relativePath = Path.relative(parentPath, childPath)
  return (
    relativePath === '' || // Same path (e.g. parentPath = '/a/b/', childPath = '/a/b')
    (!relativePath.startsWith('..') && !Path.isAbsolute(relativePath)) // Sub path
  )
}
module.exports.isSameOrSubPath = isSameOrSubPath

function getFileStat(path) {
  try {
    return fs.stat(path)
  } catch (err) {
    Logger.error('[fileUtils] Failed to stat', err)
    return null
  }
}

async function getFileTimestampsWithIno(path) {
  try {
    var stat = await fs.stat(path, { bigint: true })
    return {
      size: Number(stat.size),
      mtimeMs: Number(stat.mtimeMs),
      ctimeMs: Number(stat.ctimeMs),
      birthtimeMs: Number(stat.birthtimeMs),
      ino: String(stat.ino)
    }
  } catch (err) {
    Logger.error(`[fileUtils] Failed to getFileTimestampsWithIno for path "${path}"`, err)
    return false
  }
}
module.exports.getFileTimestampsWithIno = getFileTimestampsWithIno

/**
 * Get file size
 *
 * @param {string} path
 * @returns {Promise<number>}
 */
module.exports.getFileSize = async (path) => {
  return (await getFileStat(path))?.size || 0
}

/**
 * Get file mtimeMs
 *
 * @param {string} path
 * @returns {Promise<number>} epoch timestamp
 */
module.exports.getFileMTimeMs = async (path) => {
  try {
    return (await getFileStat(path))?.mtimeMs || 0
  } catch (err) {
    Logger.error(`[fileUtils] Failed to getFileMtimeMs`, err)
    return 0
  }
}

/**
 *
 * @param {string} filepath
 * @returns {boolean}
 */
async function checkPathIsFile(filepath) {
  try {
    const stat = await fs.stat(filepath)
    return stat.isFile()
  } catch (err) {
    return false
  }
}
module.exports.checkPathIsFile = checkPathIsFile

function getIno(path) {
  return fs
    .stat(path, { bigint: true })
    .then((data) => String(data.ino))
    .catch((err) => {
      Logger.error('[Utils] Failed to get ino for path', path, err)
      return null
    })
}
module.exports.getIno = getIno

/**
 * Read contents of file
 * @param {string} path
 * @returns {string}
 */
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

/**
 * @typedef FilePathItem
 * @property {string} name - file name e.g. "audiofile.m4b"
 * @property {string} path - fullpath excluding folder e.g. "Author/Book/audiofile.m4b"
 * @property {string} reldirpath - path excluding file name e.g. "Author/Book"
 * @property {string} fullpath - full path e.g. "/audiobooks/Author/Book/audiofile.m4b"
 * @property {string} extension - file extension e.g. ".m4b"
 * @property {number} deep - depth of file in directory (0 is file in folder root)
 */

/**
 * Get array of files inside dir
 * @param {string} path
 * @param {string} [relPathToReplace]
 * @returns {FilePathItem[]}
 */
async function recurseFiles(path, relPathToReplace = null) {
  path = filePathToPOSIX(path)
  if (!path.endsWith('/')) path = path + '/'

  if (relPathToReplace) {
    relPathToReplace = filePathToPOSIX(relPathToReplace)
    if (!relPathToReplace.endsWith('/')) relPathToReplace += '/'
  } else {
    relPathToReplace = path
  }

  const options = {
    mode: rra.LIST,
    recursive: true,
    stats: false,
    ignoreFolders: true,
    extensions: true,
    deep: true,
    realPath: true,
    normalizePath: false
  }
  let list = await rra.list(path, options)
  if (list.error) {
    Logger.error('[fileUtils] Recurse files error', list.error)
    return []
  }

  const directoriesToIgnore = []

  list = list
    .filter((item) => {
      if (item.error) {
        Logger.error(`[fileUtils] Recurse files file "${item.fullname}" has error`, item.error)
        return false
      }

      item.fullname = filePathToPOSIX(item.fullname)
      item.path = filePathToPOSIX(item.path)
      const relpath = item.fullname.replace(relPathToReplace, '')
      let reldirname = Path.dirname(relpath)
      if (reldirname === '.') reldirname = ''
      const dirname = Path.dirname(item.fullname)

      // Directory has a file named ".ignore" flag directory and ignore
      if (item.name === '.ignore' && reldirname && reldirname !== '.' && !directoriesToIgnore.includes(dirname)) {
        Logger.debug(`[fileUtils] .ignore found - ignoring directory "${reldirname}"`)
        directoriesToIgnore.push(dirname)
        return false
      }

      if (item.extension === '.part') {
        Logger.debug(`[fileUtils] Ignoring .part file "${relpath}"`)
        return false
      }

      // Ignore any file if a directory or the filename starts with "."
      if (relpath.split('/').find((p) => p.startsWith('.'))) {
        Logger.debug(`[fileUtils] Ignoring path has . "${relpath}"`)
        return false
      }

      return true
    })
    .filter((item) => {
      // Filter out items in ignore directories
      if (directoriesToIgnore.some((dir) => item.fullname.startsWith(dir))) {
        Logger.debug(`[fileUtils] Ignoring path in dir with .ignore "${item.fullname}"`)
        return false
      }
      return true
    })
    .map((item) => {
      var isInRoot = item.path + '/' === relPathToReplace
      return {
        name: item.name,
        path: item.fullname.replace(relPathToReplace, ''),
        reldirpath: isInRoot ? '' : item.path.replace(relPathToReplace, ''),
        fullpath: item.fullname,
        extension: item.extension,
        deep: item.deep
      }
    })

  // Sort from least deep to most
  list.sort((a, b) => a.deep - b.deep)

  return list
}
module.exports.recurseFiles = recurseFiles

/**
 *
 * @param {import('../Watcher').PendingFileUpdate} fileUpdate
 * @returns {FilePathItem}
 */
module.exports.getFilePathItemFromFileUpdate = (fileUpdate) => {
  let relPath = fileUpdate.relPath
  if (relPath.startsWith('/')) relPath = relPath.slice(1)

  const dirname = Path.dirname(relPath)
  return {
    name: Path.basename(relPath),
    path: relPath,
    reldirpath: dirname === '.' ? '' : dirname,
    fullpath: fileUpdate.path,
    extension: Path.extname(relPath),
    deep: relPath.split('/').length - 1
  }
}

/**
 * Download file from web to local file system
 * Uses SSRF filter to prevent internal URLs
 *
 * @param {string} url
 * @param {string} filepath path to download the file to
 * @param {Function} [contentTypeFilter] validate content type before writing
 * @returns {Promise}
 */
module.exports.downloadFile = (url, filepath, contentTypeFilter = null) => {
  return new Promise(async (resolve, reject) => {
    Logger.debug(`[fileUtils] Downloading file to ${filepath}`)
    axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'audiobookshelf (+https://audiobookshelf.org)'
      },
      timeout: 30000,
      httpAgent: global.DisableSsrfRequestFilter?.(url) ? null : ssrfFilter(url),
      httpsAgent: global.DisableSsrfRequestFilter?.(url) ? null : ssrfFilter(url)
    })
      .then((response) => {
        // Validate content type
        if (contentTypeFilter && !contentTypeFilter?.(response.headers?.['content-type'])) {
          return reject(new Error(`Invalid content type "${response.headers?.['content-type'] || ''}"`))
        }

        // Write to filepath
        const writer = fs.createWriteStream(filepath)
        response.data.pipe(writer)

        writer.on('finish', resolve)
        writer.on('error', reject)
      })
      .catch((err) => {
        Logger.error(`[fileUtils] Failed to download file "${filepath}"`, err)
        reject(err)
      })
  })
}

/**
 * Download image file from web to local file system
 * Response header must have content-type of image/ (excluding svg)
 *
 * @param {string} url
 * @param {string} filepath
 * @returns {Promise}
 */
module.exports.downloadImageFile = (url, filepath) => {
  const contentTypeFilter = (contentType) => {
    return contentType?.startsWith('image/') && contentType !== 'image/svg+xml'
  }
  return this.downloadFile(url, filepath, contentTypeFilter)
}

module.exports.sanitizeFilename = (filename, colonReplacement = ' - ') => {
  if (typeof filename !== 'string') {
    return false
  }

  // Most file systems use number of bytes for max filename
  //   to support most filesystems we will use max of 255 bytes in utf-16
  //   Ref: https://doc.owncloud.com/server/next/admin_manual/troubleshooting/path_filename_length.html
  //   Issue: https://github.com/advplyr/audiobookshelf/issues/1261
  const MAX_FILENAME_BYTES = 255

  const replacement = ''
  const illegalRe = /[\/\?<>\\:\*\|"]/g
  const controlRe = /[\x00-\x1f\x80-\x9f]/g
  const reservedRe = /^\.+$/
  const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i
  const windowsTrailingRe = /[\. ]+$/
  const lineBreaks = /[\n\r]/g

  let sanitized = filename
    .replace(':', colonReplacement) // Replace first occurrence of a colon
    .replace(illegalRe, replacement)
    .replace(controlRe, replacement)
    .replace(reservedRe, replacement)
    .replace(lineBreaks, replacement)
    .replace(windowsReservedRe, replacement)
    .replace(windowsTrailingRe, replacement)
    .replace(/\s+/g, ' ') // Replace consecutive spaces with a single space

  // Check if basename is too many bytes
  const ext = Path.extname(sanitized) // separate out file extension
  const basename = Path.basename(sanitized, ext)
  const extByteLength = Buffer.byteLength(ext, 'utf16le')
  const basenameByteLength = Buffer.byteLength(basename, 'utf16le')
  if (basenameByteLength + extByteLength > MAX_FILENAME_BYTES) {
    const MaxBytesForBasename = MAX_FILENAME_BYTES - extByteLength
    let totalBytes = 0
    let trimmedBasename = ''

    // Add chars until max bytes is reached
    for (const char of basename) {
      totalBytes += Buffer.byteLength(char, 'utf16le')
      if (totalBytes > MaxBytesForBasename) break
      else trimmedBasename += char
    }

    trimmedBasename = trimmedBasename.trim()
    sanitized = trimmedBasename + ext
  }

  return sanitized
}

// Returns null if extname is not in our defined list of audio extnames
module.exports.getAudioMimeTypeFromExtname = (extname) => {
  if (!extname || !extname.length) return null
  const formatUpper = extname.slice(1).toUpperCase()
  if (AudioMimeType[formatUpper]) return AudioMimeType[formatUpper]
  return null
}

module.exports.removeFile = (path) => {
  if (!path) return false
  return fs
    .remove(path)
    .then(() => true)
    .catch((error) => {
      Logger.error(`[fileUtils] Failed remove file "${path}"`, error)
      return false
    })
}

module.exports.encodeUriPath = (path) => {
  const uri = new URL('/', 'file://')
  // we assign the path here to assure that URL control characters like # are
  // actually interpreted as part of the URL path
  uri.pathname = path
  return uri.pathname
}

/**
 * Check if directory is writable.
 * This method is necessary because fs.access(directory, fs.constants.W_OK) does not work on Windows
 *
 * @param {string} directory
 * @returns {Promise<boolean>}
 */
module.exports.isWritable = async (directory) => {
  try {
    const accessTestFile = Path.join(directory, 'accessTest')
    await fs.writeFile(accessTestFile, '')
    await fs.remove(accessTestFile)
    return true
  } catch (err) {
    Logger.info(`[fileUtils] Directory is not writable "${directory}"`, err)
    return false
  }
}

/**
 * Get Windows drives as array e.g. ["C:/", "F:/"]
 *
 * @returns {Promise<string[]>}
 */
module.exports.getWindowsDrives = async () => {
  if (!global.isWin) {
    return []
  }
  return new Promise((resolve, reject) => {
    exec('wmic logicaldisk get name', async (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }
      let drives = stdout
        ?.split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line)
        .slice(1)
      const validDrives = []
      for (const drive of drives) {
        let drivepath = drive + '/'
        if (await fs.pathExists(drivepath)) {
          validDrives.push(drivepath)
        } else {
          Logger.error(`Invalid drive ${drivepath}`)
        }
      }
      resolve(validDrives)
    })
  })
}

/**
 * Get array of directory paths in a directory
 *
 * @param {string} dirPath
 * @param {number} level
 * @returns {Promise<{ path:string, dirname:string, level:number }[]>}
 */
module.exports.getDirectoriesInPath = async (dirPath, level) => {
  try {
    const paths = await fs.readdir(dirPath)
    let dirs = await Promise.all(
      paths.map(async (dirname) => {
        const fullPath = Path.join(dirPath, dirname)

        const lstat = await fs.lstat(fullPath).catch((error) => {
          Logger.debug(`Failed to lstat "${fullPath}"`, error)
          return null
        })
        if (!lstat?.isDirectory()) return null

        return {
          path: this.filePathToPOSIX(fullPath),
          dirname,
          level
        }
      })
    )
    dirs = dirs.filter((d) => d)
    return dirs
  } catch (error) {
    Logger.error('Failed to readdir', dirPath, error)
    return []
  }
}

/**
 * Copies a file from the source path to an existing destination path, preserving the destination's permissions.
 *
 * @param {string} srcPath - The path of the source file.
 * @param {string} destPath - The path of the existing destination file.
 * @returns {Promise<void>} A promise that resolves when the file has been successfully copied.
 * @throws {Error} If there is an error reading the source file or writing the destination file.
 */
async function copyToExisting(srcPath, destPath) {
  return new Promise((resolve, reject) => {
    // Create a readable stream from the source file
    const readStream = fs.createReadStream(srcPath)

    // Create a writable stream to the destination file
    const writeStream = fs.createWriteStream(destPath, { flags: 'w' })

    // Pipe the read stream to the write stream
    readStream.pipe(writeStream)

    // Handle the end of the stream
    writeStream.on('finish', () => {
      Logger.debug(`[copyToExisting] Successfully copied file from ${srcPath} to ${destPath}`)
      resolve()
    })

    // Handle errors
    readStream.on('error', (error) => {
      Logger.error(`[copyToExisting] Error reading from source file ${srcPath}: ${error.message}`)
      readStream.close()
      writeStream.close()
      reject(error)
    })

    writeStream.on('error', (error) => {
      Logger.error(`[copyToExisting] Error writing to destination file ${destPath}: ${error.message}`)
      readStream.close()
      writeStream.close()
      reject(error)
    })
  })
}
module.exports.copyToExisting = copyToExisting
