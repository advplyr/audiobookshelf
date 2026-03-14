const chai = require('chai')
const expect = chai.expect

const {
  createBrowseRequestProfile,
  finishBrowseRequestProfile
} = require('../../../server/utils/queries/libraryBrowseInstrumentation')

describe('libraryBrowseInstrumentation', () => {
  it('records named browse phases and returns a slow-summary payload', () => {
    const timestamps = [
      100,
      110,
      160,
      170,
      200,
      210,
      235,
      240,
      280,
      320
    ]

    const profile = createBrowseRequestProfile({
      route: 'GET /api/libraries/:id/items',
      libraryId: 'lib_1',
      now: () => timestamps.shift()
    })

    profile.mark('rows:start')
    profile.mark('rows:end')
    profile.mark('count:start')
    profile.mark('count:end')
    profile.mark('derived:start')
    profile.mark('derived:end')
    profile.mark('postprocess:start')
    profile.mark('postprocess:end')

    const result = finishBrowseRequestProfile(profile, { slowMs: 150 })

    expect(result).to.deep.equal({
      route: 'GET /api/libraries/:id/items',
      libraryId: 'lib_1',
      totalMs: 220,
      phases: {
        rows: 50,
        count: 30,
        derived: 25,
        postprocess: 40
      },
      isSlow: true
    })
  })
})
