const { getId } = require('../../utils/index')
const Logger = require('../../Logger')

class Author {
  constructor(author = null) {
    this.id = null
    this.name = null
    this.description = null
    this.asin = null
    this.image = null
    this.imageFullPath = null

    this.createdAt = null
    this.lastUpdate = null

    if (author) {
      this.construct(author)
    }
  }

  construct(author) {
    this.id = author.id
    this.name = author.name
    this.description = author.description
    this.asin = author.asin
    this.image = author.image
    this.imageFullPath = author.imageFullPath

    this.createdAt = author.createdAt
    this.lastUpdate = author.lastUpdate
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      asin: this.asin,
      image: this.image,
      imageFullPath: this.imageFullPath,
      createdAt: this.createdAt,
      lastUpdate: this.lastUpdate
    }
  }

  setData(data) {
    this.id = data.id ? data.id : getId('per')
    this.name = data.name
    this.description = data.description
    this.asin = data.asin || null
    this.image = data.image || null
    this.imageFullPath = data.imageFullPath || null
    this.createdAt = Date.now()
    this.lastUpdate = Date.now()
  }

  update(payload) {
    var hasUpdates = false
    for (const key in payload) {
      if (this[key] === undefined) continue;
      if (this[key] !== payload[key]) {
        hasUpdates = true
        this[key] = payload[key]
      }
    }
    if (hasUpdates) {
      this.lastUpdate = Date.now()
    }
    return hasUpdates
  }
}
module.exports = Author