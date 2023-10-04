const axios = require('axios')
const Logger = require('../Logger')
const xpath = require('xpath')
const { DOMParser } = require('xmldom')

class Kindle {
  cleanResult(result) {
    const format = xpath.select('.//a[contains(text(), "Kindle Edition")]//text()', result).join('')
    if (!format || !format.toLowerCase().includes('kindle')) return null

    const asin = result.getAttribute('data-asin')
    if (!asin) return null

    const coverUrlSet = xpath.select('.//img/@srcset', result)[0].value.split(/\s*,\s*/)
    const cover = coverUrlSet[coverUrlSet.length - 1].split(' ')[0] // Get largest cover
    const title = xpath.select('.//h2', result)[0].textContent.trim()
    const authorDiv = xpath.select('.//div[contains(@class, "a-color-secondary")]', result)[0]
    const authorParts = authorDiv.textContent.split(' ')
    const idx = authorParts.indexOf('by')
    const author = authorParts
      .slice(idx + 1)
      .join(' ')
      .split('|')[0]
      .trim()

    return {
      asin,
      title,
      author,
      cover
    }
  }

  async search(title, author) {
    const queryParams = new URLSearchParams()
    queryParams.append('i', 'digital-text')
    queryParams.append('k', title)
    if (author) {
      author = encodeURIComponent(author)
      queryParams.append('inauthor', author)
    }
    var url = `https://www.amazon.com/s/?${queryParams.toString()}`
    Logger.debug(`[Kindle] Search url: ${url}`)

    var items = await axios
      .get(url, { headers: { 'User-Agent': '' } }) //Amazon blocks the axios user agent so we strip it
      .then((result) => {
        if (!result || !result.data) return []
        const dom = new DOMParser({
          errorHandler: {
            warning: () => {}, // Suppress warning messages
            error: () => {} // Suppress error messages
          }
        }).parseFromString(result.data)
        return xpath.select('//div[contains(@class, "s-result-list")]//div[@data-index and @data-asin]', dom)
      })
      .catch((error) => {
        Logger.error('[Kindle] Query search error', error)
        return []
      })
    return items.map((item) => this.cleanResult(item)).filter((item) => item !== null)
  }
}

module.exports = Kindle
