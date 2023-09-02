const fs = require('../libs/fsExtra')
const Path = require('path')
const Logger = require('../Logger')
const readChunk = require('../libs/readChunk')
const imageType = require('../libs/imageType')
const filePerms = require('../utils/filePerms')

const globals = require('../utils/globals')
const { downloadFile, filePathToPOSIX, checkPathIsFile } = require('../utils/fileUtils')
const { extractCoverArt } = require('../utils/ffmpegHelpers')

class CoverManager {
  constructor(cacheManager) {
    this.cacheManager = cacheManager

    this.ItemMetadataPath = Path.posix.join(global.MetadataPath, 'items')
  }

  getCoverDirectory(libraryItem) {
    if (global.ServerSettings.storeCoverWithItem && !libraryItem.isFile && !libraryItem.isMusic) {
      return libraryItem.path
    } else {
      return Path.posix.join(this.ItemMetadataPath, libraryItem.id)
    }
  }

  getFilesInDirectory(dir) {
    try {
      return fs.readdir(dir)
    } catch (error) {
      Logger.error(`[CoverManager] Failed to get files in dir ${dir}`, error)
      return []
    }
  }

  removeFile(filepath) {
    try {
      return fs.pathExists(filepath).then((exists) => {
        if (!exists) Logger.warn(`[CoverManager] Attempting to remove file that does not exist ${filepath}`)
        return exists ? fs.unlink(filepath) : false
      })
    } catch (error) {
      Logger.error(`[CoverManager] Failed to remove file "${filepath}"`, error)
      return false
    }
  }

  // Remove covers that dont have the same filename as the new cover
  async removeOldCovers(dirpath, newCoverExt) {
    var filesInDir = await this.getFilesInDirectory(dirpath)

    const imageExtensions = ['.jpeg', '.jpg', '.png', '.webp', '.jiff']
    for (let i = 0; i < filesInDir.length; i++) {
      var file = filesInDir[i]
      var _extname = Path.extname(file).toLowerCase()
      var _filename = Path.basename(file, _extname).toLowerCase()
      if (_filename === 'cover' && _extname !== newCoverExt && imageExtensions.includes(_extname)) {
        var filepath = Path.join(dirpath, file)
        Logger.debug(`[CoverManager] Removing old cover from metadata "${filepath}"`)
        await this.removeFile(filepath)
      }
    }
  }

  async checkFileIsValidImage(imagepath, removeOnInvalid = false) {
    const buffer = await readChunk(imagepath, 0, 12)
    const imgType = imageType(buffer)
    if (!imgType) {
      if (removeOnInvalid) await this.removeFile(imagepath)
      return {
        error: 'Invalid image'
      }
    }

    if (!globals.SupportedImageTypes.includes(imgType.ext)) {
      if (removeOnInvalid) await this.removeFile(imagepath)
      return {
        error: `Invalid image type ${imgType.ext} (Supported: ${globals.SupportedImageTypes.join(',')})`
      }
    }
    return imgType
  }

  async uploadCover(libraryItem, coverFile) {
    const extname = Path.extname(coverFile.name.toLowerCase())
    if (!extname || !globals.SupportedImageTypes.includes(extname.slice(1))) {
      return {
        error: `Invalid image type ${extname} (Supported: ${globals.SupportedImageTypes.join(',')})`
      }
    }

    const coverDirPath = this.getCoverDirectory(libraryItem)
    await fs.ensureDir(coverDirPath)

    const coverFullPath = Path.posix.join(coverDirPath, `cover${extname}`)

    // Move cover from temp upload dir to destination
    const success = await coverFile.mv(coverFullPath).then(() => true).catch((error) => {
      Logger.error('[CoverManager] Failed to move cover file', path, error)
      return false
    })

    if (!success) {
      return {
        error: 'Failed to move cover into destination'
      }
    }

    await this.removeOldCovers(coverDirPath, extname)
    await this.cacheManager.purgeCoverCache(libraryItem.id)

    Logger.info(`[CoverManager] Uploaded libraryItem cover "${coverFullPath}" for "${libraryItem.media.metadata.title}"`)

    await filePerms.setDefault(coverFullPath)
    libraryItem.updateMediaCover(coverFullPath)
    return {
      cover: coverFullPath
    }
  }

  async downloadCoverFromUrl(libraryItem, url, forceLibraryItemFolder = false) {
    try {
      // Force save cover with library item is used for adding new podcasts
      var coverDirPath = forceLibraryItemFolder ? libraryItem.path : this.getCoverDirectory(libraryItem)
      await fs.ensureDir(coverDirPath)

      var temppath = Path.posix.join(coverDirPath, 'cover')
      var success = await downloadFile(url, temppath).then(() => true).catch((err) => {
        Logger.error(`[CoverManager] Download image file failed for "${url}"`, err)
        return false
      })
      if (!success) {
        return {
          error: 'Failed to download image from url'
        }
      }

      var imgtype = await this.checkFileIsValidImage(temppath, true)

      if (imgtype.error) {
        return imgtype
      }

      var coverFilename = `cover.${imgtype.ext}`
      var coverFullPath = Path.posix.join(coverDirPath, coverFilename)
      await fs.rename(temppath, coverFullPath)

      await this.removeOldCovers(coverDirPath, '.' + imgtype.ext)
      await this.cacheManager.purgeCoverCache(libraryItem.id)

      Logger.info(`[CoverManager] Downloaded libraryItem cover "${coverFullPath}" from url "${url}" for "${libraryItem.media.metadata.title}"`)

      await filePerms.setDefault(coverFullPath)
      libraryItem.updateMediaCover(coverFullPath)
      return {
        cover: coverFullPath
      }
    } catch (error) {
      Logger.error(`[CoverManager] Fetch cover image from url "${url}" failed`, error)
      return {
        error: 'Failed to fetch image from url'
      }
    }
  }

  async validateCoverPath(coverPath, libraryItem) {
    // Invalid cover path
    if (!coverPath || coverPath.startsWith('http:') || coverPath.startsWith('https:')) {
      Logger.error(`[CoverManager] validate cover path invalid http url "${coverPath}"`)
      return {
        error: 'Invalid cover path'
      }
    }
    coverPath = filePathToPOSIX(coverPath)
    // Cover path already set on media
    if (libraryItem.media.coverPath == coverPath) {
      Logger.debug(`[CoverManager] validate cover path already set "${coverPath}"`)
      return {
        cover: coverPath,
        updated: false
      }
    }

    // Cover path does not exist
    if (!await fs.pathExists(coverPath)) {
      Logger.error(`[CoverManager] validate cover path does not exist "${coverPath}"`)
      return {
        error: 'Cover path does not exist'
      }
    }

    // Cover path is not a file
    if (!await checkPathIsFile(coverPath)) {
      Logger.error(`[CoverManager] validate cover path is not a file "${coverPath}"`)
      return {
        error: 'Cover path is not a file'
      }
    }

    // Check valid image at path
    var imgtype = await this.checkFileIsValidImage(coverPath, false)
    if (imgtype.error) {
      return imgtype
    }

    var coverDirPath = this.getCoverDirectory(libraryItem)

    // Cover path is not in correct directory - make a copy
    if (!coverPath.startsWith(coverDirPath)) {
      await fs.ensureDir(coverDirPath)

      var coverFilename = `cover.${imgtype.ext}`
      var newCoverPath = Path.posix.join(coverDirPath, coverFilename)
      Logger.debug(`[CoverManager] validate cover path copy cover from "${coverPath}" to "${newCoverPath}"`)

      var copySuccess = await fs.copy(coverPath, newCoverPath, { overwrite: true }).then(() => true).catch((error) => {
        Logger.error(`[CoverManager] validate cover path failed to copy cover`, error)
        return false
      })
      if (!copySuccess) {
        return {
          error: 'Failed to copy cover to dir'
        }
      }
      await filePerms.setDefault(newCoverPath)
      await this.removeOldCovers(coverDirPath, '.' + imgtype.ext)
      Logger.debug(`[CoverManager] cover copy success`)
      coverPath = newCoverPath
    }

    await this.cacheManager.purgeCoverCache(libraryItem.id)

    libraryItem.updateMediaCover(coverPath)
    return {
      cover: coverPath,
      updated: true
    }
  }

  async saveEmbeddedCoverArt(libraryItem) {
    let audioFileWithCover = null
    if (libraryItem.mediaType === 'book') {
      audioFileWithCover = libraryItem.media.audioFiles.find(af => af.embeddedCoverArt)
    } else if (libraryItem.mediaType == 'podcast') {
      const episodeWithCover = libraryItem.media.episodes.find(ep => ep.audioFile.embeddedCoverArt)
      if (episodeWithCover) audioFileWithCover = episodeWithCover.audioFile
    } else if (libraryItem.mediaType === 'music') {
      audioFileWithCover = libraryItem.media.audioFile
    }
    if (!audioFileWithCover) return false

    const coverDirPath = this.getCoverDirectory(libraryItem)
    await fs.ensureDir(coverDirPath)

    const coverFilename = audioFileWithCover.embeddedCoverArt === 'png' ? 'cover.png' : 'cover.jpg'
    const coverFilePath = Path.join(coverDirPath, coverFilename)

    const coverAlreadyExists = await fs.pathExists(coverFilePath)
    if (coverAlreadyExists) {
      Logger.warn(`[CoverManager] Extract embedded cover art but cover already exists for "${libraryItem.media.metadata.title}" - bail`)
      return false
    }

    const success = await extractCoverArt(audioFileWithCover.metadata.path, coverFilePath)
    if (success) {
      await filePerms.setDefault(coverFilePath)

      libraryItem.updateMediaCover(coverFilePath)
      return coverFilePath
    }
    return false
  }

  static async saveEmbeddedCoverArtNew(audioFiles, libraryItemId, libraryItemPath) {
    let audioFileWithCover = audioFiles.find(af => af.embeddedCoverArt)
    if (!audioFileWithCover) return null

    let coverDirPath = null
    if (global.ServerSettings.storeCoverWithItem && libraryItemPath) {
      coverDirPath = libraryItemPath
    } else {
      coverDirPath = Path.posix.join(global.MetadataPath, 'items', libraryItemId)
    }
    await fs.ensureDir(coverDirPath)

    const coverFilename = audioFileWithCover.embeddedCoverArt === 'png' ? 'cover.png' : 'cover.jpg'
    const coverFilePath = Path.join(coverDirPath, coverFilename)

    const coverAlreadyExists = await fs.pathExists(coverFilePath)
    if (coverAlreadyExists) {
      Logger.warn(`[CoverManager] Extract embedded cover art but cover already exists for "${libraryItemPath}" - bail`)
      return null
    }

    const success = await extractCoverArt(audioFileWithCover.metadata.path, coverFilePath)
    if (success) {
      return coverFilePath
    }
    return null
  }
}
module.exports = CoverManager