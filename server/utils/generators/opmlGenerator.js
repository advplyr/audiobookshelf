const xml = require('../../libs/xml')
const escapeForXML = require('../../libs/xml/escapeForXML')

/**
 * Generate OPML file string for podcasts in a library
 * @param {import('../../models/Podcast')[]} podcasts 
 * @param {boolean} [indent=true] 
 * @returns {string}
 */
module.exports.generate = (podcasts, indent = true) => {
  const bodyItems = []
  podcasts.forEach((podcast) => {
    if (!podcast.feedURL) return
    const feedAttributes = {
      type: 'rss',
      text: escapeForXML(podcast.title),
      title: escapeForXML(podcast.title),
      xmlUrl: escapeForXML(podcast.feedURL)
    }
    if (podcast.description) {
      feedAttributes.description = escapeForXML(podcast.description)
    }
    if (podcast.itunesPageUrl) {
      feedAttributes.htmlUrl = escapeForXML(podcast.itunesPageUrl)
    }
    if (podcast.language) {
      feedAttributes.language = escapeForXML(podcast.language)
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