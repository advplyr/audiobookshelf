const sinon = require('sinon')
const chai = require('chai')
const expect = chai.expect
const bookFinder = require('../../../server/finders/BookFinder')
const { LogLevel } = require('../../../server/utils/constants')
const Logger = require('../../../server/Logger')
Logger.setLogLevel(LogLevel.INFO)

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
      runSearchStub.withArgs(t, a, provider).resolves(unsorted)
    })

    it('returns results sorted by library item duration diff', async () => {
      expect(await bookFinder.search(libraryItem, provider, t, a)).to.deep.equal(sorted)
    })

    it('returns unsorted results if library item is null', async () => {
      expect(await bookFinder.search(null, provider, t, a)).to.deep.equal(unsorted)
    })

    it('returns unsorted results if library item duration is undefined', async () => {
      expect(await bookFinder.search({ media: {} }, provider, t, a)).to.deep.equal(unsorted)
    })

    it('returns unsorted results if library item media is undefined', async () => {
      expect(await bookFinder.search({}, provider, t, a)).to.deep.equal(unsorted)
    })

    it('should return a result last if it has no duration', async () => {
      const unsorted = [{}, { duration: 3000 }, { duration: 2000 }, { duration: 1000 }, { duration: 500 }]
      const sorted = [{ duration: 1000 }, { duration: 500 }, { duration: 2000 }, { duration: 3000 }, {}]
      runSearchStub.withArgs(t, a, provider).resolves(unsorted)

      expect(await bookFinder.search(libraryItem, provider, t, a)).to.deep.equal(sorted)
    })
  })
})
