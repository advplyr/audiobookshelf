const axios = require('axios')
const Logger = require('../Logger')

class FantLab {
  // 7 - other
  // 11 - essay
  // 12 - article
  // 22 - disser
  // 23 - monography
  // 24 - study
  // 25 - encyclopedy
  // 26 - magazine
  // 46 - sketch
  // 47 - reportage
  // 49 - excerpt
  // 51 - interview
  // 52 - review
  // 55 - libretto
  // 56 - anthology series
  // 57 - newspaper
  // types can get here https://api.fantlab.ru/config.json
  _filterWorkType = [7, 11, 12, 22, 23, 24, 25, 26, 46, 47, 49, 51, 52, 55, 56, 57]
  _baseUrl = 'https://api.fantlab.ru'

  constructor() { }

  async search(title, author) {
    let searchString = encodeURIComponent(title)
    if (author) {
      searchString += encodeURIComponent(' ' + author)
    }
    const url = `${this._baseUrl}/search-works?q=${searchString}&page=1&onlymatches=1`
    Logger.debug(`[FantLab] Search url: ${url}`)
    const items = await axios.get(url).then((res) => {
      return res.data || []
    }).catch(error => {
      Logger.error('[FantLab] search error', error)
      return []
    })

    return Promise.all(items.map(async item => await this.getWork(item))).then(resArray => {
      return resArray.filter(res => res != null)
    })
  }

  async getWork(item) {
    const { work_id, work_type_id } = item

    if (this._filterWorkType.includes(work_type_id)) {
      return { title: null }
    }

    const url = `${this._baseUrl}/work/${work_id}/extended`
    const bookData = await axios.get(url).then((resp) => {
      return resp.data || null
    }).catch((error) => {
      Logger.error(`[FantLab] work info reques error`, error)
      return null
    })

    return this.cleanBookData(bookData)
  }

  async cleanBookData(bookData) {
    let { authors, work_name_alts, work_id, work_name, work_year, work_description, image, classificatory, editions_blocks } = bookData

    const subtitle = Array.isArray(work_name_alts) ? work_name_alts[0] : null
    const auth = authors.map(function (author) {
      return author.name
    })

    const genres = classificatory ? this.tryGetGenres(classificatory) : []

    const imageAndIsbn = await this.tryGetCoverFromEditions(editions_blocks)

    if (imageAndIsbn) {
      var { imageUrl, isbn } = imageAndIsbn

      if (imageUrl) {
        image = imageUrl
      }
    }

    const cover = 'https://fantlab.ru' + image

    return {
      id: work_id,
      title: work_name,
      subtitle: subtitle || null,
      author: auth ? auth.join(', ') : null,
      publisher: null,
      publishedYear: work_year,
      description: work_description,
      cover: image ? cover : null,
      genres: genres,
      isbn: isbn
    }
  }

  tryGetGenres(classificatory) {
    const { genre_group } = classificatory
    if (!genre_group) {
      return []
    }
    const genresGroup = genre_group.find(group => group.genre_group_id == 1) // genres and subgenres

    // genre_group_id=2 - General Characteristics
    // genre_group_id=3 - Arena
    // genre_group_id=4 - Duration of action
    // genre_group_id=6 - Story moves
    // genre_group_id=7 - Story linearity
    // genre_group_id=5 - Recommended age of the reader

    if (!genresGroup) return []

    const { genre } = genresGroup
    const rootGenre = genre[0]

    const { label } = rootGenre

    return [label].concat(this.tryGetSubGenres(rootGenre))
  }

  tryGetSubGenres(rootGenre) {
    const { genre } = rootGenre
    return genre ? genre.map(genreObj => genreObj.label) : []
  }

  async tryGetCoverFromEditions(editions) {

    if (!editions) {
      return null
    }

    let bookEditions = editions['30'] // try get audiobooks first
    if (!bookEditions) {
      bookEditions = editions['10'] // paper editions in ru lang
    }

    if (!bookEditions) {
      return null
    }

    const { list } = bookEditions

    const lastEdition = list[list.length - 1]

    const editionId = lastEdition['edition_id']
    const isbn = lastEdition['isbn'] // get only from paper edition

    return {
      imageUrl: await this.getCoverFromEdition(editionId),
      isbn: isbn
    }
  }

  async getCoverFromEdition(editionId) {
    const url = `${this._baseUrl}/edition/${editionId}`

    const editionInfo = await axios.get(url).then((resp) => {
      return resp.data || null
    }).catch(error => {
      Logger.error('[FantLab] search cover from edition error', error)
      return null
    })

    return editionInfo ? editionInfo['image'] : null
  }

}

module.exports = FantLab