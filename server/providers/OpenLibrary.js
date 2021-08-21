var axios = require('axios')

class OpenLibrary {
  constructor() {
    this.baseUrl = 'https://openlibrary.org'
  }

  get(uri) {
    return axios.get(`${this.baseUrl}/${uri}`).then((res) => {
      return res.data
    }).catch((error) => {
      console.error('Failed', error)
      return false
    })
  }

  async isbnLookup(isbn) {
    var lookupData = await this.get(`/isbn/${isbn}`)
    if (!lookupData) {
      return {
        errorCode: 404
      }
    }
    return lookupData
  }

  async getWorksData(worksKey) {
    var worksData = await this.get(`${worksKey}.json`)
    if (!worksData.covers) worksData.covers = []
    var coverImages = worksData.covers.filter(c => c > 0).map(c => `https://covers.openlibrary.org/b/id/${c}-L.jpg`)
    var description = null
    if (worksData.description) {
      if (typeof worksData.description === 'string') {
        description = worksData.description
      } else {
        description = worksData.description.value || null
      }
    }
    return {
      id: worksKey.split('/').pop(),
      key: worksKey,
      covers: coverImages,
      first_publish_date: worksData.first_publish_date,
      description: description
    }
  }

  async cleanSearchDoc(doc) {
    var worksData = await this.getWorksData(doc.key)
    return {
      title: doc.title,
      author: doc.author_name ? doc.author_name.join(', ') : null,
      year: doc.first_publish_year,
      edition: doc.cover_edition_key,
      cover: doc.cover_edition_key ? `https://covers.openlibrary.org/b/OLID/${doc.cover_edition_key}-L.jpg` : null,
      ...worksData
    }
  }

  async search(query) {
    var queryString = Object.keys(query).map(key => key + '=' + query[key]).join('&')
    var lookupData = await this.get(`/search.json?${queryString}`)
    if (!lookupData) {
      return {
        errorCode: 404
      }
    }
    var searchDocs = await Promise.all(lookupData.docs.map(d => this.cleanSearchDoc(d)))
    return searchDocs
  }

  async searchTitle(title) {
    title = title.replace(/'/g, '')
    var lookupData = await this.get(`/search.json?title=${title}`)
    if (!lookupData) {
      return {
        errorCode: 404
      }
    }
    var searchDocs = await Promise.all(lookupData.docs.map(d => this.cleanSearchDoc(d)))
    return searchDocs
  }
}
module.exports = OpenLibrary