const Logger = require('../../Logger')
const { getId } = require('../../utils/index')

class Author {
  constructor(author) {
    this.id = null
    this.asin = null
    this.name = null
    this.description = null
    this.imagePath = null
    this.relImagePath = null
    this.addedAt = null
    this.updatedAt = null

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
    this.relImagePath = author.relImagePath
    this.addedAt = author.addedAt
    this.updatedAt = author.updatedAt
  }

  toJSON() {
    return {
      id: this.id,
      asin: this.asin,
      name: this.name,
      description: this.description,
      imagePath: this.imagePath,
      relImagePath: this.relImagePath,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }

  toJSONExpanded(numBooks = 0) {
    var json = this.toJSON()
    json.numBooks = numBooks
    return json
  }

  toJSONMinimal() {
    return {
      id: this.id,
      name: this.name
    }
  }

  setData(data) {
    this.id = getId('aut')
    this.name = data.name
    this.description = data.description || null
    this.asin = data.asin || null
    this.imagePath = data.imagePath || null
    this.relImagePath = data.relImagePath || null
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }

  update(payload) {
    var json = this.toJSON()
    delete json.id
    delete json.addedAt
    delete json.updatedAt
    var hasUpdates = false
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
    return this.name.toLowerCase() == name.toLowerCase().trim()
  }
}
module.exports = Author