const { Request, Response } = require('express')
const Path = require('path')
const Logger = require('../Logger')
const fs = require('../libs/fsExtra')
const { toNumber } = require('../utils/index')
const fileUtils = require('../utils/fileUtils')
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
      Logger.error(`[FileSystemController] Non-admin user "${req.user.username}" attempting to check path exists`)
      return res.sendStatus(403)
    }

    const { filepath, directory, folderPath } = req.body

    if (!filepath?.length || typeof filepath !== 'string') {
      return res.sendStatus(400)
    }

    const exists = await fs.pathExists(filepath)

    if (exists) {
      return res.json({
        exists: true
      })
    }

    // If directory and folderPath are passed in, check if a library item exists in a subdirectory
    // See: https://github.com/advplyr/audiobookshelf/issues/4146
    if (typeof directory === 'string' && typeof folderPath === 'string' && directory.length > 0 && folderPath.length > 0) {
      const cleanedDirectory = directory.split('/').filter(Boolean).join('/')
      if (cleanedDirectory.includes('/')) {
        // Can only be 2 levels deep
        const possiblePaths = []
        const subdir = Path.dirname(directory)
        possiblePaths.push(fileUtils.filePathToPOSIX(Path.join(folderPath, subdir)))
        if (subdir.includes('/')) {
          possiblePaths.push(fileUtils.filePathToPOSIX(Path.join(folderPath, Path.dirname(subdir))))
        }

        const libraryItem = await Database.libraryItemModel.findOne({
          where: {
            path: possiblePaths
          }
        })

        if (libraryItem) {
          return res.json({
            exists: true,
            libraryItemTitle: libraryItem.title
          })
        }
      }
    }

    return res.json({
      exists: false
    })
  }
}
module.exports = new FileSystemController()
