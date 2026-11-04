const Path = require('path')
const fs = require('../libs/fsExtra')
const fileUpload = require('../libs/expressFileupload')
const Logger = require('../Logger')

/**
 * Multipart parser for the three routes that read req.files.
 * Reads MetadataPath per request so route registration does not depend on it.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function fileUploadParser(req, res, next) {
  fileUpload({
    defCharset: 'utf8',
    defParamCharset: 'utf8',
    useTempFiles: true,
    tempFileDir: Path.join(global.MetadataPath, 'tmp')
  })(req, res, next)
}
module.exports.fileUploadParser = fileUploadParser

/**
 * Reject users without upload permission before the multipart parser writes temp files.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireUploadPermission(req, res, next) {
  if (!req.user?.canUpload) {
    Logger.warn(`User "${req.user?.username || 'unknown'}" attempted to upload without permission`)
    return res.sendStatus(403)
  }
  next()
}
module.exports.requireUploadPermission = requireUploadPermission

/**
 * Remove leftover upload temp files (tmp-*) from metadata/tmp.
 * Comic extraction uses the same directory with other names; those stay.
 *
 * @returns {Promise<void>}
 */
async function sweepUploadTempFiles() {
  const tmpDir = Path.join(global.MetadataPath, 'tmp')
  let names
  try {
    names = await fs.readdir(tmpDir)
  } catch (error) {
    if (error.code === 'ENOENT') return
    Logger.warn(`[FileUpload] Failed to read upload temp directory "${tmpDir}": ${error.message}`)
    return
  }

  let removed = 0
  for (const name of names) {
    if (!name.startsWith('tmp-')) continue
    const fullPath = Path.join(tmpDir, name)
    try {
      const stat = await fs.lstat(fullPath)
      if (!stat.isFile()) continue
      await fs.unlink(fullPath)
      removed++
    } catch (error) {
      if (error.code === 'ENOENT') continue
      Logger.warn(`[FileUpload] Failed to remove leftover upload temp file "${fullPath}": ${error.message}`)
    }
  }

  if (removed) {
    Logger.info(`[FileUpload] Removed ${removed} leftover upload temp file(s) from "${tmpDir}"`)
  }
}
module.exports.sweepUploadTempFiles = sweepUploadTempFiles
