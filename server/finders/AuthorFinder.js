const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const Path = require('path')
const Audnexus = require('../providers/Audnexus')
const CoverManager = require('../managers/CoverManager')

const globals = require('../utils/globals')
const { downloadImageFile } = require('../utils/fileUtils')

class AuthorFinder {
  constructor() {
    this.audnexus = new Audnexus()
  }

  findAuthorByASIN(asin, region) {
    if (!asin) return null
    return this.audnexus.findAuthorByASIN(asin, region)
  }

  /**
   * 
   * @param {string} name 
   * @param {string} region 
   * @param {Object} [options={}] 
   * @returns {Promise<import('../providers/Audnexus').AuthorSearchObj>}
   */
  async findAuthorByName(name, region, options = {}) {
    if (!name) return null
    const maxLevenshtein = !isNaN(options.maxLevenshtein) ? Number(options.maxLevenshtein) : 3

    const author = await this.audnexus.findAuthorByName(name, region, maxLevenshtein)
    if (!author?.name) {
      return null
    }
    return author
  }

  /**
   * Download author image from url and save in authors folder
   *
   * @param {string} authorId
   * @param {string} url
   * @param {string} [existingImagePath]
   * @returns {Promise<{path:string}|{error:string}>}
   */
  async saveAuthorImage(authorId, url, existingImagePath = null) {
    const authorDir = Path.join(global.MetadataPath, 'authors')

    if (!await fs.pathExists(authorDir)) {
      await fs.ensureDir(authorDir)
    }

    const imageExtension = url.toLowerCase().split('.').pop()
    const ext = imageExtension === 'png' ? 'png' : 'jpg'
    const filename = authorId + '.' + ext
    const outputPath = Path.posix.join(authorDir, filename)

    return downloadImageFile(url, outputPath).then(async () => {
      if (existingImagePath && existingImagePath !== outputPath) {
        await CoverManager.removeFile(existingImagePath)
      }
      return {
        path: outputPath
      }
    }).catch((err) => {
      let errorMsg = err.message || 'Unknown error'
      Logger.error(`[AuthorFinder] Download image file failed for "${url}"`, errorMsg)
      return {
        error: errorMsg
      }
    })
  }

  /**
   * Upload author image file and save in authors folder
   *
   * @param {string} authorId
   * @param {*} imageFile - file object from req.files
   * @param {string} [existingImagePath]
   * @returns {Promise<{path:string}|{error:string}>}
   */
  async uploadAuthorImage(authorId, imageFile, existingImagePath = null) {
    const extname = Path.extname(imageFile.name.toLowerCase())
    if (!extname || !globals.SupportedImageTypes.includes(extname.slice(1))) {
      return {
        error: `Invalid image type ${extname} (Supported: ${globals.SupportedImageTypes.join(',')})`
      }
    }

    const authorDir = Path.join(global.MetadataPath, 'authors')
    await fs.ensureDir(authorDir)

    const outputPath = Path.posix.join(authorDir, `${authorId}${extname}`)

    const success = await imageFile
      .mv(outputPath)
      .then(() => true)
      .catch((error) => {
        Logger.error('[AuthorFinder] Failed to move author image file', outputPath, error)
        return false
      })

    if (!success) {
      return {
        error: 'Failed to move image into destination'
      }
    }

    if (existingImagePath && existingImagePath !== outputPath) {
      await CoverManager.removeFile(existingImagePath)
    }

    Logger.info(`[AuthorFinder] Uploaded author image "${outputPath}"`)

    return {
      path: outputPath
    }
  }
}
module.exports = new AuthorFinder()