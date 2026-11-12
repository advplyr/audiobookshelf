import { EventEmitter } from 'events'
import watcherModule from './libs/watcher/watcher'
import Logger from './Logger'
import TaskManager from './managers/TaskManager'
import type Task from './objects/Task'
import type Library from './models/Library'
import type LibraryFolder from './models/LibraryFolder'

import { filePathToPOSIX, isSameOrSubPath, getFileMTimeMs, shouldIgnoreFile } from './utils/fileUtils'

type NativeWatcherEvents = {
  add: [path: string]
  change: [path: string]
  unlink: [path: string]
  rename: [from: string, to: string]
  error: [error: Error]
  ready: []
  close: []
}
type NativeWatcher = {
  on<Event extends keyof NativeWatcherEvents>(event: Event, listener: (...args: NativeWatcherEvents[Event]) => void): NativeWatcher
  close(): boolean
}
type WatcherOptions = {
  ignored: RegExp
  renameDetection: boolean
  renameTimeout: number
  recursive: boolean
  ignoreInitial: boolean
  persistent: boolean
}

// The embedded constructor's third argument is optional; type the two-argument call used here.
const Watcher = watcherModule as new (paths: string[], options: WatcherOptions) => NativeWatcher

type PendingFileUpdate = { path: string; relPath: string; folderId: string; libraryId: string; type: string }
type LibraryWatcher = {
  id: string
  name: string | null
  libraryFolders: LibraryFolder[]
  paths: string[]
  watcher: NativeWatcher
}

class FolderWatcher extends EventEmitter<{ scanFilesChanged: [PendingFileUpdate[], Task] }> {
  declare libraryWatchers: LibraryWatcher[]
  declare pendingFileUpdates: PendingFileUpdate[]
  declare pendingDelay: number
  declare pendingTimeout: NodeJS.Timeout | null
  declare pendingTask: Task | null
  declare filesBeingAdded: Set<string>
  declare ignoreFilePathsDownloading: Set<string>
  declare ignoreDirs: string[]
  declare pendingDirsToRemoveFromIgnore: string[]
  declare removeFromIgnoreTimer: NodeJS.Timeout | null
  declare disabled: boolean

  constructor() {
    super()

    this.libraryWatchers = []
    this.pendingFileUpdates = []
    this.pendingDelay = 10000
    this.pendingTimeout = null
    this.pendingTask = null

    this.filesBeingAdded = new Set()

    this.ignoreFilePathsDownloading = new Set()
    this.ignoreDirs = []
    this.pendingDirsToRemoveFromIgnore = []
    this.removeFromIgnoreTimer = null

    this.disabled = false
  }

  get pendingFilePaths() {
    return this.pendingFileUpdates.map((f) => f.path)
  }

  buildLibraryWatcher(library: Library) {
    if (this.libraryWatchers.find((w) => w.id === library.id)) {
      Logger.warn('[Watcher] Already watching library', library.name)
      return
    }
    Logger.info(`[Watcher] Initializing watcher for "${library.name}".`)

    const folderPaths = library.libraryFolders!.map((f) => f.path!)
    folderPaths.forEach((fp) => {
      Logger.debug(`[Watcher] Init watcher for library folder path "${fp}"`)
    })
    const watcher = new Watcher(folderPaths, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      renameDetection: true,
      renameTimeout: 2000,
      recursive: true,
      ignoreInitial: true,
      persistent: true
    })
    watcher
      .on('add', (path) => {
        this.onFileAdded(library.id, filePathToPOSIX(path))
      })
      .on('change', () => {
        // This is triggered from metadata changes, not what we want
      })
      .on('unlink', (path) => {
        this.onFileRemoved(library.id, filePathToPOSIX(path))
      })
      .on('rename', (path, pathNext) => {
        this.onFileRename(library.id, filePathToPOSIX(path), filePathToPOSIX(pathNext))
      })
      .on('error', (error) => {
        Logger.error(`[Watcher] ${error}`)
      })
      .on('ready', () => {
        Logger.info(`[Watcher] "${library.name}" Ready`)
      })
      .on('close', () => {
        Logger.debug(`[Watcher] "${library.name}" Closed`)
      })

    this.libraryWatchers.push({
      id: library.id,
      name: library.name,
      libraryFolders: library.libraryFolders!,
      paths: folderPaths,
      watcher
    })
  }

  initWatcher(libraries: Library[]) {
    libraries.forEach((lib) => {
      if (!lib.settings!.disableWatcher) {
        this.buildLibraryWatcher(lib)
      }
    })
  }

  addLibrary(library: Library) {
    if (this.disabled || library.settings!.disableWatcher) return
    this.buildLibraryWatcher(library)
  }

  updateLibrary(library: Library) {
    if (this.disabled) return

    const libwatcher = this.libraryWatchers.find((lib) => lib.id === library.id)
    if (libwatcher) {
      // Library watcher was disabled
      if (library.settings!.disableWatcher) {
        Logger.info(`[Watcher] updateLibrary: Library "${library.name}" watcher disabled`)
        libwatcher.watcher.close()
        this.libraryWatchers = this.libraryWatchers.filter((lw) => lw.id !== libwatcher.id)
        return
      }

      libwatcher.name = library.name

      // If any folder paths were added or removed then re-init watcher
      const folderPaths = library.libraryFolders!.map((f) => f.path!)
      const pathsToAdd = folderPaths.filter((path) => !libwatcher.paths.includes(path))
      const pathsRemoved = libwatcher.paths.filter((path) => !folderPaths.includes(path))
      if (pathsToAdd.length || pathsRemoved.length) {
        Logger.info(`[Watcher] Re-Initializing watcher for "${library.name}".`)

        libwatcher.watcher.close()
        this.libraryWatchers = this.libraryWatchers.filter((lw) => lw.id !== libwatcher.id)
        this.buildLibraryWatcher(library)
      }
    } else if (!library.settings!.disableWatcher) {
      // Library watcher was enabled
      Logger.info(`[Watcher] updateLibrary: Library "${library.name}" watcher enabled - initializing`)
      this.buildLibraryWatcher(library)
    }
  }

  removeLibrary(library: Library) {
    if (this.disabled) return
    var libwatcher = this.libraryWatchers.find((lib) => lib.id === library.id)
    if (libwatcher) {
      Logger.info(`[Watcher] Removed watcher for "${library.name}"`)
      libwatcher.watcher.close()
      this.libraryWatchers = this.libraryWatchers.filter((lib) => lib.id !== library.id)
    } else {
      Logger.error(`[Watcher] Library watcher not found for "${library.name}"`)
    }
  }

  close() {
    return this.libraryWatchers.map((lib) => lib.watcher.close())
  }

  /**
   * Watcher detected file added
   *
   */
  onFileAdded(libraryId: string, path: string) {
    if (this.checkShouldIgnorePath(path)) {
      return
    }
    Logger.debug('[Watcher] File Added', path)
    if (!this.addFileUpdate(libraryId, path, 'added')) {
      return
    }

    if (!this.filesBeingAdded.has(path)) {
      this.filesBeingAdded.add(path)
      void this.waitForFileToAdd(path)
    }
  }

  /**
   * Watcher detected file removed
   *
   */
  onFileRemoved(libraryId: string, path: string) {
    if (this.checkShouldIgnorePath(path)) {
      return
    }
    Logger.debug('[Watcher] File Removed', path)
    this.addFileUpdate(libraryId, path, 'deleted')
  }

  /**
   * Watcher detected file renamed
   *
   */
  onFileRename(libraryId: string, pathFrom: string, pathTo: string) {
    if (this.checkShouldIgnorePath(pathTo)) {
      return
    }
    Logger.debug(`[Watcher] Rename ${pathFrom} => ${pathTo}`)
    this.addFileUpdate(libraryId, pathTo, 'renamed')
  }

  /**
   * Get mtimeMs from an added file every 3 seconds until it is no longer changing
   * Times out after 600s
   *
   */
  async waitForFileToAdd(path: string, lastMTimeMs = 0, loop = 0) {
    // Safety to catch infinite loop (600s)
    if (loop >= 200) {
      Logger.warn(`[Watcher] Waiting to add file at "${path}" timeout (loop ${loop}) - bailing`)
      this.pendingFileUpdates = this.pendingFileUpdates.filter((pfu) => pfu.path !== path)
      return this.filesBeingAdded.delete(path)
    }

    const mtimeMs = await getFileMTimeMs(path)
    if (mtimeMs === lastMTimeMs) {
      if (lastMTimeMs) Logger.debug(`[Watcher] File finished adding at "${path}"`)
      return this.filesBeingAdded.delete(path)
    }
    if (loop % 5 === 0) {
      Logger.debug(`[Watcher] Waiting to add file at "${path}". mtimeMs=${mtimeMs} lastMTimeMs=${lastMTimeMs} (loop ${loop})`)
    }
    // Wait 3 seconds
    await new Promise((resolve) => setTimeout(resolve, 3000))
    void this.waitForFileToAdd(path, mtimeMs, ++loop)
  }

  /**
   * Queue file update
   *
   */
  addFileUpdate(libraryId: string, path: string, type: string) {
    if (this.pendingFilePaths.includes(path)) return false

    // Get file library
    const libwatcher = this.libraryWatchers.find((lw) => lw.id === libraryId)
    if (!libwatcher) {
      Logger.error(`[Watcher] Invalid library id from watcher ${libraryId}`)
      return false
    }

    // Get file folder
    const folder = libwatcher.libraryFolders.find((fold) => isSameOrSubPath(fold.path!, path))
    if (!folder) {
      Logger.error(`[Watcher] New file folder not found in library "${libwatcher.name}" with path "${path}"`)
      return false
    }

    const folderPath = filePathToPOSIX(folder.path!)

    const relPath = path.replace(folderPath, '')

    // Check for ignored extensions or directories, such as dotfiles and hidden directories
    const shouldIgnore = shouldIgnoreFile(relPath)
    if (shouldIgnore) {
      Logger.debug(`[Watcher] Ignoring ${shouldIgnore} - "${relPath}"`)
      return false
    }

    Logger.debug(`[Watcher] Modified file in library "${libwatcher.name}" and folder "${folder.id}" with relPath "${relPath}"`)

    if (!this.pendingTask) {
      const taskData = {
        libraryId,
        libraryName: libwatcher.name
      }
      const taskTitleString = {
        text: `Scanning file changes in "${libwatcher.name}"`,
        key: 'MessageTaskScanningFileChanges',
        subs: [libwatcher.name]
      }
      this.pendingTask = TaskManager.createAndAddTask('watcher-scan', taskTitleString, null, true, taskData)
    }
    this.pendingFileUpdates.push({
      path,
      relPath,
      folderId: folder.id,
      libraryId,
      type
    })

    this.handlePendingFileUpdatesTimeout()
    return true
  }

  /**
   * Wait X seconds before notifying scanner that files changed
   * reset timer if files are still copying
   */
  handlePendingFileUpdatesTimeout() {
    clearTimeout(this.pendingTimeout!)
    this.pendingTimeout = setTimeout(() => {
      // Check that files are not still being added
      if (this.pendingFileUpdates.some((pfu) => this.filesBeingAdded.has(pfu.path))) {
        Logger.debug(`[Watcher] Still waiting for pending files "${[...this.filesBeingAdded].join(', ')}"`)
        return this.handlePendingFileUpdatesTimeout()
      }

      // addFileUpdate creates the task before scheduling this callback.
      const pendingTask = this.pendingTask!
      if (this.pendingFileUpdates.length) {
        this.emit('scanFilesChanged', this.pendingFileUpdates, pendingTask)
      } else {
        const taskFinishedString = {
          text: 'No files to scan',
          key: 'MessageTaskNoFilesToScan'
        }
        pendingTask.setFinished(taskFinishedString)
        TaskManager.taskFinished(pendingTask)
      }
      this.pendingTask = null
      this.pendingFileUpdates = []
      this.filesBeingAdded.clear()
    }, this.pendingDelay)
  }

  checkShouldIgnorePath(path: string) {
    return !!this.ignoreDirs.find((dirpath) => {
      return isSameOrSubPath(dirpath, path)
    })
  }

  /**
   * When scanning a library item folder these files should be ignored
   * Either a podcast episode downloading or a file that is pending by the watcher
   *
   */
  checkShouldIgnoreFilePath(path: string) {
    if (this.pendingFilePaths.includes(path)) return true
    return this.ignoreFilePathsDownloading.has(path)
  }

  /**
   * Convert to POSIX and remove trailing slash
   */
  cleanDirPath(path: string) {
    path = filePathToPOSIX(path)
    if (path.endsWith('/')) path = path.slice(0, -1)
    return path
  }

  /**
   * Ignore this directory if files are picked up by watcher
   */
  addIgnoreDir(path: string) {
    path = this.cleanDirPath(path)
    this.pendingDirsToRemoveFromIgnore = this.pendingDirsToRemoveFromIgnore.filter((p) => p !== path)
    if (this.ignoreDirs.includes(path)) {
      // Already ignoring dir
      return
    }
    Logger.debug(`[Watcher] addIgnoreDir: Ignoring directory "${path}"`)
    this.ignoreDirs.push(path)
  }

  /**
   * When downloading a podcast episode we dont want the scanner triggering for that podcast
   * when the episode finishes the watcher may have a delayed response so a timeout is added
   * to prevent the watcher from picking up the episode
   *
   */
  removeIgnoreDir(path: string) {
    path = this.cleanDirPath(path)
    if (!this.ignoreDirs.includes(path)) {
      Logger.debug(`[Watcher] removeIgnoreDir: Path is not being ignored "${path}"`)
      return
    }

    // Add a 5 second delay before removing the ignore from this dir
    if (!this.pendingDirsToRemoveFromIgnore.includes(path)) {
      this.pendingDirsToRemoveFromIgnore.push(path)
    }

    clearTimeout(this.removeFromIgnoreTimer!)
    this.removeFromIgnoreTimer = setTimeout(() => {
      if (this.pendingDirsToRemoveFromIgnore.includes(path)) {
        this.pendingDirsToRemoveFromIgnore = this.pendingDirsToRemoveFromIgnore.filter((p) => p !== path)
        Logger.debug(`[Watcher] removeIgnoreDir: No longer ignoring directory "${path}"`)
        this.ignoreDirs = this.ignoreDirs.filter((p) => p !== path)
      }
    }, 5000)
  }
}
export = new FolderWatcher()
