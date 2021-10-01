const fs = require('fs-extra')
const Path = require('path')
const axios = require('axios')
const Logger = require('./Logger')
const readChunk = require('read-chunk')
const imageType = require('image-type')

const globals = require('./utils/globals')
const { CoverDestination } = require('./utils/constants')


class CoverController {
  constructor(db, MetadataPath, AudiobookPath) {
    this.db = db
    this.MetadataPath = MetadataPath
    this.BookMetadataPath = Path.join(this.MetadataPath, 'books')
    this.AudiobookPath = AudiobookPath
  }

  getCoverDirectory(audiobook) {
    if (this.db.serverSettings.coverDestination === CoverDestination.AUDIOBOOK) {
      return {
        fullPath: audiobook.fullPath,
        relPath: Path.join('/local', audiobook.path)
      }
    } else {
      return {
        fullPath: Path.join(this.BookMetadataPath, audiobook.id),
        relPath: Path.join('/metadata', 'books', audiobook.id)
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

  // Remove covers in metadata/books/{ID} that dont have the same filename as the new cover
  async checkBookMetadataCovers(dirpath, newCoverExt) {
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
    var isStoringInMetadata = relPath.slice(1).startsWith('metadata')

    var coverFilename = `cover${extname}`
    var coverFullPath = Path.join(fullPath, coverFilename)
    var coverPath = Path.join(relPath, coverFilename)


    if (isStoringInMetadata) {
      await this.checkBookMetadataCovers(fullPath, extname)
    }

    // Move cover from temp upload dir to destination
    var success = await coverFile.mv(coverFullPath).then(() => true).catch((error) => {
      Logger.error('[CoverController] Failed to move cover file', path, error)
      return false
    })

    if (!success) {
      // return res.status(500).send('Failed to move cover into destination')
      return {
        error: 'Failed to move cover into destination'
      }
    }

    Logger.info(`[CoverController] Uploaded audiobook cover "${coverPath}" for "${audiobook.title}"`)

    audiobook.updateBookCover(coverPath)
    return {
      cover: coverPath
    }
  }

  async downloadFile(url, filepath) {
    Logger.debug(`[CoverController] Starting file download to ${filepath}`)
    const writer = fs.createWriteStream(filepath)
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    })
    response.data.pipe(writer)
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
  }

  async downloadCoverFromUrl(audiobook, url) {
    try {
      var { fullPath, relPath } = this.getCoverDirectory(audiobook)
      await fs.ensureDir(fullPath)

      var temppath = Path.join(fullPath, 'cover')
      var success = await this.downloadFile(url, temppath).then(() => true).catch((err) => {
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
      var coverPath = Path.join(relPath, coverFilename)
      var coverFullPath = Path.join(fullPath, coverFilename)
      await fs.rename(temppath, coverFullPath)

      var isStoringInMetadata = relPath.slice(1).startsWith('metadata')
      if (isStoringInMetadata) {
        await this.checkBookMetadataCovers(fullPath, '.' + imgtype.ext)
      }

      Logger.info(`[CoverController] Downloaded audiobook cover "${coverPath}" from url "${url}" for "${audiobook.title}"`)

      audiobook.updateBookCover(coverPath)
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