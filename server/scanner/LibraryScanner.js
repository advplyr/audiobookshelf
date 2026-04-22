const sequelize = require('sequelize')
const Path = require('path')
const packageJson = require('../../package.json')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const fs = require('../libs/fsExtra')
const fileUtils = require('../utils/fileUtils')
const scanUtils = require('../utils/scandir')
const globals = require('../utils/globals')
const { LogLevel, ScanResult } = require('../utils/constants')
const libraryFilters = require('../utils/queries/libraryFilters')
const TaskManager = require('../managers/TaskManager')
const LibraryItemScanner = require('./LibraryItemScanner')
const LibraryScan = require('./LibraryScan')
const LibraryItemScanData = require('./LibraryItemScanData')
const Task = require('../objects/Task')
const OpenAI = require('../providers/OpenAI')

const openAI = new OpenAI()
const DISC_DIR_REGEX = /^(cd|dis[ck])\s*\d{1,3}$/i

class LibraryScanner {
  constructor() {
    this.cancelLibraryScan = {}
    /** @type {string[]} - library ids */
    this.librariesScanning = []

    this.scanningFilesChanged = false
    /** @type {[import('../Watcher').PendingFileUpdate[], Task][]} */
    this.pendingFileUpdatesToScan = []
  }

  /**
   * @param {string} libraryId
   * @returns {boolean}
   */
  isLibraryScanning(libraryId) {
    return this.librariesScanning.some((lid) => lid === libraryId)
  }

  /**
   *
   * @param {string} libraryId
   */
  setCancelLibraryScan(libraryId) {
    if (!this.isLibraryScanning(libraryId)) return
    this.cancelLibraryScan[libraryId] = true
  }

  /**
   *
   * @param {import('../models/Library')} library
   * @param {boolean} [forceRescan]
   */
  async scan(library, forceRescan = false) {
    if (this.isLibraryScanning(library.id)) {
      Logger.error(`[LibraryScanner] Already scanning ${library.id}`)
      return
    }

    if (!library.libraryFolders.length) {
      Logger.warn(`[LibraryScanner] Library has no folders to scan "${library.name}"`)
      return
    }

    const metadataPrecedence = library.settings.metadataPrecedence || Database.libraryModel.defaultMetadataPrecedence
    if (library.isBook && metadataPrecedence.join() !== library.lastScanMetadataPrecedence.join()) {
      const lastScanMetadataPrecedence = library.lastScanMetadataPrecedence?.join() || 'Unset'
      Logger.info(`[LibraryScanner] Library metadata precedence changed since last scan. From [${lastScanMetadataPrecedence}] to [${metadataPrecedence.join()}]`)
      forceRescan = true
    }

    const libraryScan = new LibraryScan()
    libraryScan.setData(library)
    libraryScan.verbose = true
    this.librariesScanning.push(libraryScan.libraryId)

    const taskData = {
      libraryId: library.id,
      libraryName: library.name,
      libraryMediaType: library.mediaType
    }
    const taskTitleString = {
      text: `Scanning "${library.name}" library`,
      key: 'MessageTaskScanningLibrary',
      subs: [library.name]
    }
    const task = TaskManager.createAndAddTask('library-scan', taskTitleString, null, true, taskData)

    Logger.info(`[LibraryScanner] Starting${forceRescan ? ' (forced)' : ''} library scan ${libraryScan.id} for ${libraryScan.libraryName}`)

    try {
      const canceled = await this.scanLibrary(libraryScan, forceRescan)
      libraryScan.setComplete()

      Logger.info(`[LibraryScanner] Library scan "${libraryScan.id}" ${canceled ? 'canceled after' : 'completed in'} ${libraryScan.elapsedTimestamp} | ${libraryScan.resultStats}`)

      if (!canceled) {
        library.lastScan = Date.now()
        library.lastScanVersion = packageJson.version
        if (library.isBook) {
          const newExtraData = library.extraData || {}
          newExtraData.lastScanMetadataPrecedence = metadataPrecedence
          library.extraData = newExtraData
          library.changed('extraData', true)
        }
        await library.save()
      }

      task.data.scanResults = libraryScan.scanResults
      if (canceled) {
        const taskFinishedString = {
          text: 'Task canceled by user',
          key: 'MessageTaskCanceledByUser'
        }
        task.setFinished(taskFinishedString)
      } else {
        task.setFinished(null, true)
      }
    } catch (err) {
      libraryScan.setComplete()

      Logger.error(`[LibraryScanner] Library scan ${libraryScan.id} failed after ${libraryScan.elapsedTimestamp} | ${libraryScan.resultStats}.`, err)

      task.data.scanResults = libraryScan.scanResults
      const taskFailedString = {
        text: 'Failed',
        key: 'MessageTaskFailed'
      }
      task.setFailed(taskFailedString)
    }

    if (this.cancelLibraryScan[libraryScan.libraryId]) delete this.cancelLibraryScan[libraryScan.libraryId]
    this.librariesScanning = this.librariesScanning.filter((lid) => lid !== library.id)

    TaskManager.taskFinished(task)

    libraryScan.saveLog()
  }

  /**
   *
   * @param {import('./LibraryScan')} libraryScan
   * @param {boolean} forceRescan
   * @returns {Promise<boolean>} true if scan canceled
   */
  async scanLibrary(libraryScan, forceRescan) {
    // Make sure library filter data is set
    //   this is used to check for existing authors & series
    await libraryFilters.getFilterData(libraryScan.libraryMediaType, libraryScan.libraryId)

    /** @type {LibraryItemScanData[]} */
    let libraryItemDataFound = []

    // Scan each library folder
    for (let i = 0; i < libraryScan.libraryFolders.length; i++) {
      const folder = libraryScan.libraryFolders[i]
      const itemDataFoundInFolder = await this.scanFolder(libraryScan.library, folder)
      libraryScan.addLog(LogLevel.INFO, `${itemDataFoundInFolder.length} item data found in folder "${folder.path}"`)
      libraryItemDataFound = libraryItemDataFound.concat(itemDataFoundInFolder)
    }

    if (this.shouldCancelScan(libraryScan)) return true

    const existingLibraryItems = await Database.libraryItemModel.findAll({
      where: {
        libraryId: libraryScan.libraryId
      }
    })

    if (this.shouldCancelScan(libraryScan)) return true

    const libraryItemIdsMissing = []
    let libraryItemsUpdated = []
    for (const existingLibraryItem of existingLibraryItems) {
      // First try to find matching library item with exact file path
      let libraryItemData = libraryItemDataFound.find((lid) => lid.path === existingLibraryItem.path)
      if (!libraryItemData) {
        // Fallback to finding matching library item with matching inode value
        libraryItemData = libraryItemDataFound.find((lid) => ItemToItemInoMatch(lid, existingLibraryItem) || ItemToFileInoMatch(lid, existingLibraryItem) || ItemToFileInoMatch(existingLibraryItem, lid))
        if (libraryItemData) {
          libraryScan.addLog(LogLevel.INFO, `Library item with path "${existingLibraryItem.path}" was not found, but library item inode "${existingLibraryItem.ino}" was found at path "${libraryItemData.path}"`)
        }
      }

      if (!libraryItemData) {
        // Podcast folder can have no episodes and still be valid
        if (libraryScan.libraryMediaType === 'podcast' && (await fs.pathExists(existingLibraryItem.path))) {
          libraryScan.addLog(LogLevel.INFO, `Library item "${existingLibraryItem.relPath}" folder exists but has no episodes`)
        } else {
          libraryScan.addLog(LogLevel.WARN, `Library Item "${existingLibraryItem.path}" (inode: ${existingLibraryItem.ino}) is missing`)
          libraryScan.resultsMissing++
          if (!existingLibraryItem.isMissing) {
            libraryItemIdsMissing.push(existingLibraryItem.id)

            // TODO: Temporary while using old model to socket emit
            const libraryItem = await Database.libraryItemModel.getExpandedById(existingLibraryItem.id)
            if (libraryItem) {
              libraryItem.isMissing = true
              await libraryItem.save()
              libraryItemsUpdated.push(libraryItem)
            }
          }
        }
      } else {
        libraryItemDataFound = libraryItemDataFound.filter((lidf) => lidf !== libraryItemData)
        let libraryItemDataUpdated = await libraryItemData.checkLibraryItemData(existingLibraryItem, libraryScan)
        if (libraryItemDataUpdated || forceRescan) {
          if (forceRescan || libraryItemData.hasLibraryFileChanges || libraryItemData.hasPathChange) {
            const { libraryItem, wasUpdated } = await LibraryItemScanner.rescanLibraryItemMedia(existingLibraryItem, libraryItemData, libraryScan.library.settings, libraryScan)
            if (!forceRescan || wasUpdated) {
              libraryScan.resultsUpdated++
              libraryItemsUpdated.push(libraryItem)
            } else {
              libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" is up-to-date`)
            }
          } else {
            libraryScan.resultsUpdated++
            // TODO: Temporary while using old model to socket emit
            const libraryItem = await Database.libraryItemModel.getExpandedById(existingLibraryItem.id)
            libraryItemsUpdated.push(libraryItem)
          }
        } else {
          libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" is up-to-date`)
        }
      }

      // Emit item updates in chunks of 10 to client
      if (libraryItemsUpdated.length === 10) {
        SocketAuthority.libraryItemsEmitter('items_updated', libraryItemsUpdated)
        libraryItemsUpdated = []
      }

      if (this.shouldCancelScan(libraryScan)) return true
    }
    // Emit item updates to client
    if (libraryItemsUpdated.length) {
      SocketAuthority.libraryItemsEmitter('items_updated', libraryItemsUpdated)
    }

    // Authors and series that were removed from books should be removed if they are now empty
    await LibraryItemScanner.checkAuthorsAndSeriesRemovedFromBooks(libraryScan.libraryId, libraryScan)

    // Update missing library items
    if (libraryItemIdsMissing.length) {
      libraryScan.addLog(LogLevel.INFO, `Updating ${libraryItemIdsMissing.length} library items missing`)
      await Database.libraryItemModel.update(
        {
          isMissing: true,
          lastScan: Date.now(),
          lastScanVersion: packageJson.version
        },
        {
          where: {
            id: libraryItemIdsMissing
          }
        }
      )
    }

    if (this.shouldCancelScan(libraryScan)) return true

    // Add new library items
    if (libraryItemDataFound.length) {
      let newLibraryItems = []
      for (const libraryItemData of libraryItemDataFound) {
        const newLibraryItem = await LibraryItemScanner.scanNewLibraryItem(libraryItemData, libraryScan.library.settings, libraryScan)
        if (newLibraryItem) {
          newLibraryItems.push(newLibraryItem)

          libraryScan.resultsAdded++
        }

        // Emit new items in chunks of 10 to client
        if (newLibraryItems.length === 10) {
          SocketAuthority.libraryItemsEmitter('items_added', newLibraryItems)
          newLibraryItems = []
        }

        if (this.shouldCancelScan(libraryScan)) return true
      }
      // Emit new items to client
      if (newLibraryItems.length) {
        SocketAuthority.libraryItemsEmitter('items_added', newLibraryItems)
      }
    }

    libraryScan.addLog(LogLevel.INFO, `Scan completed. ${libraryScan.resultStats}`)
    return false
  }

  shouldCancelScan(libraryScan) {
    if (this.cancelLibraryScan[libraryScan.libraryId]) {
      libraryScan.addLog(LogLevel.INFO, `Scan canceled. ${libraryScan.resultStats}`)
      return true
    }
    return false
  }

  /**
   * Get scan data for library folder
   * @param {import('../models/Library')} library
   * @param {import('../models/LibraryFolder')} folder
   * @returns {LibraryItemScanData[]}
   */
  async scanFolder(library, folder) {
    const folderPath = fileUtils.filePathToPOSIX(folder.path)

    const pathExists = await fs.pathExists(folderPath)
    if (!pathExists) {
      Logger.error(`[scandir] Invalid folder path does not exist "${folderPath}"`)
      return []
    }

    const fileItems = await fileUtils.recurseFiles(folderPath)
    let libraryItemGrouping = scanUtils.groupFileItemsIntoLibraryItemDirs(library.mediaType, fileItems, library.settings.audiobooksOnly)
    if (library.mediaType === 'book' && library.settings.openAIDirectoryGrouping && openAI.isConfigured) {
      libraryItemGrouping = await this.applyOpenAIDirectoryGrouping(folderPath, fileItems, libraryItemGrouping, library.settings.audiobooksOnly)
    }

    if (!Object.keys(libraryItemGrouping).length) {
      Logger.error(`Root path has no media folders: ${folderPath}`)
      return []
    }

    const items = []
    for (const libraryItemPath in libraryItemGrouping) {
      let isFile = false // item is not in a folder
      let libraryItemData = null
      let fileObjs = []
      const groupedFiles = libraryItemGrouping[libraryItemPath]
      const isSingleFileGroup =
        libraryItemPath === groupedFiles || (Array.isArray(groupedFiles) && groupedFiles.includes(libraryItemPath))

      if (isSingleFileGroup) {
        // Media file item may exist in the library root or inside a poorly-structured parent folder.
        libraryItemData = {
          mediaMetadata: {
            title: Path.basename(libraryItemPath, Path.extname(libraryItemPath))
          },
          path: Path.posix.join(folderPath, libraryItemPath),
          relPath: libraryItemPath
        }
        fileObjs = await scanUtils.buildLibraryFile(folderPath, Array.isArray(groupedFiles) ? groupedFiles : [libraryItemPath])
        isFile = true
      } else {
        libraryItemData = scanUtils.getDataFromMediaDir(library.mediaType, folderPath, libraryItemPath)
        fileObjs = await scanUtils.buildLibraryFile(libraryItemData.path, groupedFiles)
      }

      const libraryItemFolderStats = await fileUtils.getFileTimestampsWithIno(libraryItemData.path)

      if (!libraryItemFolderStats.ino) {
        Logger.warn(`[LibraryScanner] Library item folder "${libraryItemData.path}" has no inode value`)
        continue
      }

      items.push(
        new LibraryItemScanData({
          libraryFolderId: folder.id,
          libraryId: folder.libraryId,
          mediaType: library.mediaType,
          ino: libraryItemFolderStats.ino,
          mtimeMs: libraryItemFolderStats.mtimeMs || 0,
          ctimeMs: libraryItemFolderStats.ctimeMs || 0,
          birthtimeMs: libraryItemFolderStats.birthtimeMs || 0,
          path: libraryItemData.path,
          relPath: libraryItemData.relPath,
          isFile,
          mediaMetadata: libraryItemData.mediaMetadata || null,
          libraryFiles: fileObjs
        })
      )
    }
    return items
  }

  expandGroupingFiles(groupPath, groupedFiles) {
    if (groupPath === groupedFiles) return [groupPath]
    return groupedFiles.map((file) => {
      if (file === groupPath || file.startsWith(groupPath + '/')) return file
      return Path.posix.join(groupPath, file)
    })
  }

  getOpenAIDirectoryGroupingCandidates(fileItems, mediaType, audiobooksOnly, libraryItemGrouping) {
    if (mediaType !== 'book') return []

    const mediaFileItems = fileItems.filter((item) => isMediaFilePath(mediaType, item.path, audiobooksOnly))
    const candidatesByContainer = new Map()

    mediaFileItems.forEach((item) => {
      const topLevelDir = item.path.split('/').filter(Boolean)[0]
      if (!topLevelDir || !item.path.includes('/')) return
      if (!candidatesByContainer.has(topLevelDir)) {
        candidatesByContainer.set(topLevelDir, [])
      }
      candidatesByContainer.get(topLevelDir).push(item)
    })

    return [...candidatesByContainer.entries()]
      .map(([containerPath, containerMediaFileItems]) => {
        const defaultGroupKeys = Object.keys(libraryItemGrouping).filter((groupPath) => groupPath === containerPath || groupPath.startsWith(containerPath + '/'))
        const hasDirectMediaFileInContainer = containerMediaFileItems.some((item) => Path.posix.dirname(item.path) === containerPath)
        const hasMixedDefaultFileAndDirectoryGroups =
          defaultGroupKeys.some((groupPath) => Path.posix.extname(groupPath)) && defaultGroupKeys.some((groupPath) => !Path.posix.extname(groupPath))
        const maxRelativeDepth = Math.max(...containerMediaFileItems.map((item) => Path.posix.relative(containerPath, item.path).split('/').filter(Boolean).length))
        const suspicious = defaultGroupKeys.length <= 1 || hasDirectMediaFileInContainer || hasMixedDefaultFileAndDirectoryGroups || maxRelativeDepth > 2

        if (!suspicious || containerMediaFileItems.length < 2 || containerMediaFileItems.length > 40) {
          return null
        }

        const groupingHints = containerMediaFileItems.map((item) => ({
          path: item.path,
          filename: item.name,
          parentDir: item.reldirpath || '',
          folderHierarchy: item.path.split('/').slice(0, -1).filter(Boolean),
          currentGroup: defaultGroupKeys.find((groupPath) => this.expandGroupingFiles(groupPath, libraryItemGrouping[groupPath]).includes(item.path)) || null
        }))

        return {
          containerPath,
          groupingHints
        }
      })
      .filter(Boolean)
  }

  getDirectoryGroupingDescriptor(containerPath, mediaPaths) {
    const sortedMediaPaths = [...mediaPaths].sort((a, b) => a.localeCompare(b))
    if (sortedMediaPaths.length === 1) {
      const mediaDir = Path.posix.dirname(sortedMediaPaths[0])
      if (mediaDir && mediaDir !== '.' && mediaDir !== containerPath) {
        return {
          groupPath: mediaDir,
          isFile: false
        }
      }
      return {
        groupPath: sortedMediaPaths[0],
        isFile: true
      }
    }

    const splitPaths = sortedMediaPaths.map((mediaPath) => mediaPath.split('/'))
    const commonParts = []
    for (let i = 0; i < Math.min(...splitPaths.map((parts) => parts.length - 1)); i++) {
      const segment = splitPaths[0][i]
      if (splitPaths.every((parts) => parts[i] === segment)) {
        commonParts.push(segment)
      } else {
        break
      }
    }
    const commonDir = commonParts.join('/')

    if (commonDir) {
      const canUseFolderGroup = sortedMediaPaths.every((mediaPath) => {
        const relativeParts = Path.posix.relative(commonDir, mediaPath).split('/').filter(Boolean)
        return relativeParts.length === 1 || (relativeParts.length === 2 && DISC_DIR_REGEX.test(relativeParts[0]))
      })

      if (canUseFolderGroup) {
        return {
          groupPath: commonDir,
          isFile: false
        }
      }
    }

    return {
      groupPath: sortedMediaPaths[0],
      isFile: true
    }
  }

  buildLibraryItemGroupingFromOpenAIAssignments(containerPath, fileItems, assignments, mediaType, audiobooksOnly) {
    const mediaPathsByGroupId = new Map()
    assignments.forEach((assignment) => {
      if (!mediaPathsByGroupId.has(assignment.groupId)) {
        mediaPathsByGroupId.set(assignment.groupId, [])
      }
      mediaPathsByGroupId.get(assignment.groupId).push(assignment.path)
    })

    const groupRecords = [...mediaPathsByGroupId.entries()].map(([groupId, mediaPaths]) => {
      const descriptor = this.getDirectoryGroupingDescriptor(containerPath, mediaPaths)
      return {
        groupId,
        descriptor,
        mediaPaths: [...mediaPaths].sort((a, b) => a.localeCompare(b)),
        files: []
      }
    })

    groupRecords.forEach((groupRecord) => {
      if (groupRecord.descriptor.isFile) {
        groupRecord.files.push(...groupRecord.mediaPaths)
      } else {
        groupRecord.files.push(...groupRecord.mediaPaths.map((mediaPath) => Path.posix.relative(groupRecord.descriptor.groupPath, mediaPath)))
      }
    })

    const nonMediaItems = fileItems.filter((item) => !isMediaFilePath(mediaType, item.path, audiobooksOnly))
    nonMediaItems.forEach((item) => {
      const itemStem = Path.basename(item.name, item.extension)

      let matchingGroup = null
      const basenameMatches = groupRecords.filter((groupRecord) =>
        groupRecord.mediaPaths.some((mediaPath) => Path.posix.dirname(mediaPath) === item.reldirpath && Path.basename(mediaPath, Path.extname(mediaPath)) === itemStem)
      )
      if (basenameMatches.length === 1) {
        matchingGroup = basenameMatches[0]
      }

      if (!matchingGroup) {
        const directoryMatches = groupRecords.filter((groupRecord) => {
          if (!groupRecord.descriptor.isFile) {
            return item.path.startsWith(groupRecord.descriptor.groupPath + '/')
          }
          return Path.posix.dirname(groupRecord.descriptor.groupPath) === item.reldirpath
        })
        if (directoryMatches.length === 1) {
          matchingGroup = directoryMatches[0]
        }
      }

      if (!matchingGroup) return

      const fileEntry = matchingGroup.descriptor.isFile ? item.path : Path.posix.relative(matchingGroup.descriptor.groupPath, item.path)
      if (!matchingGroup.files.includes(fileEntry)) {
        matchingGroup.files.push(fileEntry)
      }
    })

    return groupRecords.reduce((acc, groupRecord) => {
      acc[groupRecord.descriptor.groupPath] = [...new Set(groupRecord.files)]
      return acc
    }, {})
  }

  async applyOpenAIDirectoryGrouping(folderPath, fileItems, libraryItemGrouping, audiobooksOnly) {
    const candidates = this.getOpenAIDirectoryGroupingCandidates(fileItems, 'book', audiobooksOnly, libraryItemGrouping)
    if (!candidates.length) return libraryItemGrouping

    let updatedGrouping = { ...libraryItemGrouping }
    for (const candidate of candidates) {
      Logger.info(`[LibraryScanner] Evaluating OpenAI directory grouping for "${candidate.containerPath}" with ${candidate.groupingHints.length} media files`)
      const containerFileItems = fileItems.filter((item) => item.path === candidate.containerPath || item.path.startsWith(candidate.containerPath + '/'))
      const assignments = await openAI.inferDirectoryGroupingFromPaths(candidate.containerPath, candidate.groupingHints).catch((error) => {
        Logger.warn(`[LibraryScanner] OpenAI directory grouping failed for "${candidate.containerPath}": ${error.message}`)
        return null
      })
      if (!assignments?.length) continue

      const aiGrouping = this.buildLibraryItemGroupingFromOpenAIAssignments(candidate.containerPath, containerFileItems, assignments, 'book', audiobooksOnly)
      if (!Object.keys(aiGrouping).length) continue

      updatedGrouping = Object.fromEntries(
        Object.entries(updatedGrouping).filter(([groupPath]) => !(groupPath === candidate.containerPath || groupPath.startsWith(candidate.containerPath + '/')))
      )
      updatedGrouping = {
        ...updatedGrouping,
        ...aiGrouping
      }
      Logger.info(`[LibraryScanner] Applied OpenAI directory grouping for "${candidate.containerPath}" -> ${Object.keys(aiGrouping).length} library items`)
    }

    return updatedGrouping
  }

  /**
   * Scan files changed from Watcher
   * @param {import('../Watcher').PendingFileUpdate[]} fileUpdates
   * @param {Task} pendingTask
   */
  async scanFilesChanged(fileUpdates, pendingTask) {
    if (!fileUpdates?.length) return

    // If already scanning files from watcher then add these updates to queue
    if (this.scanningFilesChanged) {
      this.pendingFileUpdatesToScan.push([fileUpdates, pendingTask])
      Logger.debug(`[LibraryScanner] Already scanning files from watcher - file updates pushed to queue (size ${this.pendingFileUpdatesToScan.length})`)
      return
    }
    this.scanningFilesChanged = true

    const results = {
      added: 0,
      updated: 0,
      removed: 0
    }

    // files grouped by folder
    const folderGroups = this.getFileUpdatesGrouped(fileUpdates)

    for (const folderId in folderGroups) {
      const libraryId = folderGroups[folderId].libraryId

      const library = await Database.libraryModel.findByPk(libraryId, {
        include: {
          model: Database.libraryFolderModel,
          where: {
            id: folderId
          }
        }
      })
      if (!library) {
        Logger.error(`[LibraryScanner] Library "${libraryId}" not found in files changed ${libraryId}`)
        continue
      }
      const folder = library.libraryFolders[0]

      const filePathItems = folderGroups[folderId].fileUpdates.map((fileUpdate) => fileUtils.getFilePathItemFromFileUpdate(fileUpdate))
      const fileUpdateGroup = scanUtils.groupFileItemsIntoLibraryItemDirs(library.mediaType, filePathItems, !!library.settings?.audiobooksOnly, true)

      if (!Object.keys(fileUpdateGroup).length) {
        Logger.info(`[LibraryScanner] No important changes to scan for in folder "${folderId}"`)
        continue
      }
      const folderScanResults = await this.scanFolderUpdates(library, folder, fileUpdateGroup)
      Logger.debug(`[LibraryScanner] Folder scan results`, folderScanResults)

      // Tally results to share with client
      let resetFilterData = false
      Object.values(folderScanResults).forEach((scanResult) => {
        if (scanResult === ScanResult.ADDED) {
          resetFilterData = true
          results.added++
        } else if (scanResult === ScanResult.REMOVED) {
          resetFilterData = true
          results.removed++
        } else if (scanResult === ScanResult.UPDATED) {
          resetFilterData = true
          results.updated++
        }
      })

      // If something was updated then reset numIssues filter data for library
      if (resetFilterData) {
        await Database.resetLibraryIssuesFilterData(libraryId)
      }
    }

    // Complete task and send results to client
    const resultStrs = []
    if (results.added) resultStrs.push(`${results.added} added`)
    if (results.updated) resultStrs.push(`${results.updated} updated`)
    if (results.removed) resultStrs.push(`${results.removed} missing`)
    let scanResultStr = 'No changes needed'
    if (resultStrs.length) scanResultStr = resultStrs.join(', ')

    pendingTask.data.scanResults = {
      ...results,
      text: scanResultStr,
      elapsed: Date.now() - pendingTask.startedAt
    }
    pendingTask.setFinished(null, true)
    TaskManager.taskFinished(pendingTask)

    this.scanningFilesChanged = false

    if (this.pendingFileUpdatesToScan.length) {
      Logger.debug(`[LibraryScanner] File updates finished scanning with more updates in queue (${this.pendingFileUpdatesToScan.length})`)
      this.scanFilesChanged(...this.pendingFileUpdatesToScan.shift())
    }
  }

  /**
   * Group array of PendingFileUpdate from Watcher by folder
   * @param {import('../Watcher').PendingFileUpdate[]} fileUpdates
   * @returns {Record<string,{libraryId:string, folderId:string, fileUpdates:import('../Watcher').PendingFileUpdate[]}>}
   */
  getFileUpdatesGrouped(fileUpdates) {
    const folderGroups = {}
    fileUpdates.forEach((file) => {
      if (folderGroups[file.folderId]) {
        folderGroups[file.folderId].fileUpdates.push(file)
      } else {
        folderGroups[file.folderId] = {
          libraryId: file.libraryId,
          folderId: file.folderId,
          fileUpdates: [file]
        }
      }
    })
    return folderGroups
  }

  /**
   * Scan grouped paths for library folder coming from Watcher
   * @param {import('../models/Library')} library
   * @param {import('../models/LibraryFolder')} folder
   * @param {Record<string, string[]>} fileUpdateGroup
   * @returns {Promise<Record<string,number>>}
   */
  async scanFolderUpdates(library, folder, fileUpdateGroup) {
    // Make sure library filter data is set
    //   this is used to check for existing authors & series
    await libraryFilters.getFilterData(library.mediaType, library.id)
    Logger.debug(`[Scanner] Scanning file update groups in folder "${folder.id}" of library "${library.name}"`)
    Logger.debug(`[Scanner] scanFolderUpdates fileUpdateGroup`, fileUpdateGroup)

    // First pass - Remove files in parent dirs of items and remap the fileupdate group
    //    Test Case: Moving audio files from library item folder to author folder should trigger a re-scan of the item
    const updateGroup = { ...fileUpdateGroup }
    for (const itemDir in updateGroup) {
      if (isSingleMediaFile(fileUpdateGroup, itemDir)) continue // Media in root path

      const itemDirNestedFiles = fileUpdateGroup[itemDir].filter((b) => b.includes('/'))
      if (!itemDirNestedFiles.length) continue

      const firstNest = itemDirNestedFiles[0].split('/').shift()
      const altDir = `${itemDir}/${firstNest}`

      const fullPath = Path.posix.join(fileUtils.filePathToPOSIX(folder.path), itemDir)
      const childLibraryItem = await Database.libraryItemModel.findOne({
        attributes: ['id', 'path'],
        where: {
          path: {
            [sequelize.Op.not]: fullPath
          },
          path: {
            [sequelize.Op.startsWith]: fullPath
          }
        }
      })
      if (!childLibraryItem) {
        continue
      }

      const altFullPath = Path.posix.join(fileUtils.filePathToPOSIX(folder.path), altDir)
      const altChildLibraryItem = await Database.libraryItemModel.findOne({
        attributes: ['id', 'path'],
        where: {
          path: {
            [sequelize.Op.not]: altFullPath
          },
          path: {
            [sequelize.Op.startsWith]: altFullPath
          }
        }
      })
      if (altChildLibraryItem) {
        continue
      }

      delete fileUpdateGroup[itemDir]
      fileUpdateGroup[altDir] = itemDirNestedFiles.map((f) => f.split('/').slice(1).join('/'))
      Logger.warn(`[LibraryScanner] Some files were modified in a parent directory of a library item "${childLibraryItem.path}" - ignoring`)
    }

    // Second pass: Check for new/updated/removed items
    const itemGroupingResults = {}
    for (const itemDir in fileUpdateGroup) {
      const fullPath = Path.posix.join(fileUtils.filePathToPOSIX(folder.path), itemDir)

      const itemDirParts = itemDir.split('/').slice(0, -1)

      const potentialChildDirs = [fullPath]
      for (let i = 0; i < itemDirParts.length; i++) {
        potentialChildDirs.push(
          Path.posix.join(
            fileUtils.filePathToPOSIX(folder.path),
            itemDir
              .split('/')
              .slice(0, -1 - i)
              .join('/')
          )
        )
      }

      // Check if book dir group is already an item
      let existingLibraryItem = await Database.libraryItemModel.findOneExpanded({
        libraryId: library.id,
        path: potentialChildDirs
      })

      let updatedLibraryItemDetails = {}
      if (!existingLibraryItem) {
        const isSingleMedia = isSingleMediaFile(fileUpdateGroup, itemDir)
        existingLibraryItem = (await findLibraryItemByItemToItemInoMatch(library.id, fullPath)) || (await findLibraryItemByItemToFileInoMatch(library.id, fullPath, isSingleMedia)) || (await findLibraryItemByFileToItemInoMatch(library.id, fullPath, isSingleMedia, fileUpdateGroup[itemDir]))
        if (existingLibraryItem) {
          // Update library item paths for scan
          existingLibraryItem.path = fullPath
          existingLibraryItem.relPath = itemDir
          updatedLibraryItemDetails.path = fullPath
          updatedLibraryItemDetails.relPath = itemDir
          updatedLibraryItemDetails.libraryFolderId = folder.id
          updatedLibraryItemDetails.isFile = isSingleMedia
        }
      }
      if (existingLibraryItem) {
        // Is the item exactly - check if was deleted
        if (existingLibraryItem.path === fullPath) {
          const exists = await fs.pathExists(fullPath)
          if (!exists) {
            Logger.info(`[LibraryScanner] Scanning file update group and library item was deleted "${existingLibraryItem.media.title}" - marking as missing`)
            existingLibraryItem.isMissing = true
            await existingLibraryItem.save()
            SocketAuthority.libraryItemEmitter('item_updated', existingLibraryItem)

            itemGroupingResults[itemDir] = ScanResult.REMOVED
            continue
          }
        }
        // Scan library item for updates
        Logger.debug(`[LibraryScanner] Folder update for relative path "${itemDir}" is in library item "${existingLibraryItem.media.title}" with id "${existingLibraryItem.id}" - scan for updates`)
        itemGroupingResults[itemDir] = await LibraryItemScanner.scanLibraryItem(existingLibraryItem.id, updatedLibraryItemDetails)
        continue
      } else if (library.settings.audiobooksOnly && !hasAudioFiles(fileUpdateGroup, itemDir)) {
        Logger.debug(`[LibraryScanner] Folder update for relative path "${itemDir}" has no audio files`)
        continue
      } else if (!(await fs.pathExists(fullPath))) {
        Logger.info(`[LibraryScanner] File update group "${itemDir}" does not exist - ignoring`)

        itemGroupingResults[itemDir] = ScanResult.NOTHING
        continue
      }

      // Check if a library item is a subdirectory of this dir
      const childItem = await Database.libraryItemModel.findOne({
        attributes: ['id', 'path'],
        where: {
          path: {
            [sequelize.Op.startsWith]: fullPath + '/'
          }
        }
      })
      if (childItem) {
        Logger.warn(`[LibraryScanner] Files were modified in a parent directory of a library item "${childItem.path}" - ignoring`)
        itemGroupingResults[itemDir] = ScanResult.NOTHING
        continue
      }

      Logger.debug(`[LibraryScanner] Folder update group must be a new item "${itemDir}" in library "${library.name}"`)
      const isSingleMediaItem = isSingleMediaFile(fileUpdateGroup, itemDir)
      const newLibraryItem = await LibraryItemScanner.scanPotentialNewLibraryItem(fullPath, library, folder, isSingleMediaItem)
      if (newLibraryItem) {
        SocketAuthority.libraryItemEmitter('item_added', newLibraryItem)
      }
      itemGroupingResults[itemDir] = newLibraryItem ? ScanResult.ADDED : ScanResult.NOTHING
    }

    return itemGroupingResults
  }
}
module.exports = new LibraryScanner()

function ItemToFileInoMatch(libraryItem1, libraryItem2) {
  return libraryItem1.isFile && libraryItem2.libraryFiles.some((lf) => lf.ino === libraryItem1.ino)
}

function isMediaFilePath(mediaType, filepath, audiobooksOnly = false) {
  const ext = Path.extname(filepath).slice(1).toLowerCase()
  if (!ext) return false
  if (mediaType === 'podcast') return globals.SupportedAudioTypes.includes(ext)
  if (audiobooksOnly) return globals.SupportedAudioTypes.includes(ext)
  return globals.SupportedAudioTypes.includes(ext) || globals.SupportedEbookTypes.includes(ext)
}

function ItemToItemInoMatch(libraryItem1, libraryItem2) {
  return libraryItem1.ino === libraryItem2.ino
}

function hasAudioFiles(fileUpdateGroup, itemDir) {
  return isSingleMediaFile(fileUpdateGroup, itemDir) ? scanUtils.checkFilepathIsAudioFile(itemDir) : fileUpdateGroup[itemDir].some(scanUtils.checkFilepathIsAudioFile)
}

function isSingleMediaFile(fileUpdateGroup, itemDir) {
  return itemDir === fileUpdateGroup[itemDir] || (Array.isArray(fileUpdateGroup[itemDir]) && fileUpdateGroup[itemDir].includes(itemDir))
}

async function findLibraryItemByItemToItemInoMatch(libraryId, fullPath) {
  const ino = await fileUtils.getIno(fullPath)
  if (!ino) return null
  const existingLibraryItem = await Database.libraryItemModel.findOneExpanded({
    libraryId: libraryId,
    ino: ino
  })
  if (existingLibraryItem) Logger.debug(`[LibraryScanner] Found library item with matching inode "${ino}" at path "${existingLibraryItem.path}"`)
  return existingLibraryItem
}

async function findLibraryItemByItemToFileInoMatch(libraryId, fullPath, isSingleMedia) {
  if (!isSingleMedia) return null
  // check if it was moved from another folder by comparing the ino to the library files
  const ino = await fileUtils.getIno(fullPath)
  if (!ino) return null
  const existingLibraryItem = await Database.libraryItemModel.findOneExpanded(
    [
      {
        libraryId: libraryId
      },
      sequelize.where(sequelize.literal('(SELECT count(*) FROM json_each(libraryFiles) WHERE json_valid(json_each.value) AND json_each.value->>"$.ino" = :inode)'), {
        [sequelize.Op.gt]: 0
      })
    ],
    {
      inode: ino
    }
  )
  if (existingLibraryItem) Logger.debug(`[LibraryScanner] Found library item with a library file matching inode "${ino}" at path "${existingLibraryItem.path}"`)
  return existingLibraryItem
}

async function findLibraryItemByFileToItemInoMatch(libraryId, fullPath, isSingleMedia, itemFiles) {
  if (isSingleMedia) return null
  // check if it was moved from the root folder by comparing the ino to the ino of the scanned files
  let itemFileInos = []
  for (const itemFile of itemFiles) {
    const ino = await fileUtils.getIno(Path.posix.join(fullPath, itemFile))
    if (ino) itemFileInos.push(ino)
  }
  if (!itemFileInos.length) return null
  const existingLibraryItem = await Database.libraryItemModel.findOneExpanded({
    libraryId: libraryId,
    ino: {
      [sequelize.Op.in]: itemFileInos
    }
  })
  if (existingLibraryItem) Logger.debug(`[LibraryScanner] Found library item with inode matching one of "${itemFileInos.join(',')}" at path "${existingLibraryItem.path}"`)
  return existingLibraryItem
}
