const Path = require('path')
const packageJson = require('../../package.json')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const fs = require('../libs/fsExtra')
const fileUtils = require('../utils/fileUtils')
const scanUtils = require('../utils/scandir')
const { ScanResult, LogLevel } = require('../utils/constants')
const globals = require('../utils/globals')
const AudioFileScanner = require('./AudioFileScanner')
const ScanOptions = require('./ScanOptions')
const LibraryScan = require('./LibraryScan')
const LibraryItemScanData = require('./LibraryItemScanData')
const AudioFile = require('../objects/files/AudioFile')
const Book = require('../models/Book')

class LibraryScanner {
  constructor(coverManager, taskManager) {
    this.coverManager = coverManager
    this.taskManager = taskManager

    this.cancelLibraryScan = {}
    this.librariesScanning = []
  }

  /**
   * @param {string} libraryId 
   * @returns {boolean}
   */
  isLibraryScanning(libraryId) {
    return this.librariesScanning.some(ls => ls.id === libraryId)
  }

  /**
   * 
   * @param {import('../objects/Library')} library 
   * @param {*} options 
   */
  async scan(library, options = {}) {
    if (this.isLibraryScanning(library.id)) {
      Logger.error(`[Scanner] Already scanning ${library.id}`)
      return
    }

    if (!library.folders.length) {
      Logger.warn(`[Scanner] Library has no folders to scan "${library.name}"`)
      return
    }

    const scanOptions = new ScanOptions()
    scanOptions.setData(options, Database.serverSettings)

    const libraryScan = new LibraryScan()
    libraryScan.setData(library, scanOptions)
    libraryScan.verbose = true
    this.librariesScanning.push(libraryScan.getScanEmitData)

    SocketAuthority.emitter('scan_start', libraryScan.getScanEmitData)

    Logger.info(`[Scanner] Starting library scan ${libraryScan.id} for ${libraryScan.libraryName}`)

    const canceled = await this.scanLibrary(libraryScan)

    if (canceled) {
      Logger.info(`[Scanner] Library scan canceled for "${libraryScan.libraryName}"`)
      delete this.cancelLibraryScan[libraryScan.libraryId]
    }

    libraryScan.setComplete()

    Logger.info(`[Scanner] Library scan ${libraryScan.id} completed in ${libraryScan.elapsedTimestamp} | ${libraryScan.resultStats}`)
    this.librariesScanning = this.librariesScanning.filter(ls => ls.id !== library.id)

    if (canceled && !libraryScan.totalResults) {
      const emitData = libraryScan.getScanEmitData
      emitData.results = null
      SocketAuthority.emitter('scan_complete', emitData)
      return
    }

    SocketAuthority.emitter('scan_complete', libraryScan.getScanEmitData)

    if (libraryScan.totalResults) {
      libraryScan.saveLog()
    }
  }

  /**
   * 
   * @param {import('./LibraryScan')} libraryScan 
   */
  async scanLibrary(libraryScan) {
    /** @type {LibraryItemScanData[]} */
    let libraryItemDataFound = []

    // Scan each library folder
    for (let i = 0; i < libraryScan.folders.length; i++) {
      const folder = libraryScan.folders[i]
      const itemDataFoundInFolder = await this.scanFolder(libraryScan.library, folder)
      libraryScan.addLog(LogLevel.INFO, `${itemDataFoundInFolder.length} item data found in folder "${folder.fullPath}"`)
      libraryItemDataFound = libraryItemDataFound.concat(itemDataFoundInFolder)
    }

    if (this.cancelLibraryScan[libraryScan.libraryId]) return true

    const existingLibraryItems = await Database.libraryItemModel.findAll({
      where: {
        libraryId: libraryScan.libraryId
      },
      attributes: ['id', 'mediaId', 'mediaType', 'path', 'relPath', 'ino', 'isMissing', 'isFile', 'mtime', 'ctime', 'birthtime', 'libraryFiles', 'libraryFolderId', 'size']
    })

    const libraryItemIdsMissing = []
    for (const existingLibraryItem of existingLibraryItems) {
      // First try to find matching library item with exact file path
      let libraryItemData = libraryItemDataFound.find(lid => lid.path === existingLibraryItem.path)
      if (!libraryItemData) {
        // Fallback to finding matching library item with matching inode value
        libraryItemData = libraryItemDataFound.find(lid => lid.ino === existingLibraryItem.ino)
        if (libraryItemData) {
          libraryScan.addLog(LogLevel.INFO, `Library item with path "${existingLibraryItem.path}" was not found, but library item inode "${existingLibraryItem.ino}" was found at path "${libraryItemData.path}"`)
        }
      }

      if (!libraryItemData) {
        // Podcast folder can have no episodes and still be valid
        if (libraryScan.libraryMediaType === 'podcast' && await fs.pathExists(existingLibraryItem.path)) {
          libraryScan.addLog(LogLevel.INFO, `Library item "${existingLibraryItem.relPath}" folder exists but has no episodes`)
        } else {
          libraryScan.addLog(LogLevel.WARN, `Library Item "${existingLibraryItem.path}" (inode: ${existingLibraryItem.ino}) is missing`)
          libraryScan.resultsMissing++
          if (!existingLibraryItem.isMissing) {
            libraryItemIdsMissing.push(existingLibraryItem.id)
          }
        }
      } else {
        libraryItemDataFound = libraryItemDataFound.filter(lidf => lidf !== libraryItemData)
        await libraryItemData.checkLibraryItemData(existingLibraryItem, libraryScan)
        if (libraryItemData.hasLibraryFileChanges || libraryItemData.hasPathChange) {
          await this.rescanLibraryItem(existingLibraryItem, libraryItemData, libraryScan)
        }
      }
    }

    // Update missing library items
    if (libraryItemIdsMissing.length) {
      libraryScan.addLog(LogLevel.INFO, `Updating ${libraryItemIdsMissing.length} library items missing`)
      await Database.libraryItemModel.update({
        isMissing: true,
        lastScan: Date.now(),
        lastScanVersion: packageJson.version
      }, {
        where: {
          id: libraryItemIdsMissing
        }
      })
    }

    // Add new library items
    if (libraryItemDataFound.length) {

    }
  }

  /**
   * Get scan data for library folder
   * @param {import('../objects/Library')} library 
   * @param {import('../objects/Folder')} folder 
   * @returns {LibraryItemScanData[]}
   */
  async scanFolder(library, folder) {
    const folderPath = fileUtils.filePathToPOSIX(folder.fullPath)

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

      items.push(new LibraryItemScanData({
        libraryFolderId: folder.id,
        libraryId: folder.libraryId,
        ino: libraryItemFolderStats.ino,
        mtimeMs: libraryItemFolderStats.mtimeMs || 0,
        ctimeMs: libraryItemFolderStats.ctimeMs || 0,
        birthtimeMs: libraryItemFolderStats.birthtimeMs || 0,
        path: libraryItemData.path,
        relPath: libraryItemData.relPath,
        isFile,
        mediaMetadata: libraryItemData.mediaMetadata || null,
        libraryFiles: fileObjs
      }))
    }
    return items
  }

  /**
   * 
   * @param {import('../models/LibraryItem')} existingLibraryItem 
   * @param {LibraryItemScanData} libraryItemData 
   * @param {LibraryScan} libraryScan
   */
  async rescanLibraryItem(existingLibraryItem, libraryItemData, libraryScan) {
    if (existingLibraryItem.mediaType === 'book') {
      /** @type {Book} */
      const media = await existingLibraryItem.getMedia({
        include: [
          {
            model: Database.authorModel,
            through: {
              attributes: ['createdAt']
            }
          },
          {
            model: Database.seriesModel,
            through: {
              attributes: ['sequence', 'createdAt']
            }
          }
        ]
      })

      let hasMediaChanges = libraryItemData.hasAudioFileChanges
      if (libraryItemData.hasAudioFileChanges || libraryItemData.audioLibraryFiles.length !== media.audioFiles.length) {
        // Filter out audio files that were removed
        media.audioFiles = media.audioFiles.filter(af => libraryItemData.checkAudioFileRemoved(af))

        // Update audio files that were modified
        if (libraryItemData.audioLibraryFilesModified.length) {
          let scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(existingLibraryItem.mediaType, libraryItemData, libraryItemData.audioLibraryFilesModified)
          media.audioFiles = media.audioFiles.map((audioFileObj) => {
            let matchedScannedAudioFile = scannedAudioFiles.find(saf => saf.metadata.path === audioFileObj.metadata.path)
            if (!matchedScannedAudioFile) {
              matchedScannedAudioFile = scannedAudioFiles.find(saf => saf.ino === audioFileObj.ino)
            }

            if (matchedScannedAudioFile) {
              scannedAudioFiles = scannedAudioFiles.filter(saf => saf !== matchedScannedAudioFile)
              const audioFile = new AudioFile(audioFileObj)
              audioFile.updateFromScan(matchedScannedAudioFile)
              return audioFile.toJSON()
            }
            return audioFileObj
          })
          // Modified audio files that were not found on the book
          if (scannedAudioFiles.length) {
            media.audioFiles.push(...scannedAudioFiles)
          }
        }

        // Add new audio files scanned in
        if (libraryItemData.audioLibraryFilesAdded.length) {
          const scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(existingLibraryItem.mediaType, libraryItemData, libraryItemData.audioLibraryFilesAdded)
          media.audioFiles.push(...scannedAudioFiles)
        }

        // Add audio library files that are not already set on the book (safety check)
        let audioLibraryFilesToAdd = []
        for (const audioLibraryFile of libraryItemData.audioLibraryFiles) {
          if (!media.audioFiles.some(af => af.ino === audioLibraryFile.ino)) {
            libraryScan.addLog(LogLevel.DEBUG, `Existing audio library file "${audioLibraryFile.metadata.relPath}" was not set on book "${media.title}" so setting it now`)
            audioLibraryFilesToAdd.push(audioLibraryFile)
          }
        }
        if (audioLibraryFilesToAdd.length) {
          const scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(existingLibraryItem.mediaType, libraryItemData, audioLibraryFilesToAdd)
          media.audioFiles.push(...scannedAudioFiles)
        }

        media.audioFiles = AudioFileScanner.runSmartTrackOrder(media, media.audioFiles)

        media.duration = 0
        media.audioFiles.forEach((af) => {
          if (!isNaN(af.duration)) {
            media.duration += af.duration
          }
        })

        media.changed('audioFiles', true)
      }

      // Check if cover was removed
      if (media.coverPath && !libraryItemData.imageLibraryFiles.some(lf => lf.metadata.path === media.coverPath)) {
        media.coverPath = null
        hasMediaChanges = true
      }

      // Check if cover is not set and image files were found
      if (!media.coverPath && libraryItemData.imageLibraryFiles.length) {
        // Prefer using a cover image with the name "cover" otherwise use the first image
        const coverMatch = libraryItemData.imageLibraryFiles.find(iFile => /\/cover\.[^.\/]*$/.test(iFile.metadata.path))
        media.coverPath = coverMatch?.metadata.path || libraryItemData.imageLibraryFiles[0].metadata.path
        hasMediaChanges = true
      }

      // Check if ebook was removed
      if (media.ebookFile && (libraryScan.library.settings.audiobooksOnly || libraryItemData.checkEbookFileRemoved(media.ebookFile))) {
        media.ebookFile = null
        hasMediaChanges = true
      }

      // Check if ebook is not set and ebooks were found
      if (!media.ebookFile && !libraryScan.library.settings.audiobooksOnly && libraryItemData.ebookLibraryFiles.length) {
        // Prefer to use an epub ebook then fallback to the first ebook found
        let ebookLibraryFile = libraryItemData.ebookLibraryFiles.find(lf => lf.metadata.ext.slice(1).toLowerCase() === 'epub')
        if (!ebookLibraryFile) ebookLibraryFile = libraryItemData.ebookLibraryFiles[0]
        // Ebook file is the same as library file except for additional `ebookFormat`
        ebookLibraryFile.ebookFormat = ebookLibraryFile.metadata.ext.slice(1).toLowerCase()
        media.ebookFile = ebookLibraryFile
        media.changed('ebookFile', true)
        hasMediaChanges = true
      }

      // Check/update the isSupplementary flag on libraryFiles for the LibraryItem
      let libraryItemUpdated = false
      for (const libraryFile of existingLibraryItem.libraryFiles) {
        if (globals.SupportedEbookTypes.includes(libraryFile.metadata.ext.slice(1).toLowerCase())) {
          if (media.ebookFile && libraryFile.ino === media.ebookFile.ino) {
            if (libraryFile.isSupplementary !== false) {
              libraryFile.isSupplementary = false
              libraryItemUpdated = true
            }
          } else if (libraryFile.isSupplementary !== true) {
            libraryFile.isSupplementary = true
            libraryItemUpdated = true
          }
        }
      }
      if (libraryItemUpdated) {
        existingLibraryItem.changed('libraryFiles', true)
        await existingLibraryItem.save()
      }

      // TODO: Update chapters & metadata

      if (hasMediaChanges) {
        await media.save()
      }
    }
  }

  /**
   * 
   * @param {LibraryItemScanData} libraryItemData 
   * @param {LibraryScan} libraryScan
   */
  async scanNewLibraryItem(libraryItemData, libraryScan) {

    if (libraryScan.libraryMediaType === 'book') {
      let scannedAudioFiles = await AudioFileScanner.executeMediaFileScans(libraryScan.libraryMediaType, libraryItemData, libraryItemData.audioLibraryFiles)
      // TODO: Create new book
    }
  }
}
module.exports = LibraryScanner