const http = require('http')
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
        ['adds candidate, not stripping subtitle for bare colon in title', '10:04', ['10:04']],
        ['adds candidate, not stripping subtitle for colon between words without space', 'making the mission:impossible movies', ['making the mission:impossible movies']],
        ['adds candidate + variant, removing "by ..."', 'anna karenina by arnold schwarzenegger', ['anna karenina', 'anna karenina by arnold schwarzenegger']],
        ['adds candidate + variant, removing "by ..." when title has bare colon', '10:04 by ben lerner', ['10:04', '10:04 by ben lerner']],
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

  describe('audiobookdb provider', () => {
    const provider = 'audiobookdb'

    it('allows an empty title when an explicit ASIN is supplied', async () => {
      const results = await bookFinder.search(null, provider, '', '', null, 'B00B5HZGUG')
      expect(results).to.deep.equal([])
      sinon.assert.callCount(bookFinder.runSearch, 1)
      expect(bookFinder.runSearch.firstCall.args.slice(0, 4)).to.deep.equal(['', '', provider, 'B00B5HZGUG'])
      sinon.assert.notCalled(audnexusStub)
    })

    it('returns empty for an empty title without an explicit ASIN', async () => {
      expect(await bookFinder.search(null, provider, '', '', null)).to.deep.equal([])
      sinon.assert.callCount(bookFinder.runSearch, 0)
    })

    it('recovers a contaminated quick-match author through a bounded empty-author fallback', async () => {
      runSearchStub.resolves([])
      runSearchStub.withArgs('andorra', '').resolves(r)

      // maxFuzzySearches 2: the fallback query list deduplicates the
      // cleaned-author main title against the initial query (identical
      // normalized title and author), so the no-author main title is the
      // only additional search — reached without substituting any other
      // author and without Audnexus. The initial search keeps original
      // case; the fallback lowercases.
      const results = await bookFinder.search(null, provider, 'Andorra', 'Kate Reading', null, null, { maxFuzzySearches: 2 })
      expect(results).to.deep.equal(r)
      expect(bookFinder.runSearch.getCalls().map((c) => c.args.slice(0, 2))).to.deep.equal([
        ['Andorra', 'Kate Reading'],
        ['andorra', '']
      ])
      sinon.assert.notCalled(audnexusStub)
    })

    it('keeps the intended author and only relaxes punctuation/initials', async () => {
      runSearchStub.resolves([])
      runSearchStub.withArgs('devon', 'devon ford').resolves(r)

      // "Devon C. Ford" normalizes to "devon ford" (the middle initial is
      // dropped, never substituted): the relaxed author search finds the
      // match. The initial search keeps original case.
      const results = await bookFinder.search(null, provider, 'Devon', 'Devon C. Ford', null, null, { maxFuzzySearches: 3 })
      expect(results).to.deep.equal(r)
      expect(bookFinder.runSearch.getCalls().map((c) => c.args.slice(0, 2))).to.deep.equal([
        ['Devon', 'Devon C. Ford'],
        ['devon', 'devon ford']
      ])
      sinon.assert.notCalled(audnexusStub)
    })

    it('bounds the fuzzy fallback by maxFuzzySearches', async () => {
      runSearchStub.resolves([])

      // Fallback order: the main title with the item's author comes first,
      // immediately followed by the main title with no author; only then do
      // title variants spend the remaining budget (each variant leading its
      // author level). " - " separates parts, so budget 5 = 5 fallback
      // searches: main title (author + no-author), then the first variant
      // (author + no-author), then the second variant with the author.
      const results = await bookFinder.search(null, provider, 'the - great - novel', 'someone', null, null, { maxFuzzySearches: 5 })
      expect(results).to.deep.equal([])
      expect(bookFinder.runSearch.getCalls().map((c) => c.args.slice(0, 2))).to.deep.equal([
        ['the - great - novel', 'someone'],
        ['the', 'someone'],
        ['the', ''],
        ['great', 'someone'],
        ['great', ''],
        ['novel', 'someone']
      ])
      sinon.assert.notCalled(audnexusStub)
    })
  })

  describe('audiobookdb provider quickMatch', () => {
    const provider = 'audiobookdb'
    const cover = 'https://img.example.com/andorra.jpg'
    const andorra = [{ id: 'ANDID1', title: 'Andorra', cover }]
    const martian = [{ id: 'MARTID1', title: 'The Martian', cover }]
    const unrelated = [
      { title: 'Andorra Sector', cover },
      { title: 'Andorra: The Leah Chronicles', cover }
    ]
    const martianDecoys = [
      { title: 'The Martian Chronicles', cover },
      { title: 'The Martian: A Novel', cover }
    ]

    it('keeps an exact-ASIN result when the local title is stale', async () => {
      runSearchStub.resolves(martian)

      const results = await bookFinder.search(null, provider, 'Different Local Title', 'Wrong Imported Author', null, 'B00B5HZGUG', {
        quickMatch: true
      })

      expect(results).to.deep.equal(martian)
      expect(bookFinder.runSearch.firstCall.args[3]).to.equal('B00B5HZGUG')
      sinon.assert.callCount(bookFinder.runSearch, 1)
    })

    it('keeps an ASIN-shaped title probe hit when the local title is the ASIN itself', async () => {
      // Item whose stored title is the ASIN (empty asin field): the provider
      // probes the identifier exactly and returns the recorded title. The
      // title identity gate must keep that exact match instead of comparing
      // "The Martian" against "B00B5HZGUG".
      runSearchStub.resolves([{ id: 'MARTID1', title: 'The Martian', asin: 'B00B5HZGUG', cover }])

      const results = await bookFinder.search(null, provider, 'B00B5HZGUG', '', null, null, {
        quickMatch: true,
        maxFuzzySearches: 0
      })

      expect(results).to.deep.equal([{ id: 'MARTID1', title: 'The Martian', asin: 'B00B5HZGUG', cover }])
      sinon.assert.callCount(bookFinder.runSearch, 1)
    })

    it('keeps a main-title match recovered from a hyphenated subtitle query', async () => {
      runSearchStub.resolves([])
      runSearchStub.withArgs('the martian', '').resolves(martian)

      const results = await bookFinder.search(
        null,
        provider,
        'The Martian - Unabridged',
        'Wrong Imported Author',
        null,
        null,
        { maxFuzzySearches: 2, quickMatch: true }
      )

      expect(results).to.deep.equal(martian)
      expect(bookFinder.runSearch.getCalls().map((call) => call.args.slice(0, 2))).to.deep.equal([
        ['The Martian - Unabridged', 'Wrong Imported Author'],
        ['the martian', 'wrong imported author'],
        ['the martian', '']
      ])
    })

    it('reaches the no-author main-title search within the quick-match budget for a multi-part title', async () => {
      runSearchStub.resolves([])
      runSearchStub.withArgs('the martian', '').resolves(martian)

      // Quick-match budget is 2: after the initial full-query search the
      // fallback tries the cleaned-author main title, then the no-author
      // main title — the contaminated author's relaxed query must not be
      // starved by title variants. The match is found with no author
      // substitution and no Audnexus, and its title matches the normalized
      // main title, so it survives the quick-match gate.
      const results = await bookFinder.search(
        null,
        provider,
        'The Martian (Unabridged)',
        'Kate Reading-Smith',
        null,
        null,
        { maxFuzzySearches: 2, quickMatch: true }
      )
      expect(results).to.deep.equal(martian)
      expect(bookFinder.runSearch.getCalls().map((c) => c.args.slice(0, 2))).to.deep.equal([
        ['The Martian (Unabridged)', 'Kate Reading-Smith'],
        ['the martian', 'kate reading-smith'],
        ['the martian', '']
      ])
      sinon.assert.notCalled(audnexusStub)
    })

    it('rejects unrelated same-title hits on the multi-part title no-author path', async () => {
      runSearchStub.resolves([])
      // The relaxed no-author main-title search returns other same-prefix
      // books (a same-prefix title and a subtitle decoy): quick-match must
      // not take results[0] blindly. The gate compares against the
      // normalized main title, so none of these is "The Martian".
      runSearchStub.withArgs('the martian', '').resolves(martianDecoys)

      const results = await bookFinder.search(
        null,
        provider,
        'The Martian (Unabridged)',
        'Kate Reading-Smith',
        null,
        null,
        { maxFuzzySearches: 2, quickMatch: true }
      )
      expect(results).to.deep.equal([])
      expect(bookFinder.runSearch.getCalls().map((c) => c.args.slice(0, 2))).to.deep.equal([
        ['The Martian (Unabridged)', 'Kate Reading-Smith'],
        ['the martian', 'kate reading-smith'],
        ['the martian', '']
      ])
    })

    it('keeps the exact main-title candidate when the multi-part no-author search returns it', async () => {
      runSearchStub.resolves([])
      runSearchStub.withArgs('the martian', '').resolves([...martianDecoys, martian[0]])

      const results = await bookFinder.search(
        null,
        provider,
        'The Martian (Unabridged)',
        'Kate Reading-Smith',
        null,
        null,
        { maxFuzzySearches: 2, quickMatch: true }
      )
      expect(results).to.deep.equal(martian)
    })

    it('does not apply the quick-match gate to manual matching for a multi-part title', async () => {
      runSearchStub.resolves([])
      runSearchStub.withArgs('the martian', '').resolves(martianDecoys)

      // Without quickMatch the relaxed candidates are returned for user
      // selection; nothing is filtered out.
      const results = await bookFinder.search(null, provider, 'The Martian (Unabridged)', 'Kate Reading-Smith', null, null, {
        maxFuzzySearches: 2
      })
      expect(results).to.deep.equal(martianDecoys)
    })

    it('recovers a contaminated quick-match author within the budget', async () => {
      runSearchStub.resolves([])
      runSearchStub.withArgs('andorra', '').resolves(andorra)

      // The initial query already matches the normalized main-title/cleaned-
      // author query, so that duplicate is skipped; the first distinct
      // fallback is the no-author main title.
      const results = await bookFinder.search(null, provider, 'Andorra', 'Kate Reading-Smith', null, null, {
        maxFuzzySearches: 2,
        quickMatch: true
      })
      expect(results).to.deep.equal(andorra)
      expect(bookFinder.runSearch.getCalls().map((c) => c.args.slice(0, 2))).to.deep.equal([
        ['Andorra', 'Kate Reading-Smith'],
        ['andorra', '']
      ])
      sinon.assert.notCalled(audnexusStub)
    })

    it('rejects unrelated same-title hits on the relaxed no-author path', async () => {
      runSearchStub.resolves([])
      // The relaxed no-author search returns other same-title books,
      // including the subtitle decoy: quick-match must not take results[0]
      // blindly. The gate keeps subtitles (keepSubtitle), so "Andorra: The
      // Leah Chronicles" is not folded back into "andorra".
      runSearchStub.withArgs('andorra', '').resolves(unrelated)

      const results = await bookFinder.search(null, provider, 'Andorra', 'Kate Reading-Smith', null, null, {
        maxFuzzySearches: 2,
        quickMatch: true
      })
      expect(results).to.deep.equal([])
      expect(bookFinder.runSearch.getCalls().map((c) => c.args.slice(0, 2))).to.deep.equal([
        ['Andorra', 'Kate Reading-Smith'],
        ['andorra', '']
      ])
    })

    it('keeps the exact-title candidate when the relaxed search returns it', async () => {
      runSearchStub.resolves([])
      runSearchStub.withArgs('andorra', '').resolves([...unrelated, andorra[0]])

      const results = await bookFinder.search(null, provider, 'Andorra', 'Kate Reading-Smith', null, null, {
        maxFuzzySearches: 2,
        quickMatch: true
      })
      expect(results).to.deep.equal(andorra)
    })

    it('does not apply the quick-match gate to manual matching', async () => {
      runSearchStub.resolves([])
      runSearchStub.withArgs('andorra', '').resolves(unrelated)

      // Without quickMatch the relaxed candidates are returned for user
      // selection; nothing is filtered out.
      const results = await bookFinder.search(null, provider, 'Andorra', 'Kate Reading-Smith', null, null, { maxFuzzySearches: 2 })
      expect(results).to.deep.equal(unrelated)
    })

    it('abstains when exact-title candidates belong to distinct works', async () => {
      runSearchStub.resolves([])
      // Two distinct works carry the exact same title: the title gate passes
      // both, but automatic selection cannot tell which is the real work, so
      // quick-match must abstain instead of letting runtime ranking pick.
      const sameTitleWorks = [
        { id: 'WORKA', title: 'Andorra', cover },
        { id: 'WORKB', title: 'Andorra', cover }
      ]
      runSearchStub.withArgs('andorra', '').resolves(sameTitleWorks)

      const results = await bookFinder.search(null, provider, 'Andorra', 'Kate Reading-Smith', null, null, {
        maxFuzzySearches: 2,
        quickMatch: true
      })
      expect(results).to.deep.equal([])
    })

    it('keeps both same-title work candidates for manual matching', async () => {
      runSearchStub.resolves([])
      // The exact-title candidates of two distinct works remain available
      // for user selection without quickMatch.
      const sameTitleWorks = [
        { id: 'WORKA', title: 'Andorra', cover },
        { id: 'WORKB', title: 'Andorra', cover }
      ]
      runSearchStub.withArgs('andorra', '').resolves(sameTitleWorks)

      const results = await bookFinder.search(null, provider, 'Andorra', 'Kate Reading-Smith', null, null, { maxFuzzySearches: 2 })
      expect(results).to.deep.equal(sameTitleWorks)
    })

  })
})

describe('findCovers AudiobookDB failures', () => {
  const AudiobookDBError = require('../../../server/providers/AudiobookDBError')
  let searchStub

  beforeEach(() => {
    sinon.stub(bookFinder, 'providers').value(['google', 'audiobookdb', 'openlibrary'])
    searchStub = sinon.stub(bookFinder, 'search').resolves([])
    searchStub.withArgs(null, 'google').resolves([{ cover: 'https://example.org/google.jpg' }])
    searchStub.withArgs(null, 'openlibrary').resolves([{ cover: 'https://example.org/openlibrary.jpg' }])
  })

  afterEach(() => sinon.restore())

  ;['audiobookdb_key_required', 'audiobookdb_auth', 'audiobookdb_rate_limited', 'audiobookdb_unavailable'].forEach((code) => {
    it(`keeps other providers' covers and continues after ${code}`, async () => {
      searchStub.withArgs(null, 'audiobookdb').rejects(new AudiobookDBError(code))
      const covers = await bookFinder.findCovers('all', 'The Martian', 'Andy Weir')
      expect(covers).to.deep.equal(['https://example.org/google.jpg', 'https://example.org/openlibrary.jpg'])
      expect(searchStub.getCalls().map((call) => call.args[1])).to.deep.equal(['google', 'audiobookdb', 'openlibrary'])
    })

    it(`preserves actionable ${code} for an explicit AudiobookDB request`, async () => {
      const failure = new AudiobookDBError(code)
      searchStub.withArgs(null, 'audiobookdb').rejects(failure)
      let caught
      try {
        await bookFinder.findCovers('audiobookdb', 'The Martian', 'Andy Weir')
      } catch (error) {
        caught = error
      }
      expect(caught).to.equal(failure)
    })
  })
})

describe('findCovers audiobookdb loopback', () => {
  let server
  let requests
  let savedApiKey
  const savedBaseUrl = bookFinder.audiobookdb.baseUrl

  beforeEach(async () => {
    savedApiKey = process.env.AUDIOBOOKDB_API_KEY
    process.env.AUDIOBOOKDB_API_KEY = 'test-loopback-key'
    requests = []
    server = http.createServer((req, res) => {
      // Exercise the real transport: the provider must send its own
      // User-Agent; a bare client gets rejected, so this is not a mock echo.
      if (!req.headers['user-agent']) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'user agent required' }))
        return
      }
      // axios url-joins baseUrl with absolute paths, doubling the slash;
      // compare on the normalized path so the server exercises the provider
      // as-is.
      const url = new URL(req.url, 'http://127.0.0.1')
      const norm = url.pathname.replace(/\/{2,}/g, '/')
      requests.push(`${req.method} ${norm}`)
      if (req.method === 'POST' && norm === '/api/search') {
        // Actual SearchDocumentBook shape: the cover lives in image.url, and
        // the full-resolution original in image.sourceUrl.
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify([
            {
              id: 'LOOPCOVER1',
              title: 'The Martian',
              image: {
                url: 'https://cdn.audiobookdb.org/loopcoverkey',
                sourceUrl: 'https://cdn.audiobookdb.org/loopcoverkey/source.jpg:book'
              }
            }
          ])
        )
        return
      }
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'not found' }))
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    bookFinder.audiobookdb.baseUrl = `http://127.0.0.1:${server.address().port}/api`
  })

  afterEach(async () => {
    bookFinder.audiobookdb.baseUrl = savedBaseUrl
    if (savedApiKey === undefined) delete process.env.AUDIOBOOKDB_API_KEY
    else process.env.AUDIOBOOKDB_API_KEY = savedApiKey
    if (server) await new Promise((resolve) => server.close(resolve))
  })

  it('streams the cover from a real /api/search hit over loopback without detail fanout', async () => {
    const covers = await bookFinder.findCovers('audiobookdb', 'The Martian', 'Andy Weir')
    expect(covers).to.deep.equal(['https://cdn.audiobookdb.org/loopcoverkey/source.jpg:book'])
    // Cover lookups stop at the search hit: no /books/ or /releases/ fanout.
    expect(requests).to.deep.equal(['POST /api/search'])
  })
})
