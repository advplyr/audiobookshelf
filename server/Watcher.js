const EventEmitter = require('events')
const Watcher = require('./libs/watcher/watcher')
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

    this.ignoreDirs = []
    this.disabled = false
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
      if (!lib.settings.disableWatcher) {
        this.buildLibraryWatcher(lib)
      }
    })
  }

  addLibrary(library) {
    if (this.disabled || library.settings.disableWatcher) return
    this.buildLibraryWatcher(library)
  }

  updateLibrary(library) {
    if (this.disabled || library.settings.disableWatcher) return
    var libwatcher = this.libraryWatchers.find(lib => lib.id === library.id)
    if (libwatcher) {
      libwatcher.name = library.name

      // If any folder paths were added or removed then re-init watcher
      var pathsToAdd = library.folderPaths.filter(path => !libwatcher.paths.includes(path))
      var pathsRemoved = libwatcher.paths.filter(path => !library.folderPaths.includes(path))
      if (pathsToAdd.length || pathsRemoved.length) {
        Logger.info(`[Watcher] Re-Initializing watcher for "${library.name}".`)

        libwatcher.watcher.close()
        this.libraryWatchers = this.libraryWatchers.filter(lw => lw.id !== libwatcher.id)
        this.buildLibraryWatcher(library)
      }
    }
  }

  removeLibrary(library) {
    if (this.disabled) return
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
    if (this.checkShouldIgnorePath(path)) {
      return
    }
    Logger.debug('[Watcher] File Added', path)
    this.addFileUpdate(libraryId, path, 'added')
  }

  onFileRemoved(libraryId, path) {
    if (this.checkShouldIgnorePath(path)) {
      return
    }
    Logger.debug('[Watcher] File Removed', path)
    this.addFileUpdate(libraryId, path, 'deleted')
  }

  onFileUpdated(path) {
    Logger.debug('[Watcher] Updated File', path)
  }

  onRename(libraryId, pathFrom, pathTo) {
    if (this.checkShouldIgnorePath(pathTo)) {
      return
    }
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

  checkShouldIgnorePath(path) {
    return !!this.ignoreDirs.find(dirpath => {
      return path.replace(/\\/g, '/').startsWith(dirpath)
    })
  }

  cleanDirPath(path) {
    var path = path.replace(/\\/g, '/')
    if (path.endsWith('/')) path = path.slice(0, -1)
    return path
  }

  addIgnoreDir(path) {
    path = this.cleanDirPath(path)
    if (this.ignoreDirs.includes(path)) return
    Logger.debug(`[Watcher] Ignoring directory "${path}"`)
    this.ignoreDirs.push(path)
  }

  removeIgnoreDir(path) {
    path = this.cleanDirPath(path)
    if (!this.ignoreDirs.includes(path)) return
    Logger.debug(`[Watcher] No longer ignoring directory "${path}"`)
    this.ignoreDirs = this.ignoreDirs.filter(p => p !== path)
  }
}
module.exports = FolderWatcher