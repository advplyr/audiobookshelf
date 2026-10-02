import { Parser } from 'htmlparser2'
import Logger from '../../Logger'

type OpmlFeed = {
  title: string
  feedUrl: string
}

/**
 * Parse OPML text into RSS feed outlines.
 */
export function parse(opmlText: string): OpmlFeed[] {
  const feeds: OpmlFeed[] = []
  const parser = new Parser({
    onopentag: (name, attribs) => {
      if (name === 'outline' && attribs.type === 'rss') {
        if (!attribs.xmlurl) {
          Logger.error('[parseOPML] Invalid opml outline tag has no xmlurl attribute')
        } else {
          feeds.push({
            title: attribs.title || attribs.text || '',
            feedUrl: attribs.xmlurl
          })
        }
      }
    }
  })
  parser.write(opmlText)
  return feeds
}
