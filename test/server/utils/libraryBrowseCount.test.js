const chai = require('chai')
const expect = chai.expect

const { loadBrowseCount } = require('../../../server/utils/queries/libraryBrowseCount')

describe('libraryBrowseCount', () => {
  it('returns deferred exact count metadata on first chunk', async () => {
    const payload = await loadBrowseCount({
      mode: 'deferred-exact',
      exactCountLoader: async () => 123
    })

    expect(payload).to.deep.equal({ total: 123, isExact: true, isDeferred: true })
  })

  it('skips exact count work on follow-up endless-scroll chunks', async () => {
    let called = false
    const payload = await loadBrowseCount({
      mode: 'skip',
      exactCountLoader: async () => {
        called = true
        return 123
      }
    })

    expect(payload).to.deep.equal({ total: null, isExact: false, isDeferred: true })
    expect(called).to.equal(false)
  })
})
