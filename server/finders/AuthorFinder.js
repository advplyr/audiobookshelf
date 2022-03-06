const fs = require('fs-extra')
const Logger = require('../Logger')
const Path = require('path')
const Author = require('../objects/Author')
const Audnexus = require('../providers/Audnexus')

const { downloadFile } = require('../utils/fileUtils')

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

  async findAuthorByName(name, options = {}) {
    if (!name) return null
    const maxLevenshtein = !isNaN(options.maxLevenshtein) ? Number(options.maxLevenshtein) : 2

    var author = await this.audnexus.findAuthorByName(name, maxLevenshtein)
    if (!author || !author.name) {
      return null
    }
    return author
  }

  async createAuthor(payload) {
    if (!payload || !payload.name) return null

    var authorDir = Path.posix.join(this.AuthorPath, payload.name)
    var relAuthorDir = Path.posix.join('/metadata', 'authors', payload.name)

    if (payload.image && payload.image.startsWith('http')) {
      await fs.ensureDir(authorDir)

      var imageExtension = payload.image.toLowerCase().split('.').pop()
      var ext = imageExtension === 'png' ? 'png' : 'jpg'
      var filename = 'photo.' + ext
      var outputPath = Path.posix.join(authorDir, filename)
      var relPath = Path.posix.join(relAuthorDir, filename)

      var success = await this.downloadImage(payload.image, outputPath)
      if (!success) {
        await fs.rmdir(authorDir).catch((error) => {
          Logger.error(`[AuthorFinder] Failed to remove author dir`, authorDir, error)
        })
        payload.image = null
        payload.imageFullPath = null
      } else {
        payload.image = relPath
        payload.imageFullPath = outputPath
      }
    } else {
      payload.image = null
      payload.imageFullPath = null
    }

    var author = new Author()
    author.setData(payload)

    return author
  }

  async getAuthorByName(name, options = {}) {
    var authorData = await this.findAuthorByName(name, options)
    if (!authorData) return null

    var authorDir = Path.posix.join(this.AuthorPath, authorData.name)
    var relAuthorDir = Path.posix.join('/metadata', 'authors', authorData.name)

    if (authorData.image) {
      await fs.ensureDir(authorDir)

      var imageExtension = authorData.image.toLowerCase().split('.').pop()
      var ext = imageExtension === 'png' ? 'png' : 'jpg'
      var filename = 'photo.' + ext
      var outputPath = Path.posix.join(authorDir, filename)
      var relPath = Path.posix.join(relAuthorDir, filename)

      var success = await this.downloadImage(authorData.image, outputPath)
      if (!success) {
        await fs.rmdir(authorDir).catch((error) => {
          Logger.error(`[AuthorFinder] Failed to remove author dir`, authorDir, error)
        })
        authorData.image = null
        authorData.imageFullPath = null
      } else {
        authorData.image = relPath
        authorData.imageFullPath = outputPath
      }
    } else {
      authorData.image = null
      authorData.imageFullPath = null
    }

    var author = new Author()
    author.setData(authorData)

    return author
  }
}
module.exports = AuthorFinder