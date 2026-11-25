const { Request, Response } = require('express')
const Path = require('path')
const Logger = require('../Logger')
const fs = require('../libs/fsExtra')
const { toNumber } = require('../utils/index')
const fileUtils = require('../utils/fileUtils')
const uploadPath = require('../utils/uploadPath')
const Database = require('../Database')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class FileSystemController {
  constructor() {}

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getPaths(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[FileSystemController] Non-admin user "${req.user.username}" attempting to get filesystem paths`)
      return res.sendStatus(403)
    }

    const relpath = req.query.path
    const level = toNumber(req.query.level, 0)

    // Validate path. Must be absolute
    if (relpath && (!Path.isAbsolute(relpath) || !(await fs.pathExists(relpath)))) {
      Logger.error(`[FileSystemController] Invalid path in query string "${relpath}"`)
      return res.status(400).send('Invalid "path" query string')
    }
    Logger.debug(`[FileSystemController] Getting file paths at ${relpath || 'root'} (${level})`)

    let directories = []

    // Windows returns drives first
    if (global.isWin) {
      if (relpath) {
        directories = await fileUtils.getDirectoriesInPath(relpath, level)
      } else {
        const drives = await fileUtils.getWindowsDrives().catch((error) => {
          Logger.error(`[FileSystemController] Failed to get windows drives`, error)
          return []
        })
        if (drives.length) {
          directories = drives.map((d) => {
            return {
              path: d,
              dirname: d,
              level: 0
            }
          })
        }
      }
    } else {
      directories = await fileUtils.getDirectoriesInPath(relpath || '/', level)
    }

    // Exclude some dirs from this project to be cleaner in Docker
    const excludedDirs = ['node_modules', 'client', 'server', '.git', 'static', 'build', 'dist', 'metadata', 'config', 'sys', 'proc', '.devcontainer', '.nyc_output', '.github', '.vscode'].map((dirname) => {
      return fileUtils.filePathToPOSIX(Path.join(global.appRoot, dirname))
    })
    directories = directories.filter((dir) => {
      return !excludedDirs.includes(dir.path)
    })

    res.json({
      posix: !global.isWin,
      directories
    })
  }

  /**
   * POST: /api/filesystem/pathexists
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async checkPathExists(req, res) {
    if (!req.user.canUpload) {
      Logger.error(`[FileSystemController] User "${req.user.username}" without upload permissions attempting to check path exists`)
      return res.sendStatus(403)
    }

    const { directory, folderPath } = req.body
    if (!directory?.length || typeof directory !== 'string' || !folderPath?.length || typeof folderPath !== 'string') {
      Logger.error(`[FileSystemController] Invalid request body: ${JSON.stringify(req.body)}`)
      return res.status(400).json({
        error: 'Invalid request body'
      })
    }

    // Check that library folder exists. The lookup is inside the try: Express 4 does not answer a rejected async route.
    try {
      const libraryFolder = await Database.libraryFolderModel.findOne({
        where: {
          path: folderPath
        }
      })

      if (!libraryFolder) {
        Logger.error(`[FileSystemController] Library folder not found: ${folderPath}`)
        return res.sendStatus(404)
      }

      if (!req.user.checkCanAccessLibrary(libraryFolder.libraryId)) {
        Logger.error(`[FileSystemController] User "${req.user.username}" attempting to check path exists for library "${libraryFolder.libraryId}" without access`)
        return res.sendStatus(403)
      }

      // Same rules as POST /api/upload: the directory itself, then a library item in a parent folder.
      // See: https://github.com/advplyr/audiobookshelf/issues/4146
      const existing = await uploadPath.checkUploadDirectory(libraryFolder.path, directory)
      if ('libraryItemTitle' in existing) {
        return res.json({
          exists: true,
          libraryItemTitle: existing.libraryItemTitle
        })
      }
      return res.json({
        exists: existing.exists
      })
    } catch (error) {
      if (error instanceof uploadPath.UploadError) {
        Logger.error(`[FileSystemController] Filepath is not inside library folder: ${directory}`)
        return res.sendStatus(error.statusCode)
      }
      Logger.error('[FileSystemController] Failed to check if path exists', directory, error)
      return res.sendStatus(500)
    }
  }
}
module.exports = new FileSystemController()
