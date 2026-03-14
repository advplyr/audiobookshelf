const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')

const Logger = require('../../../server/Logger')
const {
  createBrowseRequestProfile,
  createBrowsePhaseTiming,
  finishBrowseRequestProfile
} = require('../../../server/utils/queries/libraryBrowseInstrumentation')
const { profile } = require('../../../server/utils/profiler')

describe('libraryBrowseInstrumentation', () => {
  afterEach(() => {
    sinon.restore()
  })

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

  it('accumulates repeated timings for the same phase', () => {
    const timestamps = [100, 110, 140, 150, 190, 210]
    const profile = createBrowseRequestProfile({
      route: 'GET /api/libraries/:id/items',
      libraryId: 'lib_1',
      now: () => timestamps.shift()
    })

    profile.mark('rows:start')
    profile.mark('rows:end')
    profile.mark('rows:start')
    profile.mark('rows:end')

    const result = finishBrowseRequestProfile(profile, { slowMs: 500 })

    expect(result.phases).to.deep.equal({ rows: 70 })
    expect(result.isSlow).to.equal(false)
  })

  it('handles null and partial profiles safely', () => {
    expect(finishBrowseRequestProfile(null, { slowMs: 0 })).to.deep.equal({
      route: null,
      libraryId: null,
      totalMs: 0,
      phases: {},
      isSlow: false
    })

    expect(finishBrowseRequestProfile({ route: 'GET /items', marks: [{ name: 'rows:start', at: 10 }] })).to.deep.equal({
      route: 'GET /items',
      libraryId: null,
      totalMs: 0,
      phases: {},
      isSlow: false
    })
  })

  it('composes caller logging with request-scoped browse timing hooks', async () => {
    const timestamps = [100, 110, 150, 180]
    const browseProfile = createBrowseRequestProfile({
      route: 'GET /api/libraries/:id/items',
      libraryId: 'lib_1',
      now: () => timestamps.shift()
    })
    const callerLogging = sinon.spy()
    const originalFindOptions = {
      where: { id: 'item_1' },
      logging: callerLogging,
      requestTiming: createBrowsePhaseTiming(browseProfile, 'rows')
    }

    const wrappedQuery = profile(async (findOptions) => {
      findOptions.logging('SELECT 1', 12)
      return findOptions
    }, true, 'browseRows')

    const wrappedFindOptions = await wrappedQuery(originalFindOptions)
    const result = finishBrowseRequestProfile(browseProfile, { slowMs: 1000 })

    expect(wrappedFindOptions).to.not.equal(originalFindOptions)
    expect(originalFindOptions).to.not.have.property('benchmark')
    expect(callerLogging.calledOnceWithExactly('SELECT 1', 12)).to.equal(true)
    expect(result.phases).to.deep.equal({ rows: 40 })
  })

  it('bounds retained histogram samples and logs a compact summary instead of full arrays', async () => {
    const loggerInfoStub = sinon.stub(Logger, 'info')
    const wrappedQuery = profile(async () => 'ok', false, 'boundedProfilerQuery')

    for (let i = 0; i < 150; i++) {
      await wrappedQuery()
    }

    const summaryCalls = loggerInfoStub.getCalls().filter((call) => call.args[0] === '[boundedProfilerQuery] histogram summary:')
    const lastSummary = summaryCalls[summaryCalls.length - 1].args[1]

    expect(summaryCalls.length).to.equal(150)
    expect(lastSummary.recentValues).to.have.length.at.most(100)
    expect(lastSummary).to.not.have.property('values')
  })

  it('limits serialized findOptions logging for profiled queries', async () => {
    const loggerInfoStub = sinon.stub(Logger, 'info')
    const wrappedQuery = profile(async (findOptions) => {
      findOptions.logging('SELECT 1', 5)
      return []
    }, true, 'loggedFindOptionsQuery')

    await wrappedQuery({
      where: {
        ids: Array.from({ length: 500 }, (_, index) => `id-${index}`)
      }
    })

    const findOptionsCall = loggerInfoStub.getCalls().find((call) => call.args[0] === '[loggedFindOptionsQuery] findOptions:')

    expect(findOptionsCall.args[1]).to.be.a('string')
    expect(findOptionsCall.args[1].length).to.be.lessThan(2000)
  })
})
