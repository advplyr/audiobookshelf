const Path = require('path')
const { createHash, randomUUID } = require('crypto')
const fs = require('../libs/fsExtra')
const prober = require('../utils/prober')
const Database = require('../Database')
const CoverManager = require('./CoverManager')
const CacheManager = require('./CacheManager')
const Logger = require('../Logger')
const { downloadFile, filePathToPOSIX } = require('../utils/fileUtils')
const { extractCoverArtCopy } = require('../utils/ffmpegHelpers')
const { isUUID } = require('../utils')
const { SupportedImageTypes } = require('../utils/globals')

const imageCodecs = { mjpeg: 'jpg', png: 'png', webp: 'webp' }
const maxImageBytes = 20 * 1024 * 1024
const maxImageDimension = 8192
const minExaminedEpisodes = 5
const showArtThreshold = 0.8

class EpisodeCoverManager {
  constructor() {
    this.itemLocks = new Map()
  }

  getImagesDir(libraryItemId) {
    return Path.join(global.MetadataPath, 'items', libraryItemId, 'images')
  }

  /**
   * Read the item ID from a managed episode image path.
   * @param {string} path
   * @returns {string|null}
   */
  getLibraryItemIdFromImagePath(path) {
    if (!path) {
      return null
    }

    const match = filePathToPOSIX(path).match(/\/items\/([^/]+)\/images\/[a-f0-9]{64}\.(jpg|png|webp)$/)
    if (!match || !isUUID(match[1])) {
      return null
    }

    return match[1]
  }

  /**
   * Check that an image belongs to the current metadata root and item.
   * @param {string} libraryItemId
   * @param {string} path
   * @returns {boolean}
   */
  isCurrentImagePath(libraryItemId, path) {
    if (!path || !libraryItemId) return false

    const belongsToItem = this.getLibraryItemIdFromImagePath(path) === libraryItemId
    const isInCurrentDirectory = Path.resolve(Path.dirname(path)) === Path.resolve(this.getImagesDir(libraryItemId))

    return belongsToItem && isInCurrentDirectory
  }

  // The lock is not re-entrant
  async withItemLock(libraryItemId, fn) {
    const previous = this.itemLocks.get(libraryItemId) || Promise.resolve()
    const pending = previous.catch(() => {}).then(fn)
    this.itemLocks.set(libraryItemId, pending)

    try {
      return await pending
    } finally {
      if (this.itemLocks.get(libraryItemId) === pending) {
        this.itemLocks.delete(libraryItemId)
      }
    }
  }

  async hashFile(path) {
    const hash = createHash('sha256')
    for await (const chunk of fs.createReadStream(path)) {
      hash.update(chunk)
    }

    return hash.digest('hex')
  }

  isImageCodec(codec) {
    return Object.hasOwn(imageCodecs, codec)
  }

  /**
   * Validate and store one image by its content hash.
   *
   * @param {string} libraryItemId
   * @param {string} sourcePath
   * @returns {Promise<{path: string}|{error: string, detail?: string}>}
   */
  async storeImageFromFile(libraryItemId, sourcePath) {
    const directory = this.getImagesDir(libraryItemId)
    await fs.ensureDir(directory)

    const temporaryPath = Path.join(directory, `.tmp-${randomUUID()}${Path.extname(sourcePath) || '.jpg'}`)
    try {
      await fs.copyFile(sourcePath, temporaryPath)
      if ((await fs.stat(temporaryPath)).size > maxImageBytes) {
        return { error: 'Image exceeds size limit' }
      }

      const type = await CoverManager.checkFileIsValidImage(temporaryPath)
      if (type.error || !SupportedImageTypes.includes(type.ext)) {
        return { error: 'Unsupported image type' }
      }

      const data = await prober.rawProbe(temporaryPath)
      if (data.error) throw new Error(String(data.error))
      const image = data.streams.find((stream) => stream.codec_type === 'video')
      if (!image?.width || !image?.height || image.width > maxImageDimension || image.height > maxImageDimension) {
        return { error: 'Invalid image dimensions' }
      }

      const sha = await this.hashFile(temporaryPath)
      const path = filePathToPOSIX(Path.join(directory, `${sha}.${type.ext === 'jpeg' ? 'jpg' : type.ext}`))
      if (!(await fs.pathExists(path))) {
        await fs.rename(temporaryPath, path)
      }

      return { path }
    } catch (error) {
      return { error: 'Invalid image', detail: error.message }
    } finally {
      await fs.remove(temporaryPath)
    }
  }

  /**
   * Download and validate an image within the size limit.
   *
   * @param {string} libraryItemId
   * @param {string} url
   * @returns {Promise<{path: string}|{error: string, detail?: string}>}
   */
  async storeImageFromUrl(libraryItemId, url) {
    await fs.ensureDir(this.getImagesDir(libraryItemId))
    const temporaryPath = Path.join(this.getImagesDir(libraryItemId), `.tmp-${randomUUID()}.jpg`)
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { error: 'Invalid image URL' }
      }

      await downloadFile(
        url,
        temporaryPath,
        (value) => {
          const type = value?.split(';')[0].trim().toLowerCase()
          return !type || type.startsWith('image/') || ['application/octet-stream', 'binary/octet-stream'].includes(type)
        },
        { maxBytes: maxImageBytes, retryUserAgent: true }
      )

      return await this.storeImageFromFile(libraryItemId, temporaryPath)
    } catch (error) {
      if (error.code === 'MAX_BYTES') {
        return { error: 'Image exceeds size limit', detail: error.message }
      }
      return { error: 'Image download failed', detail: error.message }
    } finally {
      await fs.remove(temporaryPath)
    }
  }

  /**
   * Copy the preferred attached picture without reencoding.
   *
   * @param {string} libraryItemId
   * @param {import('../models/Book').AudioFileObject} audioFile
   * @param {string} [podcastId]
   * @returns {Promise<{path: string|null}|{error: string, detail?: string}>}
   */
  async extractEmbeddedImage(libraryItemId, audioFile, podcastId) {
    if (!this.isImageCodec(audioFile?.embeddedCoverArt)) {
      return { path: null }
    }

    await fs.ensureDir(this.getImagesDir(libraryItemId))
    let temporaryPath
    try {
      const data = await prober.rawProbe(audioFile.metadata.path)
      if (data.error) throw new Error(String(data.error))
      const pictures = data.streams.filter((stream) => stream.disposition?.attached_pic && this.isImageCodec(stream.codec_name))
      const picture = pictures.find((stream) => stream.tags?.comment?.toLowerCase() === 'cover (front)') || pictures[0]
      if (!picture) {
        return { path: null }
      }

      temporaryPath = Path.join(this.getImagesDir(libraryItemId), `.tmp-${randomUUID()}.${imageCodecs[picture.codec_name]}`)
      if (!(await extractCoverArtCopy(audioFile.metadata.path, temporaryPath, picture.index))) {
        return { error: 'Embedded cover extraction failed' }
      }

      const embeddedSha = await this.hashFile(temporaryPath)
      if (podcastId) {
        const siblings = await Database.podcastEpisodeModel.findAll({
          where: { podcastId },
          attributes: ['extraData']
        })
        if (siblings.some((other) => other.extraData?.embeddedIsShowArt && other.extraData.embeddedSha === embeddedSha)) {
          return { path: null, embeddedSha, embeddedIsShowArt: true }
        }
      }

      return await this.storeImageFromFile(libraryItemId, temporaryPath)
    } catch (error) {
      return { error: 'Embedded cover extraction failed', detail: error.message }
    } finally {
      if (temporaryPath) await fs.remove(temporaryPath)
    }
  }

  /**
   * Release an unreferenced image under the item lock.
   *
   * @param {string} libraryItemId
   * @param {string} path
   * @param {string} podcastId
   * @returns {Promise<void>}
   */
  async releaseImage(libraryItemId, path, podcastId) {
    return this.withItemLock(libraryItemId, () => this.releaseImageUnlocked(libraryItemId, path, podcastId))
  }

  async releaseImageUnlocked(libraryItemId, path, podcastId) {
    if (!this.isCurrentImagePath(libraryItemId, path)) {
      return
    }
    if (await Database.podcastEpisodeModel.count({ where: { podcastId, coverPath: path } })) {
      return
    }

    await fs.unlink(path).catch((error) => {
      if (error.code !== 'ENOENT') Logger.warn('[EpisodeCoverManager] Failed to release image', path, error)
    })
    await CacheManager.purgeCoverCache(`${libraryItemId}_ep_${Path.parse(path).name}`)
  }

  async setEpisodeCoverUnlocked(libraryItem, episode, { path = null, source = null, sourceUrl = null, embeddedSha, embeddedIsShowArt = false, rssConsulted = false }) {
    const oldPath = episode.coverPath || null
    const oldSource = episode.extraData?.coverSource || null
    const oldUpdatedAt = episode.updatedAt

    if (!rssConsulted && oldSource === 'rss' && source === 'embedded' && oldPath && (await fs.pathExists(oldPath))) {
      if (path && path !== oldPath) {
        await this.releaseImageUnlocked(libraryItem.id, path, episode.podcastId)
      }

      path = oldPath
      source = oldSource
      sourceUrl = episode.extraData?.coverSourceUrl || null
    }

    const extraData = {
      ...episode.extraData,
      coverSource: source,
      coverSourceUrl: sourceUrl
    }
    if (embeddedSha !== undefined) {
      extraData.embeddedSha = embeddedSha
      extraData.embeddedIsShowArt = embeddedIsShowArt
    }

    const changed = oldPath !== path || oldSource !== source
    const values = { coverPath: path, extraData, updatedAt: changed ? new Date() : oldUpdatedAt }

    // Metadata only changes keep updatedAt so feeds and caches stay valid.
    try {
      const [updated] = await Database.podcastEpisodeModel.update(values, { where: { id: episode.id }, silent: !changed })
      if (!updated) {
        await this.releaseImageUnlocked(libraryItem.id, path, episode.podcastId)
        return false
      }
      episode.set(values, { raw: true })
    } catch (saveError) {
      if (path && path !== oldPath) await this.releaseImageUnlocked(libraryItem.id, path, episode.podcastId)
      throw saveError
    }

    if (oldPath && oldPath !== path) {
      await this.releaseImageUnlocked(libraryItem.id, oldPath, episode.podcastId)
    }

    return changed
  }

  /**
   * Acquire the highest priority automatic cover for an episode.
   *
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {import('../models/PodcastEpisode')} episode
   * @param {{force?: boolean, embeddedOnly?: boolean}} options
   * @returns {Promise<boolean>}
   */
  async refreshEpisodeCover(libraryItem, episode, { force = false, embeddedOnly = false } = {}) {
    return this.withItemLock(libraryItem.id, async () => {
      await episode.reload()
      if (['upload', 'none'].includes(episode.extraData?.coverSource)) {
        return false
      }

      let result = { path: null }
      let source = null
      let embeddedSha
      let rssConsulted = false
      let embeddedIsShowArt = false
      let showHash = null
      if (libraryItem.media.coverPath && (await fs.pathExists(libraryItem.media.coverPath))) {
        showHash = await this.hashFile(libraryItem.media.coverPath)
      }

      if (!embeddedOnly && episode.imageURL) {
        result = await this.getRssCover(libraryItem, episode, showHash, force)
        rssConsulted = !result.error
        if (result.path) source = 'rss'
      }

      if (!result.path && (!episode.extraData?.embeddedIsShowArt || force)) {
        const embedded = await this.getEmbeddedCover(libraryItem, episode, showHash)
        if (!embedded.error) {
          embeddedSha = embedded.embeddedSha ?? (embeddedOnly && force ? null : undefined)
          embeddedIsShowArt = !!embedded.embeddedIsShowArt
        }
        if (embedded.path) {
          result = { ...result, path: embedded.path }
          source = 'embedded'
        } else if (embedded.error && !result.error) {
          result = embedded
        }
      }

      if (result.error) {
        const reason = result.detail ? `${result.error}: ${result.detail}` : result.error
        Logger.warn(`[EpisodeCoverManager] Cover acquisition failed for episode ${episode.id} on item ${libraryItem.id}: ${reason}`)
      }

      if (!result.path && result.error && episode.coverPath && (await fs.pathExists(episode.coverPath))) {
        result.path = episode.coverPath
        source = episode.extraData?.coverSource || null
      }

      let sourceUrl = source === 'rss' ? episode.imageURL : null
      if (result.error && result.path === episode.coverPath) {
        sourceUrl = episode.extraData?.coverSourceUrl || null
      }

      let changed = await this.setEpisodeCoverUnlocked(libraryItem, episode, { ...result, source, sourceUrl, embeddedSha, embeddedIsShowArt, rssConsulted })

      if (embeddedSha) {
        changed = (await this.applyShowLogoHeuristic(libraryItem, episode, embeddedSha)) || changed
      }

      return changed
    })
  }

  async getRssCover(libraryItem, episode, showHash, force) {
    if (episode.imageURL === libraryItem.media.imageURL) return { path: null }

    let result = { path: null }
    if (!force) {
      const episodes = await Database.podcastEpisodeModel.findAll({
        where: { podcastId: episode.podcastId, imageURL: episode.imageURL },
        attributes: ['id', 'coverPath', 'extraData']
      })
      for (const other of episodes) {
        const hasMatchingSource = other.extraData?.coverSource === 'rss' && other.extraData.coverSourceUrl === episode.imageURL
        if (hasMatchingSource && this.isCurrentImagePath(libraryItem.id, other.coverPath) && (await fs.pathExists(other.coverPath))) {
          result = { path: other.coverPath }
          break
        }
      }
    }

    if (!result.path) {
      result = await this.storeImageFromUrl(libraryItem.id, episode.imageURL)
    }
    if (result.path && Path.parse(result.path).name === showHash) {
      await this.releaseImageUnlocked(libraryItem.id, result.path, episode.podcastId)
      return { path: null }
    }
    return result
  }

  async getEmbeddedCover(libraryItem, episode, showHash) {
    const result = await this.extractEmbeddedImage(libraryItem.id, episode.audioFile, episode.podcastId)
    if (!result.path) return result

    const embeddedSha = Path.parse(result.path).name
    if (embeddedSha === showHash) {
      await this.releaseImageUnlocked(libraryItem.id, result.path, episode.podcastId)
      return { path: null, embeddedSha }
    }
    return { ...result, embeddedSha }
  }

  async applyShowLogoHeuristic(libraryItem, episode, embeddedSha) {
    let changed = false
    const episodes = await Database.podcastEpisodeModel.findAll({
      where: { podcastId: episode.podcastId },
      attributes: ['id', 'coverPath', 'extraData']
    })
    const examined = episodes.filter((other) => other.extraData?.embeddedSha !== undefined)
    const shared = examined.filter((other) => other.extraData?.embeddedSha === embeddedSha)

    if (examined.length >= minExaminedEpisodes && shared.length / examined.length >= showArtThreshold) {
      for (const other of shared) {
        if (other.extraData?.coverSource !== 'embedded') continue

        const path = other.coverPath
        other.coverPath = null
        other.extraData = { ...other.extraData, coverSource: null, embeddedIsShowArt: true }
        await other.save()
        await this.releaseImageUnlocked(libraryItem.id, path, episode.podcastId)

        const current = libraryItem.media.podcastEpisodes?.find((entry) => entry.id === other.id)
        if (current) {
          current.set({ coverPath: null, extraData: other.extraData, updatedAt: other.updatedAt })
        }
        if (episode.id === other.id) {
          episode.set({ coverPath: null, extraData: other.extraData, updatedAt: other.updatedAt })
        }
        changed = true
      }
    }
    return changed
  }
}

module.exports = new EpisodeCoverManager()
