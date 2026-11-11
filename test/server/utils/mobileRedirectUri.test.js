const { expect } = require('chai')

const { isValidMobileRedirectUri } = require('../../../server/utils/mobileRedirectUri')

// The pattern before RFC 8252 forms were allowed.
const oldPattern = /^\w+:\/\/[\w.-]+(\/[\w./-]*)*$/i

describe('isValidMobileRedirectUri', () => {
  it('accepts scheme://host/path', () => {
    for (const uri of ['audiobookshelf://oauth', 'https://example.com/path', 'my+app://cb', 'my_app://cb', 'App://OAuth', 'https://wear.googleapis.com/3p_auth/com.example.app']) {
      expect(isValidMobileRedirectUri(uri), uri).to.equal(true)
    }
  })

  it('accepts RFC 8252 private-use schemes', () => {
    for (const uri of ['com.example.app:/oauth2redirect/example-provider', 'com.example.app:/callback', 'com.google.android.wear:/3p_auth/com.example.app', 'com.example.app://callback']) {
      expect(isValidMobileRedirectUri(uri), uri).to.equal(true)
    }
  })

  it('rejects anything else', () => {
    for (const uri of ['*', '', 'javascript:alert(1)', 'https://', 'abs:', 'abs:/', 'abs:oauth', 'abs://host?x=1', 'abs://host#x', 'abs://host/a b', '.abs://host', 'abs:/?x', null, undefined, 42, ['abs://oauth']]) {
      expect(isValidMobileRedirectUri(uri), String(uri)).to.equal(false)
    }
  })

  it('accepts everything the old pattern accepted', () => {
    const parts = ['a', 'b.', '-', '/', '//', '_', 'Z9', '.']
    const tried = []
    for (const a of parts) for (const b of parts) for (const c of parts) tried.push(`x://h${a}${b}${c}`, `x://${a}${b}${c}`)
    for (const uri of tried) {
      if (oldPattern.test(uri)) expect(isValidMobileRedirectUri(uri), uri).to.equal(true)
    }
  })

  it('does not backtrack on near-miss input', () => {
    // Takes seconds with a backtracking pattern, well under a millisecond without
    for (const uri of ['a://h' + '/a'.repeat(24) + '!', 'a:/a' + '/a'.repeat(24) + '!']) {
      const start = Date.now()
      expect(isValidMobileRedirectUri(uri), uri).to.equal(false)
      expect(Date.now() - start, uri).to.be.below(100)
    }
  })
})
