const Path = require('path')
const fs = require('fs-extra')
const stream = require('stream')
const Logger = require('./Logger')
const { resizeImage } = require('./utils/ffmpegHelpers')

class CacheManager {
  constructor() {
    this.CachePath = Path.join(global.MetadataPath, 'cache')
    this.CoverCachePath = Path.join(this.CachePath, 'covers')
    this.ImageCachePath = Path.join(this.CachePath, 'images')
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

    // Write cache
    await fs.ensureDir(this.CoverCachePath)

    let writtenFile = await resizeImage(libraryItem.media.coverPath, path, width, height)
    if (!writtenFile) return res.sendStatus(400)

    var readStream = fs.createReadStream(writtenFile)
    readStream.pipe(res)
  }

  async purgeCoverCache(libraryItemId) {
    // If purgeAll has been called... The cover cache directory no longer exists
    await fs.ensureDir(this.CoverCachePath)
    return Promise.all((await fs.readdir(this.CoverCachePath)).reduce((promises, file) => {
      if (file.startsWith(libraryItemId)) {
        Logger.debug(`[CacheManager] Going to purge ${file}`);
        promises.push(this.removeCache(Path.join(this.CoverCachePath, file)))
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

    // Write cache
    await fs.ensureDir(this.ImageCachePath)

    let writtenFile = await resizeImage(author.imagePath, path, width, height)
    if (!writtenFile) return res.sendStatus(400)

    var readStream = fs.createReadStream(writtenFile)
    readStream.pipe(res)
  }
}
module.exports = CacheManager