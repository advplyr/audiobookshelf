const sinon = require('sinon')
const chai = require('chai')
const expect = chai.expect
const bookFinder = require('../../../server/finders/BookFinder')
const { LogLevel } = require('../../../server/utils/constants')
const Logger = require('../../../server/Logger')
Logger.setLogLevel(LogLevel.INFO)
const { levenshteinDistance } = require('../../../server/utils/index')

// levenshteinDistance is needed for manual calculation of expected scores in tests.
// Assuming it's accessible for testing purposes or we mock/replicate its basic behavior if needed.
// For now, we'll assume bookFinder.search uses it internally correctly.
// const { levenshteinDistance } = require('../../../server/utils/index') // Not used directly in test logic, but for reasoning.

describe('TitleCandidates', () => {
  describe('cleanAuthor non-empty', () => {
    let titleCandidates
    const cleanAuthor = 'leo tolstoy'

    beforeEach(() => {
      titleCandidates = new bookFinder.constructor.TitleCandidates(cleanAuthor)
    })

    describe('no adds', () => {
      it('returns no candidates', () => {
        expect(titleCandidates.getCandidates()).to.deep.equal([])
      })
    })

    describe('single add', () => {
      ;[
        ['adds candidate', 'anna karenina', ['anna karenina']],
        ['adds lowercased candidate', 'ANNA KARENINA', ['anna karenina']],
        ['adds candidate, removing redundant spaces', 'anna    karenina', ['anna karenina']],
        ['adds candidate, removing author', `anna karenina by ${cleanAuthor}`, ['anna karenina']],
        ['does not add empty candidate after removing author', cleanAuthor, []],
        ['adds candidate, removing subtitle', 'anna karenina: subtitle', ['anna karenina']],
        ['adds candidate + variant, removing "by ..."', 'anna karenina by arnold schwarzenegger', ['anna karenina', 'anna karenina by arnold schwarzenegger']],
        ['adds candidate + variant, removing bitrate', 'anna karenina 64kbps', ['anna karenina', 'anna karenina 64kbps']],
        ['adds candidate + variant, removing edition 1', 'anna karenina 2nd edition', ['anna karenina', 'anna karenina 2nd edition']],
        ['adds candidate + variant, removing edition 2', 'anna karenina 4th ed.', ['anna karenina', 'anna karenina 4th ed.']],
        ['adds candidate + variant, removing fie type', 'anna karenina.mp3', ['anna karenina', 'anna karenina.mp3']],
        ['adds candidate + variant, removing "a novel"', 'anna karenina a novel', ['anna karenina', 'anna karenina a novel']],
        ['adds candidate + variant, removing "abridged"', 'abridged anna karenina', ['anna karenina', 'abridged anna karenina']],
        ['adds candidate + variant, removing "unabridged"', 'anna karenina unabridged', ['anna karenina', 'anna karenina unabridged']],
        ['adds candidate + variant, removing preceding/trailing numbers', '1 anna karenina 2', ['anna karenina', '1 anna karenina 2']],
        ['does not add empty candidate', '', []],
        ['does not add spaces-only candidate', '   ', []],
        ['does not add empty variant', '1984', ['1984']]
      ].forEach(([name, title, expected]) =>
        it(name, () => {
          titleCandidates.add(title)
          expect(titleCandidates.getCandidates()).to.deep.equal(expected)
        })
      )
    })

    describe('multiple adds', () => {
      ;[
        ['demotes digits-only candidates', ['01', 'anna karenina'], ['anna karenina', '01']],
        ['promotes transformed variants', ['title1 1', 'title2 1'], ['title1', 'title2', 'title1 1', 'title2 1']],
        ['orders by position', ['title2', 'title1'], ['title2', 'title1']],
        ['dedupes candidates', ['title1', 'title1'], ['title1']]
      ].forEach(([name, titles, expected]) =>
        it(name, () => {
          for (const title of titles) titleCandidates.add(title)
          expect(titleCandidates.getCandidates()).to.deep.equal(expected)
        })
      )
    })
  })

  describe('cleanAuthor empty', () => {
    let titleCandidates
    let cleanAuthor = ''

    beforeEach(() => {
      titleCandidates = new bookFinder.constructor.TitleCandidates(cleanAuthor)
    })

    describe('single add', () => {
      ;[['adds a candidate', 'leo tolstoy', ['leo tolstoy']]].forEach(([name, title, expected]) =>
        it(name, () => {
          titleCandidates.add(title)
          expect(titleCandidates.getCandidates()).to.deep.equal(expected)
        })
      )
    })
  })
})

describe('AuthorCandidates', () => {
  let authorCandidates
  const audnexus = {
    authorASINsRequest: sinon.stub().resolves([{ name: 'Leo Tolstoy' }, { name: 'Nikolai Gogol' }, { name: 'J. K. Rowling' }])
  }

  describe('cleanAuthor is null', () => {
    beforeEach(() => {
      authorCandidates = new bookFinder.constructor.AuthorCandidates(null, audnexus)
    })

    describe('no adds', () => {
      ;[['returns empty author candidate', []]].forEach(([name, expected]) =>
        it(name, async () => {
          expect(await authorCandidates.getCandidates()).to.deep.equal([...expected, ''])
        })
      )
    })

    describe('single add', () => {
      ;[
        ['adds recognized candidate', 'nikolai gogol', ['nikolai gogol']],
        ['does not add unrecognized candidate', 'fyodor dostoevsky', []],
        ['adds recognized author if candidate is a superstring', 'dr. nikolai gogol', ['nikolai gogol']],
        ['adds candidate if it is a substring of recognized author', 'gogol', ['gogol']],
        ['adds recognized author if edit distance from candidate is small', 'nicolai gogol', ['nikolai gogol']],
        ['does not add candidate if edit distance from any recognized author is large', 'nikolai google', []],
        ['adds normalized recognized candidate (contains redundant spaces)', 'nikolai    gogol', ['nikolai gogol']],
        ['adds normalized recognized candidate (et al removed)', 'nikolai gogol et al.', ['nikolai gogol']],
        ['adds normalized recognized candidate (normalized initials)', 'j.k. rowling', ['j. k. rowling']]
      ].forEach(([name, author, expected]) =>
        it(name, async () => {
          authorCandidates.add(author)
          expect(await authorCandidates.getCandidates()).to.deep.equal([...expected, ''])
        })
      )
    })

    describe('multi add', () => {
      ;[
        ['adds recognized author candidates', ['nikolai gogol', 'leo tolstoy'], ['nikolai gogol', 'leo tolstoy']],
        ['dedupes author candidates', ['nikolai gogol', 'nikolai gogol'], ['nikolai gogol']]
      ].forEach(([name, authors, expected]) =>
        it(name, async () => {
          for (const author of authors) authorCandidates.add(author)
          expect(await authorCandidates.getCandidates()).to.deep.equal([...expected, ''])
        })
      )
    })
  })

  describe('cleanAuthor is a recognized author', () => {
    const cleanAuthor = 'leo tolstoy'

    beforeEach(() => {
      authorCandidates = new bookFinder.constructor.AuthorCandidates(cleanAuthor, audnexus)
    })

    describe('no adds', () => {
      ;[['adds cleanAuthor as candidate', [cleanAuthor]]].forEach(([name, expected]) =>
        it(name, async () => {
          expect(await authorCandidates.getCandidates()).to.deep.equal([...expected, ''])
        })
      )
    })

    describe('single add', () => {
      ;[
        ['adds recognized candidate', 'nikolai gogol', [cleanAuthor, 'nikolai gogol']],
        ['does not add candidate if it is a dupe of cleanAuthor', cleanAuthor, [cleanAuthor]]
      ].forEach(([name, author, expected]) =>
        it(name, async () => {
          authorCandidates.add(author)
          expect(await authorCandidates.getCandidates()).to.deep.equal([...expected, ''])
        })
      )
    })
  })

  describe('cleanAuthor is an unrecognized author', () => {
    const cleanAuthor = 'Fyodor Dostoevsky'

    beforeEach(() => {
      authorCandidates = new bookFinder.constructor.AuthorCandidates(cleanAuthor, audnexus)
    })

    describe('no adds', () => {
      ;[['adds cleanAuthor as candidate', [cleanAuthor]]].forEach(([name, expected]) =>
        it(name, async () => {
          expect(await authorCandidates.getCandidates()).to.deep.equal([...expected, ''])
        })
      )
    })

    describe('single add', () => {
      ;[
        ['adds recognized candidate and removes cleanAuthor', 'nikolai gogol', ['nikolai gogol']],
        ['does not add unrecognized candidate', 'jackie chan', [cleanAuthor]]
      ].forEach(([name, author, expected]) =>
        it(name, async () => {
          authorCandidates.add(author)
          expect(await authorCandidates.getCandidates()).to.deep.equal([...expected, ''])
        })
      )
    })
  })

  describe('cleanAuthor is unrecognized and dirty', () => {
    describe('no adds', () => {
      ;[
        ['adds aggressively cleaned cleanAuthor', 'fyodor dostoevsky, translated by jackie chan', ['fyodor dostoevsky']],
        ['adds cleanAuthor if aggresively cleaned cleanAuthor is empty', ', jackie chan', [', jackie chan']]
      ].forEach(([name, cleanAuthor, expected]) =>
        it(name, async () => {
          authorCandidates = new bookFinder.constructor.AuthorCandidates(cleanAuthor, audnexus)
          expect(await authorCandidates.getCandidates()).to.deep.equal([...expected, ''])
        })
      )
    })

    describe('single add', () => {
      ;[['adds recognized candidate and removes cleanAuthor', 'fyodor dostoevsky, translated by jackie chan', 'nikolai gogol', ['nikolai gogol']]].forEach(([name, cleanAuthor, author, expected]) =>
        it(name, async () => {
          authorCandidates = new bookFinder.constructor.AuthorCandidates(cleanAuthor, audnexus)
          authorCandidates.add(author)
          expect(await authorCandidates.getCandidates()).to.deep.equal([...expected, ''])
        })
      )
    })
  })
})

describe('search', () => {
  const t = 'title'
  const a = 'author'
  const u = 'unrecognized'
  const r = ['book']

  let runSearchStub
  let audnexusStub

  beforeEach(() => {
    runSearchStub = sinon.stub(bookFinder, 'runSearch')
    runSearchStub.resolves([])
    runSearchStub.withArgs(t, a).resolves(r)
    runSearchStub.withArgs(t, u).resolves(r)

    audnexusStub = sinon.stub(bookFinder.audnexus, 'authorASINsRequest')
    audnexusStub.resolves([{ name: a }])
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('search title is empty', () => {
    it('returns empty result', async () => {
      expect(await bookFinder.search(null, '', '', a)).to.deep.equal([])
      sinon.assert.callCount(bookFinder.runSearch, 0)
    })
  })

  describe('search title is a recognized title and search author is a recognized author', () => {
    it('returns non-empty result (no fuzzy searches)', async () => {
      expect(await bookFinder.search(null, '', t, a)).to.deep.equal(r)
      sinon.assert.callCount(bookFinder.runSearch, 1)
    })
  })

  describe('search title contains recognized title and search author is a recognized author', () => {
    ;[[`${t} -`], [`${t} - ${a}`], [`${a} - ${t}`], [`${t}- ${a}`], [`${t} -${a}`], [`${t} ${a}`], [`${a} - ${t} (unabridged)`], [`${a} - ${t} (subtitle) - mp3`], [`${t} {narrator} - series-01 64kbps 10:00:00`], [`${a} - ${t} (2006) narrated by narrator [unabridged]`], [`${t} - ${a} 2022 mp3`], [`01 ${t}`], [`2022_${t}_HQ`]].forEach(([searchTitle]) => {
      it(`search('${searchTitle}', '${a}') returns non-empty result (with 1 fuzzy search)`, async () => {
        expect(await bookFinder.search(null, '', searchTitle, a)).to.deep.equal(r)
        sinon.assert.callCount(bookFinder.runSearch, 2)
      })
    })
    ;[[`s-01 - ${t} (narrator) 64kbps 10:00:00`], [`${a} - series 01 - ${t}`]].forEach(([searchTitle]) => {
      it(`search('${searchTitle}', '${a}') returns non-empty result (with 2 fuzzy searches)`, async () => {
        expect(await bookFinder.search(null, '', searchTitle, a)).to.deep.equal(r)
        sinon.assert.callCount(bookFinder.runSearch, 3)
      })
    })
    ;[[`${t}-${a}`], [`${t} junk`]].forEach(([searchTitle]) => {
      it(`search('${searchTitle}', '${a}') returns an empty result`, async () => {
        expect(await bookFinder.search(null, '', searchTitle, a)).to.deep.equal([])
      })
    })

    describe('maxFuzzySearches = 0', () => {
      ;[[`${t} - ${a}`]].forEach(([searchTitle]) => {
        it(`search('${searchTitle}', '${a}') returns an empty result (with no fuzzy searches)`, async () => {
          expect(await bookFinder.search(null, '', searchTitle, a, null, null, { maxFuzzySearches: 0 })).to.deep.equal([])
          sinon.assert.callCount(bookFinder.runSearch, 1)
        })
      })
    })

    describe('maxFuzzySearches = 1', () => {
      ;[[`s-01 - ${t} (narrator) 64kbps 10:00:00`], [`${a} - series 01 - ${t}`]].forEach(([searchTitle]) => {
        it(`search('${searchTitle}', '${a}') returns an empty result (1 fuzzy search)`, async () => {
          expect(await bookFinder.search(null, '', searchTitle, a, null, null, { maxFuzzySearches: 1 })).to.deep.equal([])
          sinon.assert.callCount(bookFinder.runSearch, 2)
        })
      })
    })
  })

  describe('search title contains recognized title and search author is empty', () => {
    ;[[`${t} - ${a}`], [`${a} - ${t}`]].forEach(([searchTitle]) => {
      it(`search('${searchTitle}', '') returns a non-empty result (1 fuzzy search)`, async () => {
        expect(await bookFinder.search(null, '', searchTitle, '')).to.deep.equal(r)
        sinon.assert.callCount(bookFinder.runSearch, 2)
      })
    })
    ;[[`${t}`], [`${t} - ${u}`], [`${u} - ${t}`]].forEach(([searchTitle]) => {
      it(`search('${searchTitle}', '') returns an empty result`, async () => {
        expect(await bookFinder.search(null, '', searchTitle, '')).to.deep.equal([])
      })
    })
  })

  describe('search title contains recognized title and search author is an unrecognized author', () => {
    ;[[`${t} - ${u}`], [`${u} - ${t}`]].forEach(([searchTitle]) => {
      it(`search('${searchTitle}', '${u}') returns a non-empty result (1 fuzzy search)`, async () => {
        expect(await bookFinder.search(null, '', searchTitle, u)).to.deep.equal(r)
        sinon.assert.callCount(bookFinder.runSearch, 2)
      })
    })
    ;[[`${t}`]].forEach(([searchTitle]) => {
      it(`search('${searchTitle}', '${u}') returns a non-empty result (no fuzzy search)`, async () => {
        expect(await bookFinder.search(null, '', searchTitle, u)).to.deep.equal(r)
        sinon.assert.callCount(bookFinder.runSearch, 1)
      })
    })
  })

  describe('search provider results have duration', () => {
    const libraryItem = { media: { duration: 60 * 1000 } }
    const provider = 'audible'
    const unsorted = [{ duration: 3000 }, { duration: 2000 }, { duration: 1000 }, { duration: 500 }]
    const sorted = [{ duration: 1000 }, { duration: 500 }, { duration: 2000 }, { duration: 3000 }]

    beforeEach(() => {
      runSearchStub.withArgs(t, a, provider).resolves(structuredClone(unsorted))
    })

    afterEach(() => {
      sinon.restore()
    })

    it('returns results sorted by library item duration diff', async () => {
      const result = (await bookFinder.search(libraryItem, provider, t, a)).map((r) => (r.duration ? { duration: r.duration } : {}))
      expect(result).to.deep.equal(sorted)
    })

    it('returns unsorted results if library item is null', async () => {
      const result = (await bookFinder.search(null, provider, t, a)).map((r) => (r.duration ? { duration: r.duration } : {}))
      expect(result).to.deep.equal(unsorted)
    })

    it('returns unsorted results if library item duration is undefined', async () => {
      const result = (await bookFinder.search({ media: {} }, provider, t, a)).map((r) => (r.duration ? { duration: r.duration } : {}))
      expect(result).to.deep.equal(unsorted)
    })

    it('returns unsorted results if library item media is undefined', async () => {
      const result = (await bookFinder.search({}, provider, t, a)).map((r) => (r.duration ? { duration: r.duration } : {}))
      expect(result).to.deep.equal(unsorted)
    })

    it('should return a result last if it has no duration', async () => {
      const unsorted = [{}, { duration: 3000 }, { duration: 2000 }, { duration: 1000 }, { duration: 500 }]
      const sorted = [{ duration: 1000 }, { duration: 500 }, { duration: 2000 }, { duration: 3000 }, {}]
      runSearchStub.withArgs(t, a, provider).resolves(structuredClone(unsorted))
      const result = (await bookFinder.search(libraryItem, provider, t, a)).map((r) => (r.duration ? { duration: r.duration } : {}))
      expect(result).to.deep.equal(sorted)
    })
  })

  describe('matchConfidence score', () => {
    const W_DURATION = 0.7
    const W_TITLE = 0.2
    const W_AUTHOR = 0.1
    const DEFAULT_DURATION_SCORE_MISSING_INFO = 0.1

    const libraryItemPerfectDuration = { media: { duration: 600 } } // 10 minutes

    // Helper to calculate expected title/author score based on Levenshtein
    // Assumes queryPart and bookPart are already "cleaned" for length calculation consistency with BookFinder.js
    const calculateStringMatchScore = (cleanedQueryPart, cleanedBookPart) => {
      if (!cleanedQueryPart) return cleanedBookPart ? 0 : 1 // query empty: 1 if book empty, else 0
      if (!cleanedBookPart) return 0 // query non-empty, book empty: 0

      // Use the imported levenshteinDistance. It defaults to case-insensitive, which is what we want.
      const distance = levenshteinDistance(cleanedQueryPart, cleanedBookPart)
      return Math.max(0, 1 - distance / Math.max(cleanedQueryPart.length, cleanedBookPart.length))
    }

    beforeEach(() => {
      runSearchStub.resolves([])
    })

    afterEach(() => {
      sinon.restore()
    })

    describe('for audible provider', () => {
      const provider = 'audible'

      it('should be 1.0 for perfect duration, title, and author match', async () => {
        const bookResults = [{ duration: 10, title: 'The Great Novel', author: 'John Doe' }]
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe')
        // durationScore = 1.0 (diff 0 <= 1 min)
        // titleScore = 1.0 (exact match)
        // authorScore = 1.0 (exact match)
        const expectedConfidence = W_DURATION * 1.0 + W_TITLE * 1.0 + W_AUTHOR * 1.0
        expect(results[0].matchConfidence).to.be.closeTo(expectedConfidence, 0.001)
      })

      it('should correctly score a large duration mismatch', async () => {
        const bookResults = [{ duration: 21, title: 'The Great Novel', author: 'John Doe' }] // 21 min, diff = 11 min
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe')
        // durationScore = 0.0
        // titleScore = 1.0
        // authorScore = 1.0
        const expectedConfidence = W_DURATION * 0.0 + W_TITLE * 1.0 + W_AUTHOR * 1.0
        expect(results[0].matchConfidence).to.be.closeTo(expectedConfidence, 0.001)
      })

      it('should correctly score a medium duration mismatch', async () => {
        const bookResults = [{ duration: 16, title: 'The Great Novel', author: 'John Doe' }] // 16 min, diff = 6 min
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe')
        // durationScore = 1.2 - 6 * 0.12 = 0.48
        // titleScore = 1.0
        // authorScore = 1.0
        const expectedConfidence = W_DURATION * 0.48 + W_TITLE * 1.0 + W_AUTHOR * 1.0
        expect(results[0].matchConfidence).to.be.closeTo(expectedConfidence, 0.001)
      })

      it('should correctly score a minor duration mismatch', async () => {
        const bookResults = [{ duration: 14, title: 'The Great Novel', author: 'John Doe' }] // 14 min, diff = 4 min
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe')
        // durationScore = 1.1 - 4 * 0.1 = 0.7
        // titleScore = 1.0
        // authorScore = 1.0
        const expectedConfidence = W_DURATION * 0.7 + W_TITLE * 1.0 + W_AUTHOR * 1.0
        expect(results[0].matchConfidence).to.be.closeTo(expectedConfidence, 0.001)
      })

      it('should correctly score a tiny duration mismatch', async () => {
        const bookResults = [{ duration: 11, title: 'The Great Novel', author: 'John Doe' }] // 11 min, diff = 1 min
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe')
        // durationScore = 1.0
        // titleScore = 1.0
        // authorScore = 1.0
        const expectedConfidence = W_DURATION * 1.0 + W_TITLE * 1.0 + W_AUTHOR * 1.0
        expect(results[0].matchConfidence).to.be.closeTo(expectedConfidence, 0.001)
      })

      it('should use default duration score if libraryItem duration is missing', async () => {
        const bookResults = [{ duration: 10, title: 'The Great Novel', author: 'John Doe' }]
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search({ media: {} }, provider, 'The Great Novel', 'John Doe')
        // durationScore = DEFAULT_DURATION_SCORE_MISSING_INFO (0.2)
        const expectedConfidence = W_DURATION * DEFAULT_DURATION_SCORE_MISSING_INFO + W_TITLE * 1.0 + W_AUTHOR * 1.0
        expect(results[0].matchConfidence).to.be.closeTo(expectedConfidence, 0.001)
      })

      it('should use default duration score if book duration is missing', async () => {
        const bookResults = [{ title: 'The Great Novel', author: 'John Doe' }] // No duration in book
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe')
        // durationScore = DEFAULT_DURATION_SCORE_MISSING_INFO (0.2)
        const expectedConfidence = W_DURATION * DEFAULT_DURATION_SCORE_MISSING_INFO + W_TITLE * 1.0 + W_AUTHOR * 1.0
        expect(results[0].matchConfidence).to.be.closeTo(expectedConfidence, 0.001)
      })

      it('should correctly score a partial title match', async () => {
        const bookResults = [{ duration: 10, title: 'Novel', author: 'John Doe' }]
        runSearchStub.resolves(bookResults)
        // Query: 'Novel Ex', Book: 'Novel'
        // cleanTitleForCompares('Novel Ex') -> 'novel ex' (length 8)
        // cleanTitleForCompares('Novel')    -> 'novel' (length 5)
        // levenshteinDistance('novel ex', 'novel') = 3
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'Novel Ex', 'John Doe')
        const expectedTitleScore = calculateStringMatchScore('novel ex', 'novel') // 1 - (3/8) = 0.625
        const expectedConfidence = W_DURATION * 1.0 + W_TITLE * expectedTitleScore + W_AUTHOR * 1.0
        expect(results[0].matchConfidence).to.be.closeTo(expectedConfidence, 0.001)
      })

      it('should correctly score a partial author match (comma-separated)', async () => {
        const bookResults = [{ duration: 10, title: 'The Great Novel', author: 'Jane Smith, Jon Doee' }]
        runSearchStub.resolves(bookResults)
        // Query: 'Jon Doe', Book part: 'Jon Doee'
        // cleanAuthorForCompares('Jon Doe') -> 'jon doe' (length 7)
        // book author part (already lowercased) -> 'jon doee' (length 8)
        // levenshteinDistance('jon doe', 'jon doee') = 1
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'Jon Doe')
        // For the author part 'jon doee':
        const expectedAuthorPartScore = calculateStringMatchScore('jon doe', 'jon doee') // 1 - (1/7)
        // Assuming 'jane smith' gives a lower or 0 score, max score will be from 'jon doee'
        const expectedConfidence = W_DURATION * 1.0 + W_TITLE * 1.0 + W_AUTHOR * expectedAuthorPartScore
        expect(results[0].matchConfidence).to.be.closeTo(expectedConfidence, 0.001)
      })

      it('should give authorScore 0 if query has author but book does not', async () => {
        const bookResults = [{ duration: 10, title: 'The Great Novel', author: null }]
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe')
        // authorScore = 0.0
        const expectedConfidence = W_DURATION * 1.0 + W_TITLE * 1.0 + W_AUTHOR * 0.0
        expect(results[0].matchConfidence).to.be.closeTo(expectedConfidence, 0.001)
      })

      it('should give authorScore 1.0 if query has no author', async () => {
        const bookResults = [{ duration: 10, title: 'The Great Novel', author: 'John Doe' }]
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', '') // Empty author
        expect(results[0].matchConfidence).to.be.closeTo(1.0, 0.001)
      })

      it('handles book author string that is only commas correctly (score 0)', async () => {
        const bookResults = [{ duration: 10, title: 'The Great Novel', author: ',, ,, ,' }]
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe')
        // cleanedQueryAuthorForScore = "john doe"
        // book.author leads to validBookAuthorParts being empty.
        // authorScore = 0.0
        const expectedConfidence = W_DURATION * 1.0 + W_TITLE * 1.0 + W_AUTHOR * 0.0
        expect(results[0].matchConfidence).to.be.closeTo(expectedConfidence, 0.001)
      })

      it('should return 1.0 for ASIN results', async () => {
        const bookResults = [{ duration: 10, title: 'The Great Novel', author: 'John Doe' }]
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'B000F28ZJ4', null)
        expect(results[0].matchConfidence).to.be.closeTo(1.0, 0.001)
      })

      it('should return 1.0 when author matches one of the book authors', async () => {
        const bookResults = [{ duration: 10, title: 'The Great Novel', author: 'John Doe, Jane Smith' }]
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe')
        expect(results[0].matchConfidence).to.be.closeTo(1.0, 0.001)
      })

      it('should return 1.0 when author query and multiple book authors are the same', async () => {
        const bookResults = [{ duration: 10, title: 'The Great Novel', author: 'John Doe, Jane Smith' }]
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe, Jane Smith')
        expect(results[0].matchConfidence).to.be.closeTo(1.0, 0.001)
      })

      it('should correctly score against a book with a subtitle when the query has a subtitle', async () => {
        const bookResults = [{ duration: 10, title: 'The Great Novel', subtitle: 'A Novel', author: 'John Doe' }]
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel: A Novel', 'John Doe')
        expect(results[0].matchConfidence).to.be.closeTo(1.0, 0.001)
      })

      it('should correctly score against a book with a subtitle when the query does not have a subtitle', async () => {
        const bookResults = [{ duration: 10, title: 'The Great Novel', subtitle: 'A Novel', author: 'John Doe' }]
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe')
        expect(results[0].matchConfidence).to.be.closeTo(1.0, 0.001)
      })

      describe('after fuzzy searches', () => {
        it('should return 1.0 for a title candidate match', async () => {
          const bookResults = [{ duration: 10, title: 'The Great Novel', author: 'John Doe' }]
          runSearchStub.resolves([])
          runSearchStub.withArgs('the great novel', 'john doe').resolves(bookResults)
          const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel - A Novel', 'John Doe')
          expect(results[0].matchConfidence).to.be.closeTo(1.0, 0.001)
        })

        it('should return 1.0 for an author candidate match', async () => {
          const bookResults = [{ duration: 10, title: 'The Great Novel', author: 'John Doe' }]
          runSearchStub.resolves([])
          runSearchStub.withArgs('the great novel', 'john doe').resolves(bookResults)
          const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe, Jane Smith')
          expect(results[0].matchConfidence).to.be.closeTo(1.0, 0.001)
        })
      })
    })

    describe('for non-audible provider (e.g., google)', () => {
      const provider = 'google'
      it('should have not have matchConfidence', async () => {
        const bookResults = [{ title: 'The Great Novel', author: 'John Doe' }]
        runSearchStub.resolves(bookResults)
        const results = await bookFinder.search(libraryItemPerfectDuration, provider, 'The Great Novel', 'John Doe')
        expect(results[0]).to.not.have.property('matchConfidence')
      })
    })
  })
})
