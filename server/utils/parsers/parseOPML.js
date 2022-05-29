const h = require('htmlparser2')
const Logger = require('../../Logger')

function parse(opmlText) {
  var feeds = []
  var parser = new h.Parser({
    onopentag: (name, attribs) => {
      if (name === "outline" && attribs.type === 'rss') {
        if (!attribs.xmlurl) {
          Logger.error('[parseOPML] Invalid opml outline tag has no xmlurl attribute')
        } else {
          feeds.push({
            title: attribs.title || 'No Title',
            text: attribs.text || '',
            feedUrl: attribs.xmlurl
          })
        }
      }
    }
  })
  parser.write(opmlText)
  return feeds
}
module.exports.parse = parse