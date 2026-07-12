const axios = require('axios').default
const Logger = require('../../Logger')

// PERFECT alignment with Audible.com categories provided by user
const CATEGORY_MAP = {
  'Arts & Entertainment': '18571910011',
  'Biographies & Memoirs': '18571951011',
  'Business & Careers': '18572029011',
  'Children\'s Audiobooks': '18572091011',
  'Comedy & Humor': '24427740011',
  'Computers & Technology': '18573211011',
  'Education & Learning': '18573267011',
  'Engineering & Transportation': '18573301011',
  'Erotica': '18573351011',
  'Health & Wellness': '18573370011',
  'History': '18573518011',
  'Home & Garden': '18573701011',
  'LGBTQ+': '18573743011',
  'Literature & Fiction': '18574426011', // User provided 18574426011 for Lit & Fic
  'Money & Finance': '18574547011',
  'Mystery, Thriller & Suspense': '18574597011',
  'Politics & Social Sciences': '18574641011',
  'Relationships, Parenting & Personal Development': '18574784011',
  'Religion & Spirituality': '18574839011',
  'Romance': '18580518011',
  'Science & Engineering': '18580540011',
  'Science Fiction & Fantasy': '18580606011',
  'Sports & Outdoors': '18580648011',
  'Teen & Young Adult': '18580715011',
  'Travel & Tourism': '18581095011'
}

class AudibleScraper {
  constructor() {
    this.baseUrl = 'https://api.audible.com/1.0/catalog/products'
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }

  async scrapeCategory(categoryName, type = 'Best Sellers') {
    const categoryId = CATEGORY_MAP[categoryName]
    if (!categoryId) {
      Logger.error(`[AudibleScraper] Unknown category: ${categoryName}`)
      return []
    }

    const sort = type === 'New Releases' ? 'ReleaseDate' : 'Relevance'
    const url = `${this.baseUrl}?num_results=30&category_id=${categoryId}&products_sort_by=${sort}&response_groups=product_desc,media,contributors,product_attrs`

    Logger.debug(`[AudibleScraper] Fetching ${type} for ${categoryName} via API`)

    try {
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 20000
      })

      if (!data.products || !Array.isArray(data.products)) {
        return []
      }

      return data.products.map(p => ({
        title: p.title,
        author: p.authors ? p.authors.map(a => a.name).join(', ') : 'Unknown',
        description: p.merchandising_summary || p.description || '',
        coverUrl: p.product_images ? (p.product_images['500'] || p.product_images['240'] || Object.values(p.product_images)[0]) : null,
        sourceUrl: `https://www.audible.com/pd/${p.asin}`,
        asin: p.asin,
        category: categoryName,
        type
      }))
    } catch (error) {
      Logger.error(`[AudibleScraper] API error for ${categoryName}: ${error.message}`)
      return []
    }
  }

  async scrapeSimilar(asin) {
    const url = `${this.baseUrl}?num_results=10&similar_asin=${asin}&response_groups=product_desc,media,contributors,product_attrs`
    
    try {
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000
      })

      if (!data.products) return []

      return data.products.map(p => ({
        title: p.title,
        author: p.authors ? p.authors.map(a => a.name).join(', ') : 'Unknown',
        coverUrl: p.product_images ? (p.product_images['500'] || p.product_images['240']) : null,
        sourceUrl: `https://www.audible.com/pd/${p.asin}`,
        asin: p.asin,
        type: 'Recommendation'
      }))
    } catch (error) {
      return this.search(asin + " similar")
    }
  }

  async search(query) {
    const url = `${this.baseUrl}?num_results=20&keywords=${encodeURIComponent(query)}&response_groups=product_desc,media,contributors,product_attrs`
    
    try {
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 20000
      })

      if (!data.products) return []

      return data.products.map(p => ({
        title: p.title,
        author: p.authors ? p.authors.map(a => a.name).join(', ') : 'Unknown',
        description: p.merchandising_summary || p.description || '',
        coverUrl: p.product_images ? (p.product_images['500'] || p.product_images['240'] || Object.values(p.product_images)[0]) : null,
        sourceUrl: `https://www.audible.com/pd/${p.asin}`,
        asin: p.asin,
        category: 'Search Result',
        type: 'Search'
      }))
    } catch (error) {
      Logger.error(`[AudibleScraper] Search API error for ${query}: ${error.message}`)
      return []
    }
  }
}

module.exports = new AudibleScraper()
module.exports.CATEGORY_MAP = CATEGORY_MAP
