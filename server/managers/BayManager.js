const Logger = require('../Logger')
const Database = require('../Database')
const Sequelize = require('sequelize')
const axios = require('axios').default
const { levenshteinDistance } = require('../utils/index')
const audibleScraper = require('../utils/bay/audibleScraper')
const abbScraper = require('../utils/bay/abbScraper')
const audiobooksScraper = require('../utils/bay/audiobooksScraper')

class BayManager {
  constructor() {
    this.isScraping = false
    this.abbQueue = []
    this.isProcessingQueue = false
    this.scannedCategories = new Set()
  }

  /**
   * Get discovered items from the Bay table.
   * Cross-references with local library to check if items are already owned.
   * 
   * @param {string} libraryId 
   * @param {import('../models/User')} user 
   * @param {string} category 
   * @param {string} search 
   * @returns {Promise<Object>}
   */
  async getBayItems(libraryId, user, category = 'All', search = '') {
    // If search is provided, do a live search on Audible
    if (search) {
      Logger.info(`[BayManager] Performing live search for: "${search}"`)
      const searchResults = await audibleScraper.search(search)
      for (const item of searchResults) {
        await this.saveBayItem(item)
      }
    } else if (category !== 'All' && category !== 'Recommendation' && category !== 'Search Result') {
      // Trigger a background scrape if category is empty or hasn't been scanned recently
      const count = await Database.bayItemModel.count({
        where: {
          category: { [Sequelize.Op.like]: `%|${category}|%` },
          lastScanned: { [Sequelize.Op.gt]: new Date(new Date().setHours(0,0,0,0)) }
        }
      })
      
      if (count < 10) {
        Logger.info(`[BayManager] Category "${category}" needs fresh data. Triggering background scrape.`)
        this.backgroundScrapeCategory(category)
      }
    }

    const where = {}
    if (category !== 'All') {
      // Correct multi-genre matching: search for the genre wrapped in pipes
      where.category = { [Sequelize.Op.like]: `%|${category}|%` }
    }

    const bayItems = await Database.bayItemModel.findAll({
      where,
      order: [
        ['type', 'ASC'], // Show New Releases/Best Sellers first
        ['lastScanned', 'DESC']
      ],
      limit: 500
    })

    // Get all library items in this library to check for ownership
    const libraryItems = await Database.libraryItemModel.findAll({
      where: { libraryId },
      include: [{
        model: Database.bookModel,
        include: [{ model: Database.authorModel, as: 'authors' }]
      }]
    })

    const items = bayItems.map(bi => {
      const item = bi.toJSON()
      const matchingLibraryItem = libraryItems.find(li => {
        const localAuthor = li.authorNamesFirstLast || (li.media.authors && li.media.authors.length ? li.media.authors[0].name : '')
        return (bi.asin && li.media.asin === bi.asin) || 
        (li.media.title.toLowerCase() === bi.title.toLowerCase() && localAuthor.toLowerCase() === bi.author.toLowerCase())
      })
      item.isOwned = !!matchingLibraryItem
      item.libraryItemId = matchingLibraryItem ? matchingLibraryItem.id : null
      return item
    })

    // Add local items that aren't already in the discovery list
    for (const li of libraryItems) {
      const title = li.media.title
      const author = li.authorNamesFirstLast || (li.media.authors && li.media.authors.length ? li.media.authors[0].name : 'Unknown')
      const asin = li.media.asin
      
      const isAlreadyListed = items.some(it => 
        (asin && it.asin === asin) || 
        (it.title.toLowerCase() === title.toLowerCase() && it.author.toLowerCase() === author.toLowerCase())
      )

      if (!isAlreadyListed) {
        if (category !== 'All' && category !== 'Recommendation' && category !== 'Search Result') {
          const genres = li.media.genres || []
          if (!genres.some(g => g.toLowerCase() === category.toLowerCase())) {
            continue
          }
        }

        items.push({
          id: li.id,
          libraryItemId: li.id,
          title,
          author,
          description: li.media.description,
          coverUrl: li.media.coverPath ? `/api/items/${li.id}/cover?updatedAt=${li.updatedAt}` : null,
          isOwned: true,
          category: `|${category === 'All' ? (li.media.genres?.[0] || 'Local') : category}|`,
          type: 'Library'
        })
      }
    }

    let finalItems = items
    if (search) {
       finalItems = items.filter(it => it.title.toLowerCase().includes(search.toLowerCase()) || it.author.toLowerCase().includes(search.toLowerCase()))
    }

    return {
      items: finalItems.sort((a, b) => (a.isOwned === b.isOwned) ? 0 : a.isOwned ? 1 : -1),
      categories: await this.getAvailableCategories(),
      message: this.isScraping ? 'Refreshing discovery hub...' : ''
    }
  }

  async getAvailableCategories() {
    return Object.keys(audibleScraper.CATEGORY_MAP).sort()
  }

  async backgroundScrapeCategory(category) {
    if (this.isScraping) return
    this.scannedCategories.add(category)
    try {
      await Promise.all([
        this.scrapeAudibleCategory(category, 'Best Sellers'),
        this.scrapeAudibleCategory(category, 'New Releases')
      ])
    } catch (e) {
      Logger.error(`[BayManager] Background scrape failed for ${category}:`, e.message)
    }
  }

  async refreshBay(user = null) {
    if (this.isScraping) return
    this.isScraping = true
    Logger.info(`[BayManager] Starting discovery hub refresh...`)

    try {
      // CRITICAL: Clear corrupted data to start fresh with perfect API nodes
      await Database.bayItemModel.destroy({ where: {} })
      this.scannedCategories.clear()

      if (user) {
        await this.generateRecommendations(user)
      }
      
      const categoriesToScan = Object.keys(audibleScraper.CATEGORY_MAP)
      for (const category of categoriesToScan) {
        this.scannedCategories.add(category)
        await this.scrapeAudibleCategory(category, 'Best Sellers')
        await new Promise(resolve => setTimeout(resolve, 1000))
        await this.scrapeAudibleCategory(category, 'New Releases')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      Logger.info(`[BayManager] Discovery hub refresh complete.`)
    } catch (error) {
      Logger.error(`[BayManager] Error refreshing bay:`, error)
    } finally {
      this.isScraping = false
    }
  }

  async generateRecommendations(user) {
    Logger.info(`[BayManager] Generating recommendations for user "${user.username}"`)
    const recentProgress = await Database.mediaProgressModel.findAll({
      where: { userId: user.id, mediaItemType: 'book' },
      order: [['updatedAt', 'DESC']],
      limit: 5
    })

    for (const progress of recentProgress) {
      const book = await Database.bookModel.findByPk(progress.mediaItemId)
      if (book?.asin) {
        const similar = await audibleScraper.scrapeSimilar(book.asin)
        for (const item of similar) {
          item.category = 'Recommendation'
          await this.saveBayItem(item)
        }
      }
    }
  }

  async scrapeAudibleCategory(category, type) {
    const items = await audibleScraper.scrapeCategory(category, type)
    Logger.info(`[BayManager] Scraped ${items.length} items for category "${category}" (${type})`)
    for (const item of items) {
      await this.saveBayItem(item)
    }
  }

  async saveBayItem(itemData) {
    try {
      let bayItem = await Database.bayItemModel.findOne({
        where: { title: itemData.title, author: itemData.author }
      })

      const newGenreTag = `|${itemData.category}|`

      if (!bayItem) {
        itemData.category = newGenreTag
        bayItem = await Database.bayItemModel.create({
          ...itemData,
          lastScanned: new Date()
        })
      } else {
        const updateData = { ...itemData, lastScanned: new Date() }
        let currentGenres = bayItem.category || ''
        
        // Proper multi-genre logic: Ensure we only append if it is truly a new tag
        if (!currentGenres.includes(newGenreTag)) {
          updateData.category = currentGenres + newGenreTag
        } else {
          delete updateData.category
        }
        
        delete updateData.downloadUrl
        await bayItem.update(updateData)
      }

      if (!bayItem.downloadUrl) {
        this.addToABBQueue(bayItem)
      }
    } catch (error) {
      Logger.error(`[BayManager] Error saving bay item "${itemData.title}":`, error.message)
    }
  }

  addToABBQueue(bayItem) {
    if (this.abbQueue.find(item => item.id === bayItem.id)) return
    this.abbQueue.push(bayItem)
    this.processABBQueue()
  }

  async processABBQueue() {
    if (this.isProcessingQueue || this.abbQueue.length === 0) return
    this.isProcessingQueue = true

    while (this.abbQueue.length > 0) {
      const bayItem = this.abbQueue.shift()
      try {
        const downloadUrl = await abbScraper.search(bayItem.title, bayItem.author)
        if (downloadUrl) {
          bayItem.downloadUrl = downloadUrl
          await bayItem.save()
          Logger.info(`[BayManager] Background ABB match found for "${bayItem.title}"`)
        }
        await new Promise(resolve => setTimeout(resolve, 5000))
      } catch (error) {
        Logger.error(`[BayManager] ABB search failed for "${bayItem.title}":`, error.message)
      }
    }

    this.isProcessingQueue = false
  }
}

module.exports = new BayManager()
