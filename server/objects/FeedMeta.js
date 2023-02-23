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
      language: this.language
    }
  }

  getRSSData() {
    return {
      title: this.title,
      description: this.description || '',
      generator: 'Audiobookshelf',
      feed_url: this.feedUrl,
      site_url: this.link,
      image_url: this.imageUrl,
      custom_namespaces: {
        'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
        'psc': 'http://podlove.org/simple-chapters',
        'podcast': 'https://podcastindex.org/namespace/1.0'
      },
      custom_elements: [
        { 'language': this.language || 'en' },
        { 'author': this.author || 'advplyr' },
        { 'itunes:author': this.author || 'advplyr' },
        { 'itunes:summary': this.description || '' },
        { 'itunes:type': this.type },
        {
          'itunes:image': {
            _attr: {
              href: this.imageUrl
            }
          }
        },
        {
          'itunes:owner': [
            { 'itunes:name': this.author || '' },
            { 'itunes:email': '' }
          ]
        },
        {
          "itunes:explicit": !!this.explicit
        }
      ]
    }
  }
}
module.exports = FeedMeta
