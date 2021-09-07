const Path = require('path')
const EventEmitter = require('events')
const Watcher = require('watcher')
const Logger = require('./Logger')
const { getIno } = require('./utils/index')

class FolderWatcher extends EventEmitter {
  constructor(audiobookPath) {
    super()
    this.AudiobookPath = audiobookPath
    this.folderMap = {}
    this.watcher = null

    this.pendingBatchDelay = 4000

    // Audiobook paths with changes
    this.pendingBatch = {}
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
    Logger.debug('FolderWatcher: New File', path)

    var dir = Path.dirname(path)
    if (this.pendingBatch[dir]) {
      this.pendingBatch[dir].files.push(path)
      clearTimeout(this.pendingBatch[dir].timeout)
    } else {
      this.pendingBatch[dir] = {
        dir,
        files: [path]
      }
    }

    this.pendingBatch[dir].timeout = setTimeout(() => {
      this.emit('new_files', this.pendingBatch[dir])
      delete this.pendingBatch[dir]
    }, this.pendingBatchDelay)
  }

  onFileRemoved(path) {
    Logger.debug('[FolderWatcher] File Removed', path)

    var dir = Path.dirname(path)
    if (this.pendingBatch[dir]) {
      this.pendingBatch[dir].files.push(path)
      clearTimeout(this.pendingBatch[dir].timeout)
    } else {
      this.pendingBatch[dir] = {
        dir,
        files: [path]
      }
    }

    this.pendingBatch[dir].timeout = setTimeout(() => {
      this.emit('removed_files', this.pendingBatch[dir])
      delete this.pendingBatch[dir]
    }, this.pendingBatchDelay)
  }

  onFileUpdated(path) {
    Logger.debug('[FolderWatcher] Updated File', path)
  }

  onRename(pathFrom, pathTo) {
    Logger.debug(`[FolderWatcher] Rename ${pathFrom} => ${pathTo}`)

    var dir = Path.dirname(pathTo)
    if (this.pendingBatch[dir]) {
      this.pendingBatch[dir].files.push(pathTo)
      clearTimeout(this.pendingBatch[dir].timeout)
    } else {
      this.pendingBatch[dir] = {
        dir,
        files: [pathTo]
      }
    }

    this.pendingBatch[dir].timeout = setTimeout(() => {
      this.emit('renamed_files', this.pendingBatch[dir])
      delete this.pendingBatch[dir]
    }, this.pendingBatchDelay)
  }
}
module.exports = FolderWatcher