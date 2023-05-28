const xml = require('../../libs/xml')

module.exports.generate = (libraryItems, indent = true) => {
  const bodyItems = []
  libraryItems.forEach((item) => {
    if (!item.media.metadata.feedUrl) return
    const feedAttributes = {
      type: 'rss',
      text: item.media.metadata.title,
      title: item.media.metadata.title,
      xmlUrl: item.media.metadata.feedUrl
    }
    if (item.media.metadata.description) {
      feedAttributes.description = item.media.metadata.description
    }
    if (item.media.metadata.itunesPageUrl) {
      feedAttributes.htmlUrl = item.media.metadata.itunesPageUrl
    }
    if (item.media.metadata.language) {
      feedAttributes.language = item.media.metadata.language
    }
    bodyItems.push({
      outline: {
        _attr: feedAttributes
      }
    })
  })

  const data = [
    {
      opml: [
        {
          _attr: {
            version: '1.0'
          }
        },
        {
          head: [
            {
              title: 'Audiobookshelf Podcast Subscriptions'
            }
          ]
        },
        {
          body: bodyItems
        }
      ]
    }
  ]

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml(data, indent)
}