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
      Logger.error(`[FileSystemController] User "${req.user.username}" without upload permissions attempting to check path exists`)
      return res.sendStatus(403)
    }

    // fileName - If fileName is provided, the check only returns true if the actual file exists, not just the directory
    // allowBookFiles - If true, allows containing other book related files (e.g. .pdf, .epub, etc.)
    // allowAudioFiles - If true, allows containing other audio related files (e.g. .mp3, .m4b, etc.)
    const { directory, folderPath, fileName, allowBookFiles, allowAudioFiles } = req.body
    if (!directory?.length || typeof directory !== 'string' || !folderPath?.length || typeof folderPath !== 'string') {
      Logger.error(`[FileSystemController] Invalid request body: ${JSON.stringify(req.body)}`)
      return res.status(400).json({
        error: 'Invalid request body'
      })
    }

    if (fileName && typeof fileName !== 'string') {
      Logger.error(`[FileSystemController] Invalid fileName in request body: ${JSON.stringify(req.body)}`)
      return res.status(400).json({
        error: 'Invalid fileName'
      })
    }

    if (allowBookFiles && typeof allowBookFiles !== 'boolean' || allowAudioFiles && typeof allowAudioFiles !== 'boolean' || (allowBookFiles && allowAudioFiles)) {
      Logger.error(`[FileSystemController] Invalid allowBookFiles or allowAudioFiles in request body: ${JSON.stringify(req.body)}`)
      return res.status(400).json({
        error: 'Invalid allowBookFiles or allowAudioFiles'
      })
    }

    // Check that library folder exists
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

    let filepath = Path.join(libraryFolder.path, directory)
    filepath = fileUtils.filePathToPOSIX(filepath)

    // Ensure filepath is inside library folder (prevents directory traversal) (And convert libraryFolder to Path to normalize)
    if (!filepath.startsWith(libraryFolder.path)) {
      Logger.error(`[FileSystemController] Filepath is not inside library folder: ${filepath}`)
      return res.sendStatus(400)
    }

    if (await fs.pathExists(filepath)) {
      if (fileName) {
        // Check if a specific file exists
        const filePath = Path.join(filepath, fileName)
        if (await fs.pathExists(filePath)) {
          return res.json({
            exists: true,
          })
        }
      } else if(allowBookFiles || allowAudioFiles) {
          let allowedExtensions = []
          if (allowBookFiles && !allowAudioFiles) {
            allowedExtensions = ['epub', 'pdf', 'mobi', 'azw3', 'cbr', 'cbz']
          } else if (allowAudioFiles && !allowBookFiles) {
            allowedExtensions = ['m4b', 'mp3', 'm4a', 'flac', 'opus', 'ogg', 'oga', 'mp4', 'aac', 'wma', 'aiff', 'aif', 'wav', 'webm', 'webma', 'mka', 'awb', 'caf', 'mpeg', 'mpg']
          } else {
            allowedExtensions = []
          }
          const files = await fs.readdir(filepath)
          const exists = allowedExtensions.length === 0
            ? files.length > 0
            : files.some((file) => {
                const ext = Path.extname(file).toLowerCase().replace(/^\./, '')
                return allowedExtensions.includes(ext)
              })

          // To let the sub dir check run
          if(exists) return res.json({
            exists: exists
          })
      } else {
        return res.json({
          exists: true
        })
      }
    }

    // Check if a library item exists in a subdirectory
    // See: https://github.com/advplyr/audiobookshelf/issues/4146
    // For filenames it does not matter if the file is in a subdirectory or not because the file is not allowed to be created
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

    return res.json({
      exists: false
    })
  }
}
module.exports = new FileSystemController()
