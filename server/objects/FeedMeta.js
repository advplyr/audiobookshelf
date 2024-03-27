/**
 * @openapi
 * components:
 *   schemas:
 *     rssFeedMetadata:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the entity the RSS feed is for.
 *           type: string
 *           example: Welcome to Night Vale
 *         description:
 *           description: The description of the entity the RSS feed is for.
 *           type: [string, 'null']
 *           example: |2-
 * 
 *                     Twice-monthly community updates for the small desert town of Night Vale, where every conspiracy theory is true. Turn on your radio and hide. Never listened before? It's an ongoing radio show. Start with the current episode, and you'll catch on in no time. Or, go right to Episode 1 if you wanna binge-listen.
 *         author:
 *           description: The author of the entity the RSS feed is for.
 *           type: [string, 'null']
 *           example: Night Vale Presents
 *         imageUrl:
 *           description: The URL of the RSS feed's image.
 *           type: string
 *           example: https://abs.example.com/feed/li_bufnnmp4y5o2gbbxfm/cover
 *           format: url
 *         feedUrl:
 *           description: The URL of the RSS feed.
 *           type: string
 *           example: https://abs.example.com/feed/li_bufnnmp4y5o2gbbxfm
 *           format: url
 *         link:
 *           description: The URL of the entity the RSS feed is for.
 *           type: string
 *           example: https://abs.example.com/item/li_bufnnmp4y5o2gbbxfm
 *           format: url
 *         explicit:
 *           description: Whether the RSS feed's contents are explicit.
 *           type: boolean
 *           example: false
 *         type:
 *           description: The type of the RSS feed.
 *           type: [string, 'null']
 *           example: episodic
 *         language:
 *           description: The language of the RSS feed.
 *           type: [string, 'null']
 *           example: en
 *         preventIndexing:
 *           description: Whether the RSS feed is marked to prevent indexing of the feed.
 *           type: boolean
 *           example: true
 *         ownerName:
 *           description: The owner name of the RSS feed.
 *           type: [string, 'null']
 *         ownerEmail:
 *           description: The owner email of the RSS feed.
 *           type: [string, 'null']
 *     rssFeedMetadataMinified:
 *       type: object
 *       properties:
 *         title:
 *           description: The title of the entity the RSS feed is for.
 *           type: string
 *           example: Welcome to Night Vale
 *         description:
 *           description: The description of the entity the RSS feed is for.
 *           type: [string, 'null']
 *           example: |2-
 * 
 *                     Twice-monthly community updates for the small desert town of Night Vale, where every conspiracy theory is true. Turn on your radio and hide. Never listened before? It's an ongoing radio show. Start with the current episode, and you'll catch on in no time. Or, go right to Episode 1 if you wanna binge-listen.
 *         preventIndexing:
 *           description: Whether the RSS feed is marked to prevent indexing of the feed.
 *           type: boolean
 *           example: true
 *         ownerName:
 *           description: The owner name of the RSS feed.
 *           type: [string, 'null']
 *         ownerEmail:
 *           description: The owner email of the RSS feed.
 *           type: [string, 'null']
 */
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

  getRSSData() {
    const blockTags = [
      { 'itunes:block': 'yes' },
      { 'googleplay:block': 'yes' }
    ]
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
        'podcast': 'https://podcastindex.org/namespace/1.0',
        'googleplay': 'http://www.google.com/schemas/play-podcasts/1.0'
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
            { 'itunes:name': this.ownerName || this.author || '' },
            { 'itunes:email': this.ownerEmail || '' }
          ]
        },
        { 'itunes:explicit': !!this.explicit },
        ...(this.preventIndexing ? blockTags : [])
      ]
    }
  }
}
module.exports = FeedMeta
