const { expect } = require('chai')
const { entities } = require('../../../server/utils/htmlEntities')
const htmlSanitizer = require('../../../server/utils/htmlSanitizer')

describe('HTML utilities', () => {
  it('preserves CommonJS exports and the mutable entity table', () => {
    expect(Object.keys(require('../../../server/utils/htmlEntities'))).to.deep.equal(['entities'])
    expect(Object.keys(htmlSanitizer)).to.deep.equal(['sanitize', 'stripAllTags'])
    expect(Object.keys(entities)).to.have.length(2231)
    expect(entities['&AMP']).to.equal('&')
    expect(entities['&copy;']).to.equal('©')
    expect(entities['&Afr;']).to.equal('𝔄')
    expect(entities['&NotEqualTilde;']).to.equal('≂̸')
    const original = entities['&amp;']
    try {
      entities['&amp;'] = 'custom'
      expect(htmlSanitizer.stripAllTags('&amp;')).to.equal('custom')
    } finally {
      entities['&amp;'] = original
    }
  })

  it('returns empty strings for non-string inputs', () => {
    for (const input of [undefined, null, false, 42, {}, [], new String('text')]) {
      expect(htmlSanitizer.sanitize(input)).to.equal('')
      expect(htmlSanitizer.stripAllTags(input)).to.equal('')
    }
    expect(htmlSanitizer.sanitize('')).to.equal('')
    expect(htmlSanitizer.stripAllTags('')).to.equal('')
  })

  it('retains allowed formatting and discards scripts and unsupported tags', () => {
    const input = '<p>Hello <strong>world</strong><script>alert(1)</script><img src="x"></p>'
    expect(htmlSanitizer.sanitize(input)).to.equal('<p>Hello <strong>world</strong></p>')
    expect(htmlSanitizer.stripAllTags(input)).to.equal('Hello world')
    expect(htmlSanitizer.stripAllTags('before<div>inside</div>after')).to.equal('beforeinsideafter')
  })

  it('removes unsafe links and attributes while retaining allowed links', () => {
    const input = '<a href="javascript:alert(1)" onclick="evil()">bad</a><a href="//example.com">relative</a><a href="https://example.com" target="_blank">safe</a>'
    expect(htmlSanitizer.sanitize(input)).to.equal('<a>bad</a><a>relative</a><a href="https://example.com" target="_blank">safe</a>')
    expect(htmlSanitizer.sanitize('<a href="mailto:user@example.com" name="email">email</a>')).to.equal('<a href="mailto:user@example.com" name="email">email</a>')
  })

  it('preserves entity handling with decoding enabled and disabled', () => {
    const input = '&amp; &copy; &#65; &#x1F600; &unknown;'
    expect(htmlSanitizer.sanitize(input)).to.equal('&amp; © A 😀 &amp;unknown;')
    expect(htmlSanitizer.stripAllTags(input)).to.equal('& © A 😀 &unknown;')
    expect(htmlSanitizer.stripAllTags(input, false)).to.equal('&amp; © A 😀 &amp;unknown;')
    expect(htmlSanitizer.stripAllTags('&amp without a semicolon')).to.equal('& without a semicolon')
  })

  it('decodes nested entities only once', () => {
    expect(htmlSanitizer.stripAllTags('&amp;copy;')).to.equal('&copy;')
    expect(htmlSanitizer.stripAllTags('&amp;copy;', false)).to.equal('&amp;copy;')
  })
})
