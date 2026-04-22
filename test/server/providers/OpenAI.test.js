const { expect } = require('chai')
const OpenAI = require('../../../server/providers/OpenAI')

describe('OpenAI', () => {
  let openAI

  beforeEach(() => {
    openAI = new OpenAI()
  })

  describe('parseJsonResponse', () => {
    it('parses fenced JSON', () => {
      const payload = openAI.parseJsonResponse('```json\n{"books":[{"id":"1","sequence":"1"}]}\n```')
      expect(payload.books).to.have.length(1)
      expect(payload.books[0].id).to.equal('1')
    })

    it('parses JSON wrapped in extra text', () => {
      const payload = openAI.parseJsonResponse('Result:\n{"books":[{"id":"1","sequence":"1"}]}')
      expect(payload.books[0].sequence).to.equal('1')
    })
  })

  describe('validateSeriesOrderPayload', () => {
    it('normalizes valid ordered books', () => {
      const result = openAI.validateSeriesOrderPayload(
        {
          books: [
            { id: 'b', sequence: '2' },
            { id: 'a', sequence: '1' }
          ]
        },
        [{ id: 'a' }, { id: 'b' }]
      )

      expect(result.map((book) => book.id)).to.deep.equal(['a', 'b'])
    })

    it('rejects duplicate sequences', () => {
      expect(() =>
        openAI.validateSeriesOrderPayload(
          {
            books: [
              { id: 'a', sequence: '1' },
              { id: 'b', sequence: '1' }
            ]
          },
          [{ id: 'a' }, { id: 'b' }]
        )
      ).to.throw('duplicate sequence')
    })
  })

  describe('validateSeriesDetectionPayload', () => {
    it('allows null standalone assignments', () => {
      const result = openAI.validateSeriesDetectionPayload(
        {
          books: [
            { id: 'a', seriesName: null, sequence: null },
            { id: 'b', seriesName: 'Series Name', sequence: '1.5' }
          ]
        },
        [{ id: 'a' }, { id: 'b' }]
      )

      expect(result[0].seriesName).to.equal(null)
      expect(result[1].sequence).to.equal('1.5')
    })

    it('skips a series assignment without sequence', () => {
      const result = openAI.validateSeriesDetectionPayload(
        {
          books: [
            { id: 'a', seriesName: 'Series Name', sequence: null, reason: 'folder match' }
          ]
        },
        [{ id: 'a' }]
      )

      expect(result[0].seriesName).to.equal(null)
      expect(result[0].sequence).to.equal(null)
      expect(result[0].reason).to.contain('skipped due to missing or invalid sequence')
    })

    it('skips a sequence without series name', () => {
      const result = openAI.validateSeriesDetectionPayload(
        {
          books: [
            { id: 'a', seriesName: null, sequence: '2', reason: 'sequence found' }
          ]
        },
        [{ id: 'a' }]
      )

      expect(result[0].seriesName).to.equal(null)
      expect(result[0].sequence).to.equal(null)
      expect(result[0].reason).to.contain('skipped due to missing series name')
    })

    it('ignores unknown ids and backfills missing ids', () => {
      const result = openAI.validateSeriesDetectionPayload(
        {
          books: [
            { id: 'z', seriesName: 'Wrong Series', sequence: '9' },
            { id: 'a', seriesName: 'Series Name', sequence: '1' }
          ]
        },
        [{ id: 'a' }, { id: 'b' }]
      )

      expect(result).to.have.length(2)
      expect(result[0].id).to.equal('a')
      expect(result[0].seriesName).to.equal('Series Name')
      expect(result[1].id).to.equal('b')
      expect(result[1].seriesName).to.equal(null)
      expect(result[1].reason).to.contain('omitted this book')
    })

    it('ignores duplicate ids in detection payload', () => {
      const result = openAI.validateSeriesDetectionPayload(
        {
          books: [
            { id: 'a', seriesName: 'Series Name', sequence: '1' },
            { id: 'a', seriesName: 'Other Series', sequence: '2' }
          ]
        },
        [{ id: 'a' }]
      )

      expect(result).to.have.length(1)
      expect(result[0].seriesName).to.equal('Series Name')
      expect(result[0].sequence).to.equal('1')
    })
  })

  describe('validateScanMetadataPayload', () => {
    it('normalizes valid scan metadata', () => {
      const result = openAI.validateScanMetadataPayload({
        book: {
          title: ' Neuromancer ',
          subtitle: '20th Anniversary Edition',
          authors: ['William Gibson', 'William Gibson'],
          narrators: ['Robertson Dean'],
          seriesName: 'Sprawl Trilogy',
          sequence: '1',
          publishedYear: '1984',
          asin: 'B000FC11ZG',
          isbn: '978-0441569595',
          language: 'English',
          reason: 'path and tags match'
        }
      })

      expect(result.title).to.equal('Neuromancer')
      expect(result.authors).to.deep.equal(['William Gibson'])
      expect(result.seriesName).to.equal('Sprawl Trilogy')
      expect(result.sequence).to.equal('1')
      expect(result.asin).to.equal('B000FC11ZG')
      expect(result.isbn).to.equal('9780441569595')
    })

    it('returns nulls for malformed scan metadata fields', () => {
      const result = openAI.validateScanMetadataPayload({
        title: '',
        authors: [''],
        seriesName: 'Series Name',
        sequence: 'not-a-sequence',
        publishedYear: '84',
        asin: 'bad',
        isbn: 'nope'
      })

      expect(result.title).to.equal(null)
      expect(result.authors).to.deep.equal([])
      expect(result.seriesName).to.equal('Series Name')
      expect(result.sequence).to.equal(null)
      expect(result.publishedYear).to.equal(null)
      expect(result.asin).to.equal(null)
      expect(result.isbn).to.equal(null)
    })
  })

  describe('validateDirectoryGroupingPayload', () => {
    it('normalizes valid directory-grouping payload', () => {
      const result = openAI.validateDirectoryGroupingPayload(
        {
          files: [
            { path: 'Series Alpha/Book One.m4b', groupId: ' book-one ', reason: 'same book' },
            { path: 'Series Alpha/Disc 1/Book Two Part 1.mp3', groupId: 'book-two', reason: 'disc set' }
          ]
        },
        [{ path: 'Series Alpha/Book One.m4b' }, { path: 'Series Alpha/Disc 1/Book Two Part 1.mp3' }]
      )

      expect(result[0].groupId).to.equal('book-one')
      expect(result[1].groupId).to.equal('book-two')
    })

    it('backfills missing or invalid grouping rows', () => {
      const result = openAI.validateDirectoryGroupingPayload(
        {
          files: [
            { path: 'unknown/path.m4b', groupId: 'ignored' },
            { path: 'Series Alpha/Book One.m4b', groupId: '' }
          ]
        },
        [{ path: 'Series Alpha/Book One.m4b' }, { path: 'Series Alpha/Book Two.m4b' }]
      )

      expect(result[0].groupId).to.equal('Series Alpha/Book One.m4b')
      expect(result[1].groupId).to.equal('Series Alpha/Book Two.m4b')
      expect(result[1].reason).to.contain('omitted this media file')
    })
  })
})
