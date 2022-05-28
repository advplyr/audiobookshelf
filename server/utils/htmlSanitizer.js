const sanitizeHtml = require('../libs/sanitizeHtml')

function sanitize(html) {
  const sanitizerOptions = {
    allowedTags: [
      'p', 'ol', 'ul', 'a', 'strong', 'em'
    ],
    disallowedTagsMode: 'discard',
    allowedAttributes: {
      a: ['href', 'name', 'target']
    },
    allowedSchemes: ['https'],
    allowProtocolRelative: false
  }

  return sanitizeHtml(html, sanitizerOptions)
}
module.exports.sanitize = sanitize

function stripAllTags(html) {
  const sanitizerOptions = {
    allowedTags: [],
    disallowedTagsMode: 'discard'
  }

  return sanitizeHtml(html, sanitizerOptions)
}
module.exports.stripAllTags = stripAllTags