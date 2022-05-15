const Path = require('path')
const fs = require('fs-extra')
const stream = require('stream')
const filePerms = require('../utils/filePerms')
const Logger = require('../Logger')
const { resizeImage } = require('../utils/ffmpegHelpers')

class CacheManager {
  constructor() {
    this.CachePath = Path.join(global.MetadataPath, 'cache')
    this.CoverCachePath = Path.join(this.CachePath, 'covers')
    this.ImageCachePath = Path.join(this.CachePath, 'images')

    this.cachePathsExist = false
  }

  async ensureCachePaths() { // Creates cache paths if necessary and sets owner and permissions
    if (this.cachePathsExist) return

    var pathsCreated = false
    if (!(await fs.pathExists(this.CachePath))) {
      await fs.mkdir(this.CachePath)
      pathsCreated = true
    }

    if (!(await fs.pathExists(this.CoverCachePath))) {
      await fs.mkdir(this.CoverCachePath)
      pathsCreated = true
    }

    if (!(await fs.pathExists(this.ImageCachePath))) {
      await fs.mkdir(this.ImageCachePath)
      pathsCreated = true
    }

    if (pathsCreated) {
      await filePerms.setDefault(this.CachePath)
    }

    this.cachePathsExist = true
  }

  async handleCoverCache(res, libraryItem, options = {}) {
    const format = options.format || 'webp'
    const width = options.width || 400
    const height = options.height || null

    res.type(`image/${format}`)

    var path = Path.join(this.CoverCachePath, `${libraryItem.id}_${width}${height ? `x${height}` : ''}`) + '.' + format

    // Cache exists
    if (await fs.pathExists(path)) {
      const r = fs.createReadStream(path)
      const ps = new stream.PassThrough()
      stream.pipeline(r, ps, (err) => {
        if (err) {
          console.log(err)
          return res.sendStatus(400)
        }
      })
      return ps.pipe(res)
    }

    if (!libraryItem.media.coverPath || !await fs.pathExists(libraryItem.media.coverPath)) {
      return res.sendStatus(404)
    }

    let writtenFile = await resizeImage(libraryItem.media.coverPath, path, width, height)
    if (!writtenFile) return res.sendStatus(400)

    // Set owner and permissions of cache image
    await filePerms.setDefault(path)

    var readStream = fs.createReadStream(writtenFile)
    readStream.pipe(res)
  }

  purgeCoverCache(libraryItemId) {
    return this.purgeEntityCache(libraryItemId, this.CoverCachePath)
  }

  purgeImageCache(entityId) {
    return this.purgeEntityCache(entityId, this.ImageCachePath)
  }

  async purgeEntityCache(entityId, cachePath) {
    return Promise.all((await fs.readdir(cachePath)).reduce((promises, file) => {
      if (file.startsWith(entityId)) {
        Logger.debug(`[CacheManager] Going to purge ${file}`);
        promises.push(this.removeCache(Path.join(cachePath, file)))
      }
      return promises
    }, []))
  }

  removeCache(path) {
    if (!path) return false
    return fs.pathExists(path).then((exists) => {
      if (!exists) return false
      return fs.unlink(path).then(() => true).catch((err) => {
        Logger.error(`[CacheManager] Failed to remove cache "${path}"`, err)
        return false
      })
    })
  }

  async purgeAll() {
    if (await fs.pathExists(this.CachePath)) {
      await fs.remove(this.CachePath).catch((error) => {
        Logger.error(`[CacheManager] Failed to remove cache dir "${this.CachePath}"`, error)
      })
    }
    await this.ensureCachePaths()
  }

  async handleAuthorCache(res, author, options = {}) {
    const format = options.format || 'webp'
    const width = options.width || 400
    const height = options.height || null

    res.type(`image/${format}`)

    var path = Path.join(this.ImageCachePath, `${author.id}_${width}${height ? `x${height}` : ''}`) + '.' + format

    // Cache exists
    if (await fs.pathExists(path)) {
      const r = fs.createReadStream(path)
      const ps = new stream.PassThrough()
      stream.pipeline(r, ps, (err) => {
        if (err) {
          console.log(err)
          return res.sendStatus(400)
        }
      })
      return ps.pipe(res)
    }

    let writtenFile = await resizeImage(author.imagePath, path, width, height)
    if (!writtenFile) return res.sendStatus(400)

    // Set owner and permissions of cache image
    await filePerms.setDefault(path)

    var readStream = fs.createReadStream(writtenFile)
    readStream.pipe(res)
  }
}
module.exports = CacheManager