const Logger = require('../Logger')
const Path = require('path')

class FileSystemController {
  constructor() { }

  async getPaths(req, res) {
    var excludedDirs = ['node_modules', 'client', 'server', '.git', 'static', 'build', 'dist', 'metadata', 'config', 'sys', 'proc'].map(dirname => {
      return Path.sep + dirname
    })

    // Do not include existing mapped library paths in response
    this.db.libraries.forEach(lib => {
      lib.folders.forEach((folder) => {
        var dir = folder.fullPath
        if (dir.includes(global.appRoot)) dir = dir.replace(global.appRoot, '')
        excludedDirs.push(dir)
      })
    })

    Logger.debug(`[Server] get file system paths, excluded: ${excludedDirs.join(', ')}`)
    var dirs = await this.getDirectories(global.appRoot, '/', excludedDirs)
    res.json(dirs)
  }
}
module.exports = new FileSystemController()