const axios = require('axios').default
const cheerio = require('cheerio')
const Logger = require('../../Logger')

class ABBScraper {
  constructor() {
    this.baseUrl = 'https://audiobookbay.lu'
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    this.session = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // Increased to 30s
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Upgrade-Insecure-Requests': '1'
      }
    })
  }

  async search(title, author) {
    // ABB search is very sensitive. Wrapping the first 3 words of the title in quotes.
    const cleanTitle = title.replace(/[^\w\s]/gi, '').split(' ').slice(0, 3).join(' ')
    const query = `"${cleanTitle}"`
    const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query).replace(/%20/g, '+')}`
    
    Logger.debug(`[ABBScraper] Searching for magnet link: ${searchUrl}`)

    try {
      // Visit home first to get cookies/session
      const homeResponse = await this.session.get('/').catch(() => null)
      const cookies = homeResponse?.headers?.['set-cookie']

      // Perform the search with cookies and referer
      const { data } = await this.session.get(`/?s=${encodeURIComponent(query).replace(/%20/g, '+')}`, {
        headers: {
          'Referer': this.baseUrl + '/',
          'Cookie': cookies ? cookies.join('; ') : ''
        }
      })
      
      const $ = cheerio.load(data)
      let matchUrl = null

      // Look for first search result that matches the title
      $('.post').each((i, el) => {
        if (matchUrl) return
        
        const resultLinkEl = $(el).find('.postTitle h2 a')
        const resultTitle = resultLinkEl.text().toLowerCase()
        
        // Match at least the first word of the title
        const firstWord = cleanTitle.toLowerCase().split(' ')[0]
        if (resultTitle.includes(firstWord)) {
          matchUrl = resultLinkEl.attr('href')
        }
      })

      if (matchUrl) {
        const fullUrl = matchUrl.startsWith('http') ? matchUrl : this.baseUrl + (matchUrl.startsWith('/') ? '' : '/') + matchUrl
        Logger.debug(`[ABBScraper] Found match: ${fullUrl}`)
        return fullUrl
      }

      Logger.debug(`[ABBScraper] No match found for "${title}"`)
      return null
    } catch (error) {
      Logger.error(`[ABBScraper] Error searching for ${title}:`, error.message)
      return null
    }
  }
}

module.exports = new ABBScraper()
