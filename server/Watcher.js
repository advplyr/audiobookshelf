const Path = require('path')
const EventEmitter = require('events')
const Watcher = require('watcher')
const Logger = require('./Logger')

class FolderWatcher extends EventEmitter {
  constructor() {
    super()
    this.paths = [] // Not used
    this.pendingFiles = [] // Not used

    this.libraryWatchers = []
    this.pendingFileUpdates = []
    this.pendingDelay = 4000
    this.pendingTimeout = null
  }

  get pendingFilePaths() {
    return this.pendingFileUpdates.map(f => f.path)
  }

  buildLibraryWatcher(library) {
    if (this.libraryWatchers.find(w => w.id === library.id)) {
      Logger.warn('[Watcher] Already watching library', library.name)
      return
    }
    Logger.info(`[Watcher] Initializing watcher for "${library.name}".`)
    var folderPaths = library.folderPaths
    folderPaths.forEach((fp) => {
      Logger.debug(`[Watcher] Init watcher for library folder path "${fp}"`)
    })
    var watcher = new Watcher(folderPaths, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      renameDetection: true,
      renameTimeout: 2000,
      recursive: true,
      ignoreInitial: true,
      persistent: true
    })
    watcher
      .on('add', (path) => {
        this.onNewFile(library.id, path)
      }).on('change', (path) => {
        // This is triggered from metadata changes, not what we want
        // this.onFileUpdated(path)
      }).on('unlink', path => {
        this.onFileRemoved(library.id, path)
      }).on('rename', (path, pathNext) => {
        this.onRename(library.id, path, pathNext)
      }).on('error', (error) => {
        Logger.error(`[Watcher] ${error}`)
      }).on('ready', () => {
        Logger.info(`[Watcher] "${library.name}" Ready`)
      }).on('close', () => {
        Logger.debug(`[Watcher] "${library.name}" Closed`)
      })

    this.libraryWatchers.push({
      id: library.id,
      name: library.name,
      folders: library.folders,
      paths: library.folderPaths,
      watcher
    })
  }

  initWatcher(libraries) {
    libraries.forEach((lib) => {
      this.buildLibraryWatcher(lib)
    })
  }

  addLibrary(library) {
    this.buildLibraryWatcher(library)
  }

  updateLibrary(library) {
    var libwatcher = this.libraryWatchers.find(lib => lib.id === library.id)
    if (libwatcher) {
      libwatcher.name = library.name

      var pathsToAdd = library.folderPaths.filter(path => !libwatcher.paths.includes(path))
      if (pathsToAdd.length) {
        Logger.info(`[Watcher] Adding paths to library watcher "${library.name}"`)
        libwatcher.paths = library.folderPaths
        libwatcher.folders = library.folders
        libwatcher.watcher.watchPaths(pathsToAdd)
      }
    }
  }

  removeLibrary(library) {
    var libwatcher = this.libraryWatchers.find(lib => lib.id === library.id)
    if (libwatcher) {
      Logger.info(`[Watcher] Removed watcher for "${library.name}"`)
      libwatcher.watcher.close()
      this.libraryWatchers = this.libraryWatchers.filter(lib => lib.id !== library.id)
    } else {
      Logger.error(`[Watcher] Library watcher not found for "${library.name}"`)
    }
  }

  close() {
    return this.libraryWatchers.map(lib => lib.watcher.close())
  }

  onNewFile(libraryId, path) {
    Logger.debug('[Watcher] File Added', path)
    this.addFileUpdate(libraryId, path, 'added')
  }

  onFileRemoved(libraryId, path) {
    Logger.debug('[Watcher] File Removed', path)
    this.addFileUpdate(libraryId, path, 'deleted')
  }

  onFileUpdated(path) {
    Logger.debug('[Watcher] Updated File', path)
  }

  onRename(libraryId, pathFrom, pathTo) {
    Logger.debug(`[Watcher] Rename ${pathFrom} => ${pathTo}`)
    this.addFileUpdate(libraryId, pathTo, 'renamed')
  }

  addFileUpdate(libraryId, path, type) {
    path = path.replace(/\\/g, '/')
    if (this.pendingFilePaths.includes(path)) return

    // Get file library
    var libwatcher = this.libraryWatchers.find(lw => lw.id === libraryId)
    if (!libwatcher) {
      Logger.error(`[Watcher] Invalid library id from watcher ${libraryId}`)
      return
    }

    // Get file folder
    var folder = libwatcher.folders.find(fold => path.startsWith(fold.fullPath.replace(/\\/g, '/')))
    if (!folder) {
      Logger.error(`[Watcher] New file folder not found in library "${libwatcher.name}" with path "${path}"`)
      return
    }
    var folderFullPath = folder.fullPath.replace(/\\/g, '/')

    // Check if file was added to root directory
    var dir = Path.dirname(path)
    if (dir === folderFullPath) {
      Logger.warn(`[Watcher] New file "${Path.basename(path)}" added to folder root - ignoring it`)
      return
    }

    var relPath = path.replace(folderFullPath, '')

    var hasDotPath = relPath.split('/').find(p => p.startsWith('.'))
    if (hasDotPath) {
      Logger.debug(`[Watcher] Ignoring dot path "${relPath}" | Piece "${hasDotPath}"`)
      return
    }

    Logger.debug(`[Watcher] Modified file in library "${libwatcher.name}" and folder "${folder.id}" with relPath "${relPath}"`)

    this.pendingFileUpdates.push({
      path,
      relPath,
      folderId: folder.id,
      libraryId,
      type
    })

    // Notify server of update after "pendingDelay"
    clearTimeout(this.pendingTimeout)
    this.pendingTimeout = setTimeout(() => {
      this.emit('files', this.pendingFileUpdates)
      this.pendingFileUpdates = []
    }, this.pendingDelay)
  }
}
module.exports = FolderWatcher