const Path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const { createComicBookExtractor } = require('../utils/comicBookExtractors')

/**
 * Manages caching of extracted comic book pages for performance.
 * Pages are extracted on-demand and cached to disk.
 */
class ComicCacheManager {
  constructor() {
    this.ComicCachePath = null
    // In-memory cache of comic metadata (page lists)
    // Key: libraryItemId:fileIno, Value: { pages: string[], mtime: number }
    this.metadataCache = new Map()
    // Track open extractors for reuse within a session
    this.extractorCache = new Map()
    this.extractorTimeout = 30000 // Close extractors after 30s of inactivity
  }

  /**
   * Initialize cache directory
   */
  async ensureCachePaths() {
    this.ComicCachePath = Path.join(global.MetadataPath, 'cache', 'comics')
    try {
      await fs.ensureDir(this.ComicCachePath)
    } catch (error) {
      Logger.error(`[ComicCacheManager] Failed to create cache directory at "${this.ComicCachePath}": ${error.message}`)
      throw error
    }
  }

  /**
   * Get cache directory for a specific comic
   * @param {string} libraryItemId 
   * @param {string} fileIno 
   * @returns {string}
   */
  getComicCacheDir(libraryItemId, fileIno) {
    return Path.join(this.ComicCachePath, `${libraryItemId}_${fileIno}`)
  }

  /**
   * Get cached page path
   * @param {string} libraryItemId 
   * @param {string} fileIno 
   * @param {number} pageNum 
   * @param {string} ext 
   * @returns {string}
   */
  getCachedPagePath(libraryItemId, fileIno, pageNum, ext) {
    const cacheDir = this.getComicCacheDir(libraryItemId, fileIno)
    return Path.join(cacheDir, `page_${String(pageNum).padStart(5, '0')}${ext}`)
  }

  /**
   * Parse image filenames and return sorted page list
   * @param {string[]} filenames 
   * @returns {string[]}
   */
  parseAndSortPages(filenames) {
    const acceptableImages = ['.jpeg', '.jpg', '.png', '.webp', '.gif']
    
    const imageFiles = filenames.filter(f => {
      const ext = (Path.extname(f) || '').toLowerCase()
      return acceptableImages.includes(ext)
    })

    // Sort by numeric value in filename
    const parsed = imageFiles.map(filename => {
      const basename = Path.basename(filename, Path.extname(filename))
      const numbers = basename.match(/\d+/g)
      return {
        filename,
        index: numbers?.length ? Number(numbers[numbers.length - 1]) : -1
      }
    })

    const withNum = parsed.filter(p => p.index >= 0).sort((a, b) => a.index - b.index)
    const withoutNum = parsed.filter(p => p.index < 0)
    
    return [...withNum, ...withoutNum].map(p => p.filename)
  }

  /**
   * Get or create an extractor for a comic, with caching
   * @param {string} comicPath 
   * @param {string} cacheKey 
   * @returns {Promise<object>}
   */
  async getExtractor(comicPath, cacheKey) {
    const cached = this.extractorCache.get(cacheKey)
    if (cached) {
      clearTimeout(cached.timeout)
      cached.timeout = setTimeout(() => this.closeExtractor(cacheKey), this.extractorTimeout)
      return cached.extractor
    }

    const extractor = createComicBookExtractor(comicPath)
    await extractor.open()
    
    const timeout = setTimeout(() => this.closeExtractor(cacheKey), this.extractorTimeout)
    this.extractorCache.set(cacheKey, { extractor, timeout })
    
    return extractor
  }

  /**
   * Close and remove a cached extractor
   * @param {string} cacheKey 
   */
  closeExtractor(cacheKey) {
    const cached = this.extractorCache.get(cacheKey)
    if (cached) {
      clearTimeout(cached.timeout)
      try {
        cached.extractor.close()
      } catch (e) {
        Logger.debug(`[ComicCacheManager] Error closing extractor: ${e.message}`)
      }
      this.extractorCache.delete(cacheKey)
      Logger.debug(`[ComicCacheManager] Closed extractor for ${cacheKey}`)
    }
  }

  /**
   * Get comic metadata (page list) with caching
   * @param {string} libraryItemId 
   * @param {string} fileIno 
   * @param {string} comicPath 
   * @returns {Promise<{pages: string[], numPages: number}>}
   */
  async getComicMetadata(libraryItemId, fileIno, comicPath) {
    const cacheKey = `${libraryItemId}:${fileIno}`
    
    // Check memory cache
    const cached = this.metadataCache.get(cacheKey)
    if (cached) {
      // Verify file hasn't changed
      try {
        const stat = await fs.stat(comicPath)
        if (stat.mtimeMs === cached.mtime) {
          return { pages: cached.pages, numPages: cached.pages.length }
        }
      } catch (e) {
        // File may have been removed
      }
      this.metadataCache.delete(cacheKey)
    }

    // Extract metadata
    const extractor = await this.getExtractor(comicPath, cacheKey)
    const allFiles = await extractor.getFilePaths()
    const pages = this.parseAndSortPages(allFiles)
    
    // Get file mtime for cache validation
    const stat = await fs.stat(comicPath)
    
    // Cache in memory
    this.metadataCache.set(cacheKey, {
      pages,
      mtime: stat.mtimeMs
    })

    Logger.debug(`[ComicCacheManager] Cached metadata for ${cacheKey}: ${pages.length} pages`)
    
    return { pages, numPages: pages.length }
  }

  /**
   * Get a specific page, extracting and caching if necessary
   * @param {string} libraryItemId 
   * @param {string} fileIno 
   * @param {string} comicPath 
   * @param {number} pageNum - 1-indexed page number
   * @returns {Promise<{path: string, contentType: string} | null>}
   */
  async getPage(libraryItemId, fileIno, comicPath, pageNum) {
    const cacheKey = `${libraryItemId}:${fileIno}`
    
    // Get page list
    const { pages } = await this.getComicMetadata(libraryItemId, fileIno, comicPath)
    
    if (pageNum < 1 || pageNum > pages.length) {
      Logger.error(`[ComicCacheManager] Invalid page number ${pageNum} for comic with ${pages.length} pages`)
      return null
    }

    const pageFilename = pages[pageNum - 1]
    const ext = Path.extname(pageFilename).toLowerCase()
    const cachedPath = this.getCachedPagePath(libraryItemId, fileIno, pageNum, ext)

    // Check if already cached
    if (await fs.pathExists(cachedPath)) {
      Logger.debug(`[ComicCacheManager] Serving cached page ${pageNum} from ${cachedPath}`)
      return {
        path: cachedPath,
        contentType: this.getContentType(ext)
      }
    }

    // Extract and cache the page
    const cacheDir = this.getComicCacheDir(libraryItemId, fileIno)
    await fs.ensureDir(cacheDir)

    const extractor = await this.getExtractor(comicPath, cacheKey)
    const success = await extractor.extractToFile(pageFilename, cachedPath)
    
    if (!success) {
      Logger.error(`[ComicCacheManager] Failed to extract page ${pageNum} (${pageFilename})`)
      return null
    }

    Logger.debug(`[ComicCacheManager] Extracted and cached page ${pageNum} to ${cachedPath}`)
    
    return {
      path: cachedPath,
      contentType: this.getContentType(ext)
    }
  }

  /**
   * Get content type for image extension
   * @param {string} ext 
   * @returns {string}
   */
  getContentType(ext) {
    const types = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    }
    return types[ext] || 'application/octet-stream'
  }

  /**
   * Purge cached pages for a specific comic
   * @param {string} libraryItemId 
   * @param {string} fileIno 
   */
  async purgeComicCache(libraryItemId, fileIno) {
    const cacheKey = `${libraryItemId}:${fileIno}`
    const cacheDir = this.getComicCacheDir(libraryItemId, fileIno)
    
    // Close any open extractor
    this.closeExtractor(cacheKey)
    
    // Remove metadata cache
    this.metadataCache.delete(cacheKey)
    
    // Remove disk cache
    if (await fs.pathExists(cacheDir)) {
      await fs.remove(cacheDir)
      Logger.info(`[ComicCacheManager] Purged cache for ${cacheKey}`)
    }
  }

  /**
   * Purge all cached pages for a library item
   * @param {string} libraryItemId 
   */
  async purgeLibraryItemCache(libraryItemId) {
    // Close any open extractors for this item
    for (const [key] of this.extractorCache) {
      if (key.startsWith(`${libraryItemId}:`)) {
        this.closeExtractor(key)
      }
    }

    // Remove metadata cache entries
    for (const [key] of this.metadataCache) {
      if (key.startsWith(`${libraryItemId}:`)) {
        this.metadataCache.delete(key)
      }
    }

    // Remove disk cache
    const files = await fs.readdir(this.ComicCachePath).catch(() => [])
    for (const file of files) {
      if (file.startsWith(`${libraryItemId}_`)) {
        await fs.remove(Path.join(this.ComicCachePath, file)).catch(() => {})
      }
    }
    
    Logger.info(`[ComicCacheManager] Purged all cache for library item ${libraryItemId}`)
  }

  /**
   * Close all open extractors (for shutdown)
   */
  closeAllExtractors() {
    for (const [key] of this.extractorCache) {
      this.closeExtractor(key)
    }
  }
}

module.exports = new ComicCacheManager()
