import axios from 'axios'

type WorkResponse = {
  covers?: number[]; first_publish_date?: string; description?: string | { value?: string }
}
type SearchDoc = {
  key: string; title: string; author_name?: string[]; first_publish_year?: string | number
  cover_edition_key?: string
}
type WorksData = {
  id?: string; key?: string; covers?: string[]; first_publish_date?: string; description?: string | null
  errorMsg?: string; errorCode?: number
}

class OpenLibrary {
  declare baseUrl: string
  #responseTimeout = 10000

  constructor() {
    this.baseUrl = 'https://openlibrary.org'
  }

  /**
   *
   * @param {string} uri
   * @param {number} timeout
   * @returns {Promise<Object>}
   */
  get<T>(uri: string, timeout = this.#responseTimeout) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout
    return axios
      .get<T>(`${this.baseUrl}/${uri}`, {
        timeout
      })
      .then((res) => {
        return res.data
      })
      .catch((error: Error) => {
        console.error('Failed', error.message)
        return null
      })
  }

  async isbnLookup(isbn: string) {
    var lookupData = await this.get<Record<string, unknown>>(`/isbn/${isbn}`)
    if (!lookupData) {
      return {
        errorCode: 404 as const
      }
    }
    return lookupData
  }

  async getWorksData(worksKey: string): Promise<WorksData> {
    var worksData = await this.get<WorkResponse>(`${worksKey}.json`)
    if (!worksData) {
      return {
        errorMsg: 'Works Data Request failed',
        errorCode: 500
      }
    }
    if (!worksData.covers) worksData.covers = []
    var coverImages = worksData.covers.filter((c) => c > 0).map((c) => `https://covers.openlibrary.org/b/id/${c}-L.jpg`)
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

  parsePublishYear(doc: SearchDoc, worksData: WorksData) {
    // Keep global isNaN coercion for API years; the assertion changes only its TypeScript input view.
    if (doc.first_publish_year && !isNaN(doc.first_publish_year as number)) return String(doc.first_publish_year)
    if (worksData.first_publish_date) {
      var year = worksData.first_publish_date.split('-')[0]
      if (!isNaN(year as unknown as number)) return String(year)
    }
    return null
  }

  async cleanSearchDoc(doc: SearchDoc) {
    var worksData = await this.getWorksData(doc.key)
    return {
      title: doc.title,
      author: doc.author_name ? doc.author_name.join(', ') : null,
      publishedYear: this.parsePublishYear(doc, worksData),
      edition: doc.cover_edition_key,
      cover: doc.cover_edition_key ? `https://covers.openlibrary.org/b/OLID/${doc.cover_edition_key}-L.jpg` : null,
      ...worksData
    }
  }

  async search(query: Record<string, string | number>) {
    var queryString = Object.keys(query)
      .map((key) => key + '=' + query[key])
      .join('&')
    var lookupData = await this.get<{ docs: SearchDoc[] }>(`/search.json?${queryString}`)
    if (!lookupData) {
      return {
        errorCode: 404 as const
      }
    }
    var searchDocs = await Promise.all(lookupData.docs.map((d) => this.cleanSearchDoc(d)))
    return searchDocs
  }

  /**
   *
   * @param {string} title
   * @param {number} timeout
   * @returns {Promise<Object[]>}
   */
  async searchTitle(title: string, timeout = this.#responseTimeout) {
    title = encodeURIComponent(title)
    var lookupData = await this.get<{ docs: SearchDoc[] }>(`/search.json?title=${title}`, timeout)
    if (!lookupData) {
      return {
        errorCode: 404 as const
      }
    }
    var searchDocs = await Promise.all(lookupData.docs.map((d) => this.cleanSearchDoc(d)))
    return searchDocs
  }
}
export = OpenLibrary
