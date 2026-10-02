import xml from '../../libs/xml'
import escapeForXMLImport from '../../libs/xml/escapeForXML'

type XmlText = string | null | undefined

// escapeForXML.js has no annotations, so its inferred signature is any.
type EscapeForXML = (value: XmlText) => XmlText
const escapeForXML: EscapeForXML = escapeForXMLImport

type OpmlPodcast = {
  feedURL?: string | null
  title?: string | null
  description?: string | null
  itunesPageUrl?: string | null
  language?: string | null
}

type FeedAttributes = {
  type: 'rss'
  text: XmlText
  title: XmlText
  xmlUrl: XmlText
  description?: XmlText
  htmlUrl?: XmlText
  language?: XmlText
}

/**
 * Generate an OPML file string for podcasts in a library.
 */
export function generate(podcasts: OpmlPodcast[], indent = true): string {
  const bodyItems: { outline: { _attr: FeedAttributes } }[] = []
  podcasts.forEach((podcast) => {
    if (!podcast.feedURL) return
    const feedAttributes: FeedAttributes = {
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

  // xml() returns a Stream only when options.stream is set. A boolean indent returns the document string.
  const rendered = xml(data, indent) as string
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + rendered
}
