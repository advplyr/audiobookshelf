var EventEmitter = require('events')
var Logger = require('./Logger')
var Watcher = require('watcher')

class FolderWatcher extends EventEmitter {
  constructor(audiobookPath) {
    super()
    this.AudiobookPath = audiobookPath
    this.folderMap = {}
    this.watcher = null
  }

  initWatcher() {
    try {
      Logger.info('[FolderWatcher] Initializing..')
      this.watcher = new Watcher(this.AudiobookPath, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        renameDetection: true,
        renameTimeout: 2000,
        recursive: true,
        ignoreInitial: true,
        persistent: true
      })
      this.watcher
        .on('add', (path) => {
          this.onNewFile(path)
        }).on('change', (path) => {
          // This is triggered from metadata changes, not what we want
          // this.onFileUpdated(path)
        }).on('unlink', path => {
          this.onFileRemoved(path)
        }).on('rename', (path, pathNext) => {
          this.onRename(path, pathNext)
        }).on('error', (error) => {
          Logger.error(`[FolderWatcher] ${error}`)
        }).on('ready', () => {
          Logger.info('[FolderWatcher] Ready')
        })
    } catch (error) {
      Logger.error('Chokidar watcher failed', error)
    }

  }

  close() {
    return this.watcher.close()
  }

  onNewFile(path) {
    Logger.debug('FolderWatcher: New File', path)
    this.emit('file_added', {
      path: path.replace(this.AudiobookPath, ''),
      fullPath: path
    })
  }

  onFileRemoved(path) {
    Logger.debug('[FolderWatcher] File Removed', path)
    this.emit('file_removed', {
      path: path.replace(this.AudiobookPath, ''),
      fullPath: path
    })
  }

  onFileUpdated(path) {
    Logger.debug('[FolderWatcher] Updated File', path)
    this.emit('file_updated', {
      path: path.replace(this.AudiobookPath, ''),
      fullPath: path
    })
  }

  onRename(pathFrom, pathTo) {
    Logger.debug(`[FolderWatcher] Rename ${pathFrom} => ${pathTo}`)
  }
}
module.exports = FolderWatcher