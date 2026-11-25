const Path = require('path')
const { Op, where, fn, col } = require('sequelize')
const fs = require('../libs/fsExtra')
const Database = require('../Database')
const Logger = require('../Logger')
const { filePathToPOSIX, isSameOrSubPath, isStrictSubPath } = require('./fileUtils')

/**
 * Stable codes for new upload failures. `error` stays an English sentence so older clients
 * can keep displaying the body. Existing plain-text 400/404 responses are unchanged.
 */
const UPLOAD_ERROR_CODE = {
  pathExists: 'UPLOAD_PATH_EXISTS',
  libraryItemExists: 'UPLOAD_LIBRARY_ITEM_EXISTS',
  duplicateFileName: 'UPLOAD_DUPLICATE_FILENAME',
  folderNotWritable: 'UPLOAD_FOLDER_NOT_WRITABLE'
}
const UPLOAD_PATH_EXISTS_MESSAGE = 'File already exists'
const UPLOAD_LIBRARY_ITEM_EXISTS_PREFIX = 'Library item exists: '
const UPLOAD_DUPLICATE_FILENAME_MESSAGE = 'Duplicate file name in upload'
const UPLOAD_FOLDER_NOT_WRITABLE_MESSAGE = 'Cannot write to this library folder'
const UPLOAD_INVALID_PATH_MESSAGE = 'Invalid upload path'
const UPLOAD_INVALID_FILENAME_MESSAGE = 'Invalid file name'
const PLAIN_TEXT_UPLOAD_ERRORS = [UPLOAD_INVALID_PATH_MESSAGE, UPLOAD_INVALID_FILENAME_MESSAGE]

module.exports.UPLOAD_ERROR_CODE = UPLOAD_ERROR_CODE
module.exports.UPLOAD_PATH_EXISTS_MESSAGE = UPLOAD_PATH_EXISTS_MESSAGE
module.exports.UPLOAD_LIBRARY_ITEM_EXISTS_PREFIX = UPLOAD_LIBRARY_ITEM_EXISTS_PREFIX
module.exports.UPLOAD_DUPLICATE_FILENAME_MESSAGE = UPLOAD_DUPLICATE_FILENAME_MESSAGE
module.exports.UPLOAD_FOLDER_NOT_WRITABLE_MESSAGE = UPLOAD_FOLDER_NOT_WRITABLE_MESSAGE
module.exports.PLAIN_TEXT_UPLOAD_ERRORS = PLAIN_TEXT_UPLOAD_ERRORS

/**
 * Paths of library items this upload would be nested inside (issue #4146).
 * At most two levels above the upload directory, matching the previous pathexists check.
 *
 * @param {string} folderPath
 * @param {string} outputDirectory
 * @returns {string[]}
 */
function parentLibraryItemPaths(folderPath, outputDirectory) {
  const relative = filePathToPOSIX(Path.relative(folderPath, outputDirectory))
  if (!relative || relative === '.' || relative === '..' || relative.startsWith('../') || !relative.includes('/')) return []

  const parent = Path.posix.dirname(relative)
  const paths = [filePathToPOSIX(Path.join(folderPath, parent))]
  if (parent.includes('/')) {
    paths.push(filePathToPOSIX(Path.join(folderPath, Path.posix.dirname(parent))))
  }
  return paths
}

/**
 * Windows and macOS treat paths that differ only by case as the same directory.
 * A case-sensitive match would miss `Author A/Book B` and write `author a/book b/extra` inside it.
 *
 * @param {string[]} paths
 * @returns {import('sequelize').WhereOptions}
 */
function libraryItemPathWhere(paths) {
  if (global.isWin || process.platform === 'darwin') {
    // Apply SQL lower() on both sides so both match SQLite's active lower() implementation
    // (Unicode via libnusqlite3 when loaded, or ASCII fallback without breaking exact Unicode matches).
    return where(fn('lower', col('path')), {
      [Op.in]: paths.map((libraryItemPath) => fn('lower', libraryItemPath))
    })
  }
  return { path: paths }
}

/**
 * @param {string} folderPath
 * @param {string} outputDirectory
 * @returns {Promise<import('../models/LibraryItem') | null>}
 */
async function libraryItemContainingUpload(folderPath, outputDirectory) {
  const paths = parentLibraryItemPaths(folderPath, outputDirectory)
  if (!paths.length) return null
  return Database.libraryItemModel.findOne({
    where: libraryItemPathWhere(paths)
  })
}

class UploadError extends Error {
  /**
   * A code makes the response JSON `{ code, error, ...details }`. Without one, the response stays the plain message.
   *
   * @param {number} statusCode
   * @param {string} message plain-text response, also used as Error.message and as the JSON `error`
   * @param {string | null} [code]
   * @param {object} [details] extra JSON fields, such as libraryItemTitle
   */
  constructor(statusCode, message, code = null, details = {}) {
    super(message)
    this.name = 'UploadError'
    this.statusCode = statusCode
    this.body = code ? { code, error: message, ...details } : null
  }
}
module.exports.UploadError = UploadError

/**
 * Shared lookup for the upload handler and POST /api/filesystem/pathexists.
 * Throws when the path escapes the library folder.
 *
 * @param {string} folderPath
 * @param {string} outputDirectory
 * @returns {Promise<{ exists: boolean, libraryItemTitle?: string }>}
 */
async function lookupUploadDirectory(folderPath, outputDirectory) {
  if (!isSameOrSubPath(folderPath, outputDirectory)) {
    throw new UploadError(400, UPLOAD_INVALID_PATH_MESSAGE)
  }
  if (await fs.pathExists(outputDirectory)) {
    return { exists: true }
  }

  const libraryItem = await libraryItemContainingUpload(folderPath, outputDirectory)
  if (libraryItem) {
    return { exists: true, libraryItemTitle: libraryItem.title || '' }
  }
  return { exists: false }
}

/**
 * Throw when this upload must not be written.
 * An existing destination directory is refused outright, so individual files are not checked on disk.
 *
 * @param {string} folderPath
 * @param {string} outputDirectory absolute directory the files would be written into
 * @param {string[]} filenames sanitized file names
 * @returns {Promise<void>}
 */
async function assertUploadDestination(folderPath, outputDirectory, filenames) {
  // The library folder itself is not a valid item directory, even when every name sanitized away.
  if (!isStrictSubPath(folderPath, outputDirectory)) {
    throw new UploadError(400, UPLOAD_INVALID_PATH_MESSAGE)
  }
  const existing = await lookupUploadDirectory(folderPath, outputDirectory)
  if ('libraryItemTitle' in existing) {
    const message = `${UPLOAD_LIBRARY_ITEM_EXISTS_PREFIX}${existing.libraryItemTitle}`
    throw new UploadError(409, message, UPLOAD_ERROR_CODE.libraryItemExists, { libraryItemTitle: existing.libraryItemTitle })
  }
  if (existing.exists) {
    throw new UploadError(409, UPLOAD_PATH_EXISTS_MESSAGE, UPLOAD_ERROR_CODE.pathExists)
  }

  const seen = new Set()
  for (const name of filenames) {
    if (!name) throw new UploadError(400, UPLOAD_INVALID_FILENAME_MESSAGE)
    const key = name.toLowerCase()
    if (seen.has(key)) throw new UploadError(409, UPLOAD_DUPLICATE_FILENAME_MESSAGE, UPLOAD_ERROR_CODE.duplicateFileName)
    seen.add(key)
  }
}
module.exports.assertUploadDestination = assertUploadDestination

/**
 * POST /api/filesystem/pathexists. `directory` is the client path relative to the library folder.
 *
 * @param {string} folderPath
 * @param {string} directory
 * @returns {Promise<{ exists: boolean, libraryItemTitle?: string }>}
 */
async function checkUploadDirectory(folderPath, directory) {
  return lookupUploadDirectory(folderPath, Path.join(folderPath, directory))
}
module.exports.checkUploadDirectory = checkUploadDirectory

const NOT_WRITABLE_CODES = ['EACCES', 'EPERM', 'EROFS']

/**
 * Permission errors from mkdir or move. Null for every other failure.
 *
 * @param {NodeJS.ErrnoException} error
 * @returns {UploadError | null}
 */
function notWritableUploadError(error) {
  if (!error || !NOT_WRITABLE_CODES.includes(error.code)) return null
  return new UploadError(403, UPLOAD_FOLDER_NOT_WRITABLE_MESSAGE, UPLOAD_ERROR_CODE.folderNotWritable)
}
module.exports.notWritableUploadError = notWritableUploadError

/**
 * Create the upload directory. Returns the first parent this call created, or null when
 * every parent already existed. The leaf mkdir is not recursive: an existing directory
 * would count as success, and a later failure would delete it.
 *
 * @param {string} outputDirectory
 * @returns {Promise<string | null>}
 */
async function createUploadDirectory(outputDirectory) {
  let firstCreated = null
  try {
    firstCreated = (await fs.mkdir(Path.dirname(outputDirectory), { recursive: true })) || null
    await fs.mkdir(outputDirectory)
  } catch (error) {
    if (firstCreated) await removeEmptyCreatedDirectories(Path.dirname(outputDirectory), firstCreated)
    // An existing directory is EEXIST. A parent segment that is a file is ENOTDIR on Linux and macOS, and EEXIST on Windows.
    if (error.code === 'EEXIST' || error.code === 'ENOTDIR') {
      throw new UploadError(409, UPLOAD_PATH_EXISTS_MESSAGE, UPLOAD_ERROR_CODE.pathExists)
    }
    const notWritable = notWritableUploadError(error)
    if (notWritable) throw notWritable
    throw error
  }
  return firstCreated
}
module.exports.createUploadDirectory = createUploadDirectory

/**
 * Remove empty directories this request created, from deepest up through firstCreated.
 * Directories that already existed are left alone, including empty ones.
 *
 * @param {string} deepest
 * @param {string} firstCreated
 * @returns {Promise<void>}
 */
async function removeEmptyCreatedDirectories(deepest, firstCreated) {
  if (!firstCreated) return
  let current = deepest
  while (isSameOrSubPath(firstCreated, current)) {
    let names
    try {
      names = await fs.readdir(current)
    } catch (error) {
      if (error.code === 'ENOENT') return
      Logger.error('[uploadPath] Failed to read upload directory during rollback', current, error)
      return
    }
    if (names.length) return
    try {
      await fs.rmdir(current)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        Logger.error('[uploadPath] Failed to remove upload directory', current, error)
      }
      return
    }
    current = Path.dirname(current)
  }
}

/**
 * Remove the item directory this request created, then empty parents this request created.
 * firstCreated is the return value of createUploadDirectory.
 * Unmoved temp files are deleted by the multipart parser when the response closes.
 *
 * @param {string} outputDirectory
 * @param {string | null} firstCreated
 * @returns {Promise<void>}
 */
async function rollbackFailedUpload(outputDirectory, firstCreated) {
  try {
    await fs.remove(outputDirectory)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      Logger.error('[uploadPath] Failed to remove partial upload', outputDirectory, error)
    }
  }

  await removeEmptyCreatedDirectories(Path.dirname(outputDirectory), firstCreated)
}
module.exports.rollbackFailedUpload = rollbackFailedUpload
