const { expect } = require('chai')
const sinon = require('sinon')
const BookScanner = require('../../../server/scanner/BookScanner')
const BookFinder = require('../../../server/finders/BookFinder')
const Database = require('../../../server/Database')
const CoverManager = require('../../../server/managers/CoverManager')
const AudiobookDBError = require('../../../server/providers/AudiobookDBError')
const { LogLevel } = require('../../../server/utils/constants')

describe('BookScanner cover provider failures', () => {
  let findCoversStub
  let downloadStub
  let libraryScan

  beforeEach(() => {
    sinon.stub(Database, 'serverSettings').value({ scannerCoverProvider: 'audiobookdb' })
    findCoversStub = sinon.stub(BookFinder, 'findCovers')
    downloadStub = sinon.stub(CoverManager, 'downloadCoverFromUrlNew')
    libraryScan = { addLog: sinon.spy() }
  })

  afterEach(() => sinon.restore())

  ;['audiobookdb_key_required', 'audiobookdb_auth', 'audiobookdb_rate_limited', 'audiobookdb_unavailable'].forEach((code) => {
    it(`logs ${code} without aborting the scan or attempting a download`, async () => {
      const failure = new AudiobookDBError(code)
      findCoversStub.rejects(failure)
      const cover = await BookScanner.searchForCover('item1', '/books/item1', 'The Martian', 'Andy Weir', libraryScan)
      expect(cover).to.equal(null)
      sinon.assert.notCalled(downloadStub)
      sinon.assert.calledWithExactly(libraryScan.addLog, LogLevel.ERROR, `AudiobookDB cover search failed: ${code} | ${failure.message}`)
    })
  })

  it('still downloads and returns a cover supplied by the cover search', async () => {
    findCoversStub.resolves(['https://example.org/cover.jpg'])
    downloadStub.resolves({ cover: '/metadata/item1/cover.jpg' })
    const cover = await BookScanner.searchForCover('item1', '/books/item1', 'The Martian', 'Andy Weir', libraryScan)
    expect(cover).to.equal('/metadata/item1/cover.jpg')
    sinon.assert.calledWithExactly(downloadStub, 'https://example.org/cover.jpg', 'item1', '/books/item1')
  })

  it('does not hide unrelated scanner errors as provider misses', async () => {
    const failure = new Error('unexpected scanner failure')
    findCoversStub.rejects(failure)
    let caught
    try {
      await BookScanner.searchForCover('item1', '/books/item1', 'The Martian', 'Andy Weir', libraryScan)
    } catch (error) {
      caught = error
    }
    expect(caught).to.equal(failure)
  })
})
