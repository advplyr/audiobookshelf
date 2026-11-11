const { expect } = require('chai')

const { isValidMobileRedirectURI } = require('../../../server/utils/index')

describe('isValidMobileRedirectURI', () => {
  it('validates mobile redirect URIs', () => {
    const testCases = [
      { uri: 'audiobookshelf://oauth', expected: true },
      { uri: 'https://example.com/path', expected: true },
      { uri: 'my_app://callback', expected: true },
      { uri: 'com.example.app:/oauth2redirect/example-provider', expected: true },
      { uri: 'com.google.android.wear:/3p_auth/com.example.app', expected: true },
      { uri: 'javascript:alert(1)', expected: false },
      { uri: 'https://', expected: false },
      { uri: 'abs:/', expected: false },
      { uri: 'abs:oauth', expected: false },
      { uri: 'abs://host?x=1', expected: false },
      { uri: 'abs://host/a b', expected: false },
      { uri: '', expected: false },
      { uri: null, expected: false }
    ]

    testCases.forEach(({ uri, expected }) => {
      expect(isValidMobileRedirectURI(uri), uri).to.equal(expected)
    })
  })

  it('does not backtrack on long invalid URIs', () => {
    const start = Date.now()
    expect(isValidMobileRedirectURI('a://h' + '/a'.repeat(24) + '!')).to.equal(false)
    expect(isValidMobileRedirectURI('a:/a' + '/a'.repeat(24) + '!')).to.equal(false)
    expect(Date.now() - start).to.be.below(100)
  })
})
