const fs = require('fs-extra')
const Path = require('path')
const axios = require('axios')
const Logger = require('./Logger')
const readChunk = require('read-chunk')
const imageType = require('image-type')

const globals = require('./utils/globals')
const { downloadFile } = require('./utils/fileUtils')

class CoverController {
  constructor(db, cacheManager, MetadataPath, AudiobookPath) {
    this.db = db
    this.cacheManager = cacheManager

    this.MetadataPath = MetadataPath.replace(/\\/g, '/')
    this.BookMetadataPath = Path.posix.join(this.MetadataPath, 'books')
    this.AudiobookPath = AudiobookPath
  }

  getCoverDirectory(audiobook) {
    if (this.db.serverSettings.storeCoverWithBook) {
      return {
        fullPath: audiobook.fullPath,
        relPath: '/s/book/' + audiobook.id
      }
    } else {
      return {
        fullPath: Path.posix.join(this.BookMetadataPath, audiobook.id),
        relPath: Path.posix.join('/metadata', 'books', audiobook.id)
      }
    }
  }

  getFilesInDirectory(dir) {
    try {
      return fs.readdir(dir)
    } catch (error) {
      Logger.error(`[CoverController] Failed to get files in dir ${dir}`, error)
      return []
    }
  }

  removeFile(filepath) {
    try {
      return fs.pathExists(filepath).then((exists) => {
        if (!exists) Logger.warn(`[CoverController] Attempting to remove file that does not exist ${filepath}`)
        return exists ? fs.unlink(filepath) : false
      })
    } catch (error) {
      Logger.error(`[CoverController] Failed to remove file "${filepath}"`, error)
      return false
    }
  }

  // Remove covers that dont have the same filename as the new cover
  async removeOldCovers(dirpath, newCoverExt) {
    var filesInDir = await this.getFilesInDirectory(dirpath)

    for (let i = 0; i < filesInDir.length; i++) {
      var file = filesInDir[i]
      var _extname = Path.extname(file)
      var _filename = Path.basename(file, _extname)
      if (_filename === 'cover' && _extname !== newCoverExt) {
        var filepath = Path.join(dirpath, file)
        Logger.debug(`[CoverController] Removing old cover from metadata "${filepath}"`)
        await this.removeFile(filepath)
      }
    }
  }

  async checkFileIsValidImage(imagepath) {
    const buffer = await readChunk(imagepath, 0, 12)
    const imgType = imageType(buffer)
    if (!imgType) {
      await this.removeFile(imagepath)
      return {
        error: 'Invalid image'
      }
    }

    if (!globals.SupportedImageTypes.includes(imgType.ext)) {
      await this.removeFile(imagepath)
      return {
        error: `Invalid image type ${imgType.ext} (Supported: ${globals.SupportedImageTypes.join(',')})`
      }
    }
    return imgType
  }

  async uploadCover(audiobook, coverFile) {
    var extname = Path.extname(coverFile.name.toLowerCase())
    if (!extname || !globals.SupportedImageTypes.includes(extname.slice(1))) {
      return {
        error: `Invalid image type ${extname} (Supported: ${globals.SupportedImageTypes.join(',')})`
      }
    }

    var { fullPath, relPath } = this.getCoverDirectory(audiobook)
    await fs.ensureDir(fullPath)

    var coverFilename = `cover${extname}`
    var coverFullPath = Path.posix.join(fullPath, coverFilename)
    var coverPath = Path.posix.join(relPath, coverFilename)

    // Move cover from temp upload dir to destination
    var success = await coverFile.mv(coverFullPath).then(() => true).catch((error) => {
      Logger.error('[CoverController] Failed to move cover file', path, error)
      return false
    })

    if (!success) {
      return {
        error: 'Failed to move cover into destination'
      }
    }

    await this.removeOldCovers(fullPath, extname)
    await this.cacheManager.purgeCoverCache(audiobook.id)

    Logger.info(`[CoverController] Uploaded audiobook cover "${coverPath}" for "${audiobook.title}"`)

    audiobook.updateBookCover(coverPath, coverFullPath)
    return {
      cover: coverPath
    }
  }

  async downloadCoverFromUrl(audiobook, url) {
    try {
      var { fullPath, relPath } = this.getCoverDirectory(audiobook)
      await fs.ensureDir(fullPath)

      var temppath = Path.posix.join(fullPath, 'cover')
      var success = await downloadFile(url, temppath).then(() => true).catch((err) => {
        Logger.error(`[CoverController] Download image file failed for "${url}"`, err)
        return false
      })
      if (!success) {
        return {
          error: 'Failed to download image from url'
        }
      }

      var imgtype = await this.checkFileIsValidImage(temppath)

      if (imgtype.error) {
        return imgtype
      }

      var coverFilename = `cover.${imgtype.ext}`
      var coverPath = Path.posix.join(relPath, coverFilename)
      var coverFullPath = Path.posix.join(fullPath, coverFilename)
      await fs.rename(temppath, coverFullPath)

      await this.removeOldCovers(fullPath, '.' + imgtype.ext)
      await this.cacheManager.purgeCoverCache(audiobook.id)

      Logger.info(`[CoverController] Downloaded audiobook cover "${coverPath}" from url "${url}" for "${audiobook.title}"`)

      audiobook.updateBookCover(coverPath, coverFullPath)
      return {
        cover: coverPath
      }
    } catch (error) {
      Logger.error(`[CoverController] Fetch cover image from url "${url}" failed`, error)
      return {
        error: 'Failed to fetch image from url'
      }
    }
  }
}
module.exports = CoverController