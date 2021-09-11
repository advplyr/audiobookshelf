const Path = require('path')
const EventEmitter = require('events')
const Watcher = require('watcher')
const Logger = require('./Logger')

class FolderWatcher extends EventEmitter {
  constructor(audiobookPath) {
    super()
    this.AudiobookPath = audiobookPath
    this.folderMap = {}
    this.watcher = null

    this.pendingFiles = []
    this.pendingDelay = 4000
    this.pendingTimeout = null
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

  // After [pendingBatchDelay] seconds emit batch
  async onNewFile(path) {
    if (this.pendingFiles.includes(path)) return

    Logger.debug('FolderWatcher: New File', path)

    var dir = Path.dirname(path)
    if (dir === this.AudiobookPath) {
      Logger.debug('New File added to root dir, ignoring it')
      return
    }

    this.pendingFiles.push(path)
    clearTimeout(this.pendingTimeout)
    this.pendingTimeout = setTimeout(() => {
      this.emit('files', this.pendingFiles.map(f => f))
      this.pendingFiles = []
    }, this.pendingDelay)
  }

  onFileRemoved(path) {
    Logger.debug('[FolderWatcher] File Removed', path)

    var dir = Path.dirname(path)
    if (dir === this.AudiobookPath) {
      Logger.debug('New File added to root dir, ignoring it')
      return
    }

    this.pendingFiles.push(path)
    clearTimeout(this.pendingTimeout)
    this.pendingTimeout = setTimeout(() => {
      this.emit('files', this.pendingFiles.map(f => f))
      this.pendingFiles = []
    }, this.pendingDelay)
  }

  onFileUpdated(path) {
    Logger.debug('[FolderWatcher] Updated File', path)
  }

  onRename(pathFrom, pathTo) {
    Logger.debug(`[FolderWatcher] Rename ${pathFrom} => ${pathTo}`)

    var dir = Path.dirname(pathTo)
    if (dir === this.AudiobookPath) {
      Logger.debug('New File added to root dir, ignoring it')
      return
    }

    this.pendingFiles.push(pathTo)
    clearTimeout(this.pendingTimeout)
    this.pendingTimeout = setTimeout(() => {
      this.emit('files', this.pendingFiles.map(f => f))
      this.pendingFiles = []
    }, this.pendingDelay)
  }
}
module.exports = FolderWatcher