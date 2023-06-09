const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const Path = require('path')
const Audnexus = require('../providers/Audnexus')

const { downloadFile } = require('../utils/fileUtils')
const filePerms = require('../utils/filePerms')

class AuthorFinder {
  constructor() {
    this.AuthorPath = Path.join(global.MetadataPath, 'authors')

    this.audnexus = new Audnexus()
  }

  async downloadImage(url, outputPath) {
    return downloadFile(url, outputPath).then(() => true).catch((error) => {
      Logger.error('[AuthorFinder] Failed to download author image', error)
      return null
    })
  }

  findAuthorByASIN(asin, region) {
    if (!asin) return null
    return this.audnexus.findAuthorByASIN(asin, region)
  }

  async findAuthorByName(name, region, options = {}) {
    if (!name) return null
    const maxLevenshtein = !isNaN(options.maxLevenshtein) ? Number(options.maxLevenshtein) : 3

    const author = await this.audnexus.findAuthorByName(name, region, maxLevenshtein)
    if (!author || !author.name) {
      return null
    }
    return author
  }

  async saveAuthorImage(authorId, url) {
    var authorDir = this.AuthorPath
    var relAuthorDir = Path.posix.join('/metadata', 'authors')

    if (!await fs.pathExists(authorDir)) {
      await fs.ensureDir(authorDir)
      await filePerms.setDefault(authorDir)
    }

    var imageExtension = url.toLowerCase().split('.').pop()
    var ext = imageExtension === 'png' ? 'png' : 'jpg'
    var filename = authorId + '.' + ext
    var outputPath = Path.posix.join(authorDir, filename)
    var relPath = Path.posix.join(relAuthorDir, filename)

    var success = await this.downloadImage(url, outputPath)
    if (!success) {
      return null
    }
    return {
      path: outputPath,
      relPath
    }
  }
}
module.exports = AuthorFinder