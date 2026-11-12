import Path from 'path'
import { LogLevel, ScanResult } from '../utils/constants'

import fileUtils from '../utils/fileUtils'
import scanUtils from '../utils/scandir'
import libraryFilters from '../utils/queries/libraryFilters'
import Logger from '../Logger'
import Database from '../Database'
import Watcher from '../Watcher'
import LibraryItemScanData from './LibraryItemScanData'
import BookScanner from './BookScanner'
import PodcastScanner from './PodcastScanner'
import ScanLogger from './ScanLogger'
import LibraryFile from '../objects/files/LibraryFile'
import SocketAuthority from '../SocketAuthority'
import type Library from '../models/Library'
import type LibraryFolder from '../models/LibraryFolder'
import type LibraryItem from '../models/LibraryItem'
import type LibraryScan from './LibraryScan'

type UpdatedLibraryItemDetails = { path?: string; relPath?: string; libraryFolderId?: string; isFile?: boolean }
type ScannedLibraryFile = LibraryItemScanData['libraryFiles'][number]

class LibraryItemScanner {
  constructor() {}

  /**
   * Scan single library item
   *
   */
  async scanLibraryItem(libraryItemId: string, updateLibraryItemDetails: UpdatedLibraryItemDetails | null = null) {
    // TODO: Add task manager
    const libraryItem = await Database.libraryItemModel.findByPk(libraryItemId)
    if (!libraryItem) {
      Logger.error(`[LibraryItemScanner] Library item not found "${libraryItemId}"`)
      return ScanResult.NOTHING
    }

    const libraryFolderId = updateLibraryItemDetails?.libraryFolderId || libraryItem.libraryFolderId
    const library = await Database.libraryModel.findByPk(libraryItem.libraryId!, {
      include: {
        model: Database.libraryFolderModel,
        where: {
          id: libraryFolderId
        }
      }
    })
    if (!library) {
      Logger.error(`[LibraryItemScanner] Library "${libraryItem.libraryId}" not found for library item "${libraryItem.id}"`)
      return ScanResult.NOTHING
    }

    // Make sure library filter data is set
    //   this is used to check for existing authors & series
    await libraryFilters.getFilterData(library.mediaType!, library.id)

    const scanLogger = new ScanLogger()
    scanLogger.verbose = true
    scanLogger.setData('libraryItem', updateLibraryItemDetails?.relPath || libraryItem.relPath)

    const libraryItemPath = updateLibraryItemDetails?.path || fileUtils.filePathToPOSIX(libraryItem.path!)
    const folder = library.libraryFolders![0]
    const libraryItemScanData = await this.getLibraryItemScanData(libraryItemPath, library, folder, updateLibraryItemDetails?.isFile || false)

    const libraryItemDataUpdated = await libraryItemScanData.checkLibraryItemData(libraryItem, scanLogger)

    const { libraryItem: expandedLibraryItem, wasUpdated } = await this.rescanLibraryItemMedia(libraryItem, libraryItemScanData, library.settings!, scanLogger)
    if (libraryItemDataUpdated || wasUpdated) {
      SocketAuthority.libraryItemEmitter('item_updated', expandedLibraryItem)

      await this.finalizeAuthorsAndSeriesFromScan(library.id, scanLogger)

      return ScanResult.UPDATED
    }

    scanLogger.addLog(LogLevel.DEBUG, `Library item is up-to-date`)
    return ScanResult.UPTODATE
  }

  /**
   * Emit author book count updates, then remove empty authors/series left after the scan
   */
  async finalizeAuthorsAndSeriesFromScan(libraryId: string, scanLogger: ScanLogger | LibraryScan) {
    await BookScanner.emitAuthorsNumBooksUpdated(libraryId, scanLogger)
    if (scanLogger.authorsRemovedFromBooks.length) {
      await BookScanner.checkAuthorsRemovedFromBooks(libraryId, scanLogger)
    }
    if (scanLogger.seriesRemovedFromBooks.length) {
      await BookScanner.checkSeriesRemovedFromBooks(libraryId, scanLogger)
    }
  }

  async getLibraryItemScanData(libraryItemPath: string, library: Library, folder: LibraryFolder, isSingleMediaItem: boolean) {
    const libraryFolderPath = fileUtils.filePathToPOSIX(folder.path!)
    const libraryItemDir = libraryItemPath.replace(libraryFolderPath, '').slice(1)

    let libraryItemData: ReturnType<typeof scanUtils.getDataFromMediaDir>

    let fileItems: Pick<Awaited<ReturnType<typeof fileUtils.recurseFiles>>[number], 'fullpath' | 'path'>[]

    if (isSingleMediaItem) {
      // Single media item in root of folder
      fileItems = [
        {
          fullpath: libraryItemPath,
          path: libraryItemDir // actually the relPath (only filename here)
        }
      ]
      libraryItemData = {
        path: libraryItemPath, // full path
        relPath: libraryItemDir, // only filename
        mediaMetadata: {
          title: Path.basename(libraryItemDir, Path.extname(libraryItemDir))
        }
      }
    } else {
      fileItems = await fileUtils.recurseFiles(libraryItemPath)
      libraryItemData = scanUtils.getDataFromMediaDir(library.mediaType!, libraryFolderPath, libraryItemDir)
    }

    const libraryFiles: ScannedLibraryFile[] = []
    for (let i = 0; i < fileItems.length; i++) {
      const fileItem = fileItems[i]

      if (Watcher.checkShouldIgnoreFilePath(fileItem.fullpath)) {
        // Skip file if it's pending
        Logger.info(`[LibraryItemScanner] Skipping watcher pending file "${fileItem.fullpath}" during scan of library item path "${libraryItemPath}"`)
        continue
      }

      const newLibraryFile = new LibraryFile()
      // fileItem.path is the relative path
      await newLibraryFile.setDataFromPath(fileItem.fullpath, fileItem.path)
      // setDataFromPath always fills the path fields, even if the stat fails.
      libraryFiles.push(newLibraryFile as ScannedLibraryFile)
    }

    const libraryItemStats = await fileUtils.getFileTimestampsWithIno(libraryItemData.path)
    return new LibraryItemScanData({
      libraryFolderId: folder.id,
      libraryId: library.id,
      mediaType: library.mediaType,
      ino: libraryItemStats ? libraryItemStats.ino : undefined,
      mtimeMs: (libraryItemStats && libraryItemStats.mtimeMs) || 0,
      ctimeMs: (libraryItemStats && libraryItemStats.ctimeMs) || 0,
      birthtimeMs: (libraryItemStats && libraryItemStats.birthtimeMs) || 0,
      path: libraryItemData.path,
      relPath: libraryItemData.relPath,
      isFile: isSingleMediaItem,
      mediaMetadata: libraryItemData.mediaMetadata,
      libraryFiles
    })
  }

  rescanLibraryItemMedia(existingLibraryItem: LibraryItem, libraryItemData: LibraryItemScanData, librarySettings: Library.LibrarySettingsObject, libraryScan: ScanLogger | LibraryScan) {
    if (existingLibraryItem.mediaType === 'book') {
      return BookScanner.rescanExistingBookLibraryItem(existingLibraryItem, libraryItemData, librarySettings, libraryScan)
    } else {
      return PodcastScanner.rescanExistingPodcastLibraryItem(existingLibraryItem, libraryItemData, librarySettings, libraryScan)
    }
  }

  async scanNewLibraryItem(libraryItemData: LibraryItemScanData, librarySettings: Library.LibrarySettingsObject, libraryScan: ScanLogger | LibraryScan) {
    let newLibraryItem = null
    if (libraryItemData.mediaType === 'book') {
      newLibraryItem = await BookScanner.scanNewBookLibraryItem(libraryItemData, librarySettings, libraryScan)
    } else {
      newLibraryItem = await PodcastScanner.scanNewPodcastLibraryItem(libraryItemData, librarySettings, libraryScan)
    }
    if (newLibraryItem) {
      libraryScan.addLog(LogLevel.INFO, `Created new library item "${newLibraryItem.relPath}" with id "${newLibraryItem.id}"`)
    }
    return newLibraryItem
  }

  /**
   * Scan library item folder coming from Watcher
   */
  async scanPotentialNewLibraryItem(libraryItemPath: string, library: Library, folder: LibraryFolder, isSingleMediaItem: boolean) {
    const libraryItemScanData = await this.getLibraryItemScanData(libraryItemPath, library, folder, isSingleMediaItem)

    if (!libraryItemScanData.libraryFiles.length) {
      Logger.info(`[LibraryItemScanner] Library item at path "${libraryItemPath}" has no files - ignoring`)
      return null
    }

    const scanLogger = new ScanLogger()
    scanLogger.verbose = true
    scanLogger.setData('libraryItem', libraryItemScanData.relPath)

    const newLibraryItem = await this.scanNewLibraryItem(libraryItemScanData, library.settings!, scanLogger)
    // Watcher path does not go through full-library scan cleanup — emit author book count updates here
    await BookScanner.emitAuthorsNumBooksUpdated(library.id, scanLogger)
    return newLibraryItem
  }
}
export = new LibraryItemScanner()
