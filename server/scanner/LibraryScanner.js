const sequelize = require('sequelize')
const Path = require('path')
const packageJson = require('../../package.json')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const fs = require('../libs/fsExtra')
const fileUtils = require('../utils/fileUtils')
const scanUtils = require('../utils/scandir')
const { LogLevel, ScanResult } = require('../utils/constants')
const libraryFilters = require('../utils/queries/libraryFilters')
const TaskManager = require('../managers/TaskManager')
const LibraryItemScanner = require('./LibraryItemScanner')
const LibraryScan = require('./LibraryScan')
const LibraryItemScanData = require('./LibraryItemScanData')
const Task = require('../objects/Task')

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
    const libraryItemGrouping = scanUtils.groupFileItemsIntoLibraryItemDirs(library.mediaType, fileItems, library.settings.audiobooksOnly)

    if (!Object.keys(libraryItemGrouping).length) {
      Logger.error(`Root path has no media folders: ${folderPath}`)
      return []
    }

    const items = []
    for (const libraryItemPath in libraryItemGrouping) {
      let isFile = false // item is not in a folder
      let libraryItemData = null
      let fileObjs = []
      if (libraryItemPath === libraryItemGrouping[libraryItemPath]) {
        // Media file in root only get title
        libraryItemData = {
          mediaMetadata: {
            title: Path.basename(libraryItemPath, Path.extname(libraryItemPath))
          },
          path: Path.posix.join(folderPath, libraryItemPath),
          relPath: libraryItemPath
        }
        fileObjs = await scanUtils.buildLibraryFile(folderPath, [libraryItemPath])
        isFile = true
      } else {
        libraryItemData = scanUtils.getDataFromMediaDir(library.mediaType, folderPath, libraryItemPath)
        fileObjs = await scanUtils.buildLibraryFile(libraryItemData.path, libraryItemGrouping[libraryItemPath])
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

function ItemToItemInoMatch(libraryItem1, libraryItem2) {
  return libraryItem1.ino === libraryItem2.ino
}

function hasAudioFiles(fileUpdateGroup, itemDir) {
  return isSingleMediaFile(fileUpdateGroup, itemDir) ? scanUtils.checkFilepathIsAudioFile(fileUpdateGroup[itemDir]) : fileUpdateGroup[itemDir].some(scanUtils.checkFilepathIsAudioFile)
}

function isSingleMediaFile(fileUpdateGroup, itemDir) {
  return itemDir === fileUpdateGroup[itemDir]
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
