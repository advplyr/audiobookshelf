const Logger = require('../../Logger')
const uuidv4 = require("uuid").v4
const { checkNamesAreEqual, nameToLastFirst } = require('../../utils/parsers/parseNameString')

class Author {
  constructor(author) {
    this.id = null
    this.asin = null
    this.name = null
    this.description = null
    this.imagePath = null
    this.addedAt = null
    this.updatedAt = null
    this.libraryId = null

    if (author) {
      this.construct(author)
    }
  }

  construct(author) {
    this.id = author.id
    this.asin = author.asin
    this.name = author.name || ''
    this.description = author.description || null
    this.imagePath = author.imagePath
    this.addedAt = author.addedAt
    this.updatedAt = author.updatedAt
    this.libraryId = author.libraryId
  }

  get lastFirst() {
    if (!this.name) return ''
    return nameToLastFirst(this.name)
  }

  toJSON() {
    return {
      id: this.id,
      asin: this.asin,
      name: this.name,
      description: this.description,
      imagePath: this.imagePath,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      libraryId: this.libraryId
    }
  }

  toJSONExpanded(numBooks = 0) {
    const json = this.toJSON()
    json.numBooks = numBooks
    return json
  }

  toJSONMinimal() {
    return {
      id: this.id,
      name: this.name
    }
  }

  setData(data, libraryId) {
    this.id = uuidv4()
    if (!data.name) {
      Logger.error(`[Author] setData: Setting author data without a name`, data)
    }
    this.name = data.name || ''
    this.description = data.description || null
    this.asin = data.asin || null
    this.imagePath = data.imagePath || null
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
    this.libraryId = libraryId
  }

  update(payload) {
    const json = this.toJSON()
    delete json.id
    delete json.addedAt
    delete json.updatedAt
    let hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined && json[key] != payload[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    }
    return hasUpdates
  }

  checkNameEquals(name) {
    if (!name) return false
    if (this.name === null) {
      Logger.error(`[Author] Author name is null (${this.id})`)
      return false
    }
    return checkNamesAreEqual(this.name, name)
  }
}
module.exports = Author