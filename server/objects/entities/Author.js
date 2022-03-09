class Author {
  constructor(author) {
    this.id = null
    this.asin = null
    this.name = null
    this.imagePath = null
    this.imageFullPath = null
    this.addedAt = null
    this.updatedAt = null

    if (author) {
      this.construct(author)
    }
  }

  construct(author) {
    this.id = author.id
    this.asin = author.asin
    this.name = author.name
    this.imagePath = author.imagePath
    this.imageFullPath = author.imageFullPath
    this.addedAt = author.addedAt
    this.updatedAt = author.updatedAt
  }

  toJSON() {
    return {
      id: this.id,
      asin: this.asin,
      name: this.name,
      imagePath: this.imagePath,
      imageFullPath: this.imageFullPath,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }

  toJSONMinimal() {
    return {
      id: this.id,
      name: this.name
    }
  }
}
module.exports = Author