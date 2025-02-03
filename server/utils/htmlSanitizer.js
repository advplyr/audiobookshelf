const sanitizeHtml = require('../libs/sanitizeHtml')
const { entities } = require('./htmlEntities')

/**
 *
 * @param {string} html
 * @returns {string}
 * @throws {Error} if input is not a string
 */
function sanitize(html) {
  if (typeof html !== 'string') {
    throw new Error('sanitizeHtml: input must be a string')
  }

  const sanitizerOptions = {
    allowedTags: ['p', 'ol', 'ul', 'li', 'a', 'strong', 'em', 'del', 'br', 'b', 'i'],
    disallowedTagsMode: 'discard',
    allowedAttributes: {
      a: ['href', 'name', 'target']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false
  }

  return sanitizeHtml(html, sanitizerOptions)
}
module.exports.sanitize = sanitize

function stripAllTags(html, shouldDecodeEntities = true) {
  const sanitizerOptions = {
    allowedTags: [],
    disallowedTagsMode: 'discard'
  }

  let sanitized = sanitizeHtml(html, sanitizerOptions)
  return shouldDecodeEntities ? decodeHTMLEntities(sanitized) : sanitized
}
module.exports.stripAllTags = stripAllTags

function decodeHTMLEntities(strToDecode) {
  return strToDecode.replace(/\&([^;]+);?/g, function (entity) {
    if (entity in entities) {
      return entities[entity]
    }
    return entity
  })
}
