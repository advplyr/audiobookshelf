class FeedMeta {
  constructor(meta) {
    this.title = null
    this.description = null
    this.author = null
    this.imageUrl = null
    this.feedUrl = null
    this.link = null

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
  }

  toJSON() {
    return {
      title: this.title,
      description: this.description,
      author: this.author,
      imageUrl: this.imageUrl,
      feedUrl: this.feedUrl,
      link: this.link
    }
  }

  getPodcastMeta() {
    return {
      title: this.title,
      description: this.description,
      feedUrl: this.feedUrl,
      siteUrl: this.link,
      imageUrl: this.imageUrl,
      author: this.author || 'advplyr',
      language: 'en'
    }
  }
}
module.exports = FeedMeta