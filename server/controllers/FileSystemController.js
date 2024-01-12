const Path = require('path')
const Logger = require('../Logger')
const fs = require('../libs/fsExtra')
const { toNumber } = require('../utils/index')
const fileUtils = require('../utils/fileUtils')

class FileSystemController {
  constructor() { }

  /**
   * 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  async getPaths(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[FileSystemController] Non-admin user attempting to get filesystem paths`, req.user)
      return res.sendStatus(403)
    }

    const relpath = req.query.path
    const level = toNumber(req.query.level, 0)

    // Validate path. Must be absolute
    if (relpath && (!Path.isAbsolute(relpath) || !await fs.pathExists(relpath))) {
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
          directories = drives.map(d => {
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
    const excludedDirs = ['node_modules', 'client', 'server', '.git', 'static', 'build', 'dist', 'metadata', 'config', 'sys', 'proc', '.devcontainer', '.nyc_output', '.github', '.vscode'].map(dirname => {
      return fileUtils.filePathToPOSIX(Path.join(global.appRoot, dirname))
    })
    directories = directories.filter(dir => {
      return !excludedDirs.includes(dir.path)
    })

    res.json({
      posix: !global.isWin,
      directories
    })
  }

  // POST: api/filesystem/pathexists
  async checkPathExists(req, res) {
    if (!req.user.canUpload) {
      Logger.error(`[FileSystemController] Non-admin user attempting to check path exists`, req.user)
      return res.sendStatus(403)
    }

    const filepath = req.body.filepath
    if (!filepath?.length) {
      return res.sendStatus(400)
    }

    const exists = await fs.pathExists(filepath)
    res.json({
      exists
    })
  }
}
module.exports = new FileSystemController()