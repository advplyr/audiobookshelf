class FeedMeta {
  constructor(meta) {
    this.title = null
    this.description = null
    this.author = null
    this.imageUrl = null
    this.feedUrl = null
    this.link = null
    this.explicit = null
    this.type = null
    this.language = null
    this.preventIndexing = null
    this.ownerName = null
    this.ownerEmail = null

    if (meta) {
      this.construct(meta)
    }
  }

  construct(meta) {
    this.title = meta.title
    this.description = meta.description
    this.author = meta.author
    this.imageUrl = meta.imageUrl
    this.feedUrl = meta.feedUrl
    this.link = meta.link
    this.explicit = meta.explicit
    this.type = meta.type
    this.language = meta.language
    this.preventIndexing = meta.preventIndexing
    this.ownerName = meta.ownerName
    this.ownerEmail = meta.ownerEmail
  }

  toJSON() {
    return {
      title: this.title,
      description: this.description,
      author: this.author,
      imageUrl: this.imageUrl,
      feedUrl: this.feedUrl,
      link: this.link,
      explicit: this.explicit,
      type: this.type,
      language: this.language,
      preventIndexing: this.preventIndexing,
      ownerName: this.ownerName,
      ownerEmail: this.ownerEmail
    }
  }

  toJSONMinified() {
    return {
      title: this.title,
      description: this.description,
      preventIndexing: this.preventIndexing,
      ownerName: this.ownerName,
      ownerEmail: this.ownerEmail
    }
  }
}
module.exports = FeedMeta
