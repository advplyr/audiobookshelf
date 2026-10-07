const chai = require('chai')
const expect = chai.expect
const BookScanner = require('../../../server/scanner/BookScanner')

describe('BookScanner', () => {
  let serverSettings

  beforeEach(() => {
    serverSettings = global.ServerSettings
    global.ServerSettings = { sortingPrefixes: [] }
  })

  afterEach(() => {
    if (serverSettings === undefined) delete global.ServerSettings
    else global.ServerSettings = serverSettings
  })

  describe('getBookMetadataFromScanData', () => {
    it('normalizes an ISO date from audio metadata after sources are applied', async () => {
      const libraryItemData = {
        mediaMetadata: { title: 'Test Book' },
        imageLibraryFiles: []
      }
      const libraryScan = { addLog() {} }

      const metadata = await BookScanner.getBookMetadataFromScanData([{ metaTags: { tagDate: '2013-01-01' }, chapters: [] }], null, libraryItemData, libraryScan, {
        metadataPrecedence: ['audioMetatags']
      })

      expect(metadata.publishedYear).to.equal('2013')
    })
  })
})
