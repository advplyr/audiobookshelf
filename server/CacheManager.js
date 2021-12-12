const Path = require('path')
const fs = require('fs-extra')
const stream = require('stream')
const resize = require('./utils/resizeImage')
const Logger = require('./Logger')

class CacheManager {
  constructor(MetadataPath) {
    this.MetadataPath = MetadataPath
    this.CachePath = Path.join(this.MetadataPath, 'cache')
    this.CoverCachePath = Path.join(this.CachePath, 'covers')
  }

  async handleCoverCache(res, audiobook, options = {}) {
    const format = options.format || 'webp'
    const width = options.width || 400
    const height = options.height || null

    res.type(`image/${format}`)

    var path = Path.join(this.CoverCachePath, audiobook.id) + '.' + format

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
    var readStream = resize(audiobook.book.coverFullPath, width, height, format)
    var writeStream = fs.createWriteStream(path)
    writeStream.on('error', (e) => {
      Logger.error(`[CacheManager] Cache write error ${e.message}`)
    })
    readStream.pipe(writeStream)

    readStream.pipe(res)
  }

  purgeCoverCache(audiobookId) {
    var basepath = Path.join(this.CoverCachePath, audiobookId)
    // Remove both webp and jpg caches if exist
    var webpPath = basepath + '.webp'
    var jpgPath = basepath + '.jpg'
    return Promise.all([this.removeCache(webpPath), this.removeCache(jpgPath)])
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
}
module.exports = CacheManager