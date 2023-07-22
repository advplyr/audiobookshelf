const Path = require('path')
const Logger = require('../Logger')
const Database = require('../Database')
const fs = require('../libs/fsExtra')

class FileSystemController {
  constructor() { }

  async getPaths(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[FileSystemController] Non-admin user attempting to get filesystem paths`, req.user)
      return res.sendStatus(403)
    }

    const excludedDirs = ['node_modules', 'client', 'server', '.git', 'static', 'build', 'dist', 'metadata', 'config', 'sys', 'proc'].map(dirname => {
      return Path.sep + dirname
    })

    // Do not include existing mapped library paths in response
    const libraryFoldersPaths = await Database.models.libraryFolder.getAllLibraryFolderPaths()
    libraryFoldersPaths.forEach((path) => {
      let dir = path || ''
      if (dir.includes(global.appRoot)) dir = dir.replace(global.appRoot, '')
      excludedDirs.push(dir)
    })

    res.json({
      directories: await this.getDirectories(global.appRoot, '/', excludedDirs)
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