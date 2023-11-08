const bookFinder = require('./BookFinder')
const Audnexus = require('../providers/Audnexus')
const { LogLevel } = require('../utils/constants')
const Logger = require('../Logger')
jest.mock('../providers/Audnexus')

Logger.setLogLevel(LogLevel.INFO)

describe('TitleCandidates', () => {
  describe('cleanAuthor non-empty', () => {
    let titleCandidates
    let cleanAuthor = 'leo tolstoy'

    beforeEach(() => {
      titleCandidates = new bookFinder.constructor.TitleCandidates(cleanAuthor)
    })

    describe('single add', () => {
      it.each([
        ['adds a clean title to candidates', 'anna karenina', ['anna karenina']],
        ['lowercases candidate title', 'ANNA KARENINA', ['anna karenina']],
        ['removes author name from title', `anna karenina by ${cleanAuthor}`, ['anna karenina']],
        ['removes author name title', cleanAuthor, []],
        ['cleans subtitle from title', 'anna karenina: subtitle', ['anna karenina']],
        ['removes "by ..." from title', 'anna karenina by arnold schwarzenegger', ['anna karenina', 'anna karenina by arnold schwarzenegger']],
        ['removes bitrate from title', 'anna karenina 64kbps', ['anna karenina', 'anna karenina 64kbps']],
        ['removes edition from title 1', 'anna karenina 2nd edition', ['anna karenina', 'anna karenina 2nd edition']],
        ['removes edition from title 2', 'anna karenina 4th ed.', ['anna karenina', 'anna karenina 4th ed.']],
        ['removes file-type from title', 'anna karenina.mp3', ['anna karenina', 'anna karenina.mp3']],
        ['removes "a novel" from title', 'anna karenina a novel', ['anna karenina', 'anna karenina a novel']],
        ['removes preceding/trailing numbers from title', '1 anna karenina 2', ['anna karenina', '1 anna karenina 2']],
        ['does not add empty title', '', []],
        ['does not add title with only spaces', '   ', []],
        ['adds digit-only title, but not its empty string transformation', '1984', ['1984']],
      ])('%s', (_, title, expected) => {
        titleCandidates.add(title)
        expect(titleCandidates.getCandidates()).toEqual(expected)
      })
    })

    describe('multi add', () => {
      it.each([
        ['digits-only candidates get lower priority', ['01', 'anna karenina'], ['anna karenina', '01']],
        ['transformed candidates get higher priority', ['title1 1', 'title2 1'], ['title1', 'title2', 'title1 1', 'title2 1']],
        ['other candidates are ordered by position', ['title1', 'title2'], ['title1', 'title2']],
        ['author candidate is removed', ['title1', cleanAuthor], ['title1']],
      ])('%s', (_, titles, expected) => {
        for (const title of titles) titleCandidates.add(title)
        expect(titleCandidates.getCandidates()).toEqual(expected)
      })
    })
  })

  describe('cleanAuthor empty', () => {
    let titleCandidates
    let cleanAuthor = ''
  
    beforeEach(() => {
      titleCandidates = new bookFinder.constructor.TitleCandidates(cleanAuthor)
    })
  
    describe('single add', () => {
      it.each([
        ['does not remove author name', 'leo tolstoy', ['leo tolstoy']],
      ])('%s', (_, title, expected) => {
        titleCandidates.add(title)
        expect(titleCandidates.getCandidates()).toEqual(expected)
      })
    })
  })  
})


describe('AuthorCandidates', () => {
  let authorCandidates
  const audnexus = new Audnexus()
  audnexus.authorASINsRequest.mockResolvedValue([ 
    { name: 'Leo Tolstoy' }, 
    { name: 'Nikolai Gogol' },
    { name: 'J. K. Rowling' },
  ])

  describe('cleanAuthor is null', () => {
    beforeEach(() => {
      authorCandidates = new bookFinder.constructor.AuthorCandidates(null, audnexus)
    })

    describe('no add', () => {
      it.each([
        ['returns empty author', []],
      ])('%s', async (_,  expected) => {
        expect(await authorCandidates.getCandidates()).toEqual([...expected, ''])
      })
    })

    describe('single add', () => {
      it.each([
        ['returns valid author', 'nikolai gogol', ['nikolai gogol']],        
        ['does not return invalid author (not in list)', 'fyodor dostoevsky', []],
        ['returns valid author (valid is a substring of added)', 'dr. nikolai gogol', ['nikolai gogol']],
        ['returns added author (added is a substring of valid)', 'gogol', ['gogol']],
        ['returns valid author (added is similar to valid)', 'nicolai gogol', ['nikolai gogol']],
        ['does not return invalid author (added too distant)', 'nikolai google', []],
        ['returns valid author (contains redundant spaces)', 'nikolai    gogol', ['nikolai gogol']],
        ['returns valid author (normalized initials)', 'j.k. rowling', ['j. k. rowling']],
      ])('%s', async (_, author, expected) => {
        authorCandidates.add(author)
        expect(await authorCandidates.getCandidates()).toEqual([...expected, ''])
      })
    })

    describe('multi add', () => {
      it.each([
        ['returns valid authors', ['nikolai gogol', 'leo tolstoy'], ['nikolai gogol', 'leo tolstoy']],
        ['returns deduped valid authors', ['nikolai gogol', 'nikolai gogol'], ['nikolai gogol']],
      ])('%s', async (_, authors, expected) => {
        for (const author of authors) authorCandidates.add(author)
        expect(await authorCandidates.getCandidates()).toEqual([...expected, ''])
      })
    })
  })

  describe('cleanAuthor is valid', () => {
    const cleanAuthor = 'leo tolstoy'

    beforeEach(() => {
      authorCandidates = new bookFinder.constructor.AuthorCandidates(cleanAuthor, audnexus)
    })

    describe('no add', () => {
      it.each([
        ['returns clean author from constructor', [cleanAuthor]],
      ])('%s', async (_,  expected) => {
        expect(await authorCandidates.getCandidates()).toEqual([...expected, ''])
      })
    })

    describe('single add', () => {
      it.each([
        ['returns cleanAuthor + valid author', 'nikolai gogol', [cleanAuthor, 'nikolai gogol']],
        ['returns deduplicated author', cleanAuthor, [cleanAuthor]],        
      ])('%s', async (_, author, expected) => {
        authorCandidates.add(author)
        expect(await authorCandidates.getCandidates()).toEqual([...expected, ''])
      })
    })
  })


  describe('cleanAuthor is invalid', () => {
    const cleanAuthor = 'fyodor dostoevsky'

    beforeEach(() => {
      authorCandidates = new bookFinder.constructor.AuthorCandidates(cleanAuthor, audnexus)
    })

    describe('no add', () => {
      it.each([
        ['returns invalid clean author from constructor', [cleanAuthor]],
      ])('%s', async (_,  expected) => {
        expect(await authorCandidates.getCandidates()).toEqual([...expected, ''])
      })
    })

    describe('single add', () => {
      it.each([
        ['returns only valid author', 'nikolai gogol', ['nikolai gogol']],
      ])('%s', async (_, author, expected) => {
        authorCandidates.add(author)
        expect(await authorCandidates.getCandidates()).toEqual([...expected, ''])
      })
    })
  })

  describe('cleanAuthor is invalid and dirty', () => {
    describe('no add', () => {
      it.each([
        ['returns invalid aggressively cleanAuthor from constructor', 'fyodor dostoevsky, translated by jackie chan', ['fyodor dostoevsky']],
        ['returns invalid cleanAuthor from constructor (empty after aggressive ckean)', ', jackie chan', [', jackie chan']],
      ])('%s', async (_,  cleanAuthor, expected) => {
        authorCandidates = new bookFinder.constructor.AuthorCandidates(cleanAuthor, audnexus)
        expect(await authorCandidates.getCandidates()).toEqual([...expected, ''])
      })
    })
  })
})

describe('search', () => {
  const t = 'title'
  const a = 'author'
  const u = 'unknown'
  const r = ['book']

  bookFinder.runSearch = jest.fn((searchTitle, searchAuthor) => {
    return new Promise((resolve) => {
      resolve(searchTitle == t && (searchAuthor == a || searchAuthor == u) ? r : [])
    })
  })
  
  const audnexus = new Audnexus()
  audnexus.authorASINsRequest.mockResolvedValue([ 
    { name: a }, 
  ])
  bookFinder.audnexus = audnexus

  beforeEach(() => {
    bookFinder.runSearch.mockClear()
  })

  describe('no or empty title', () => {
    it('returns empty result', async () => {
      expect(await bookFinder.search('', '', a)).toEqual([])
      expect(bookFinder.runSearch).toHaveBeenCalledTimes(0)
    })
  })

  describe('exact valid title and exact valid author', () => {
    it('returns result (no fuzzy searches)', async () => {
      expect(await bookFinder.search('', t, a)).toEqual(r)
      expect(bookFinder.runSearch).toHaveBeenCalledTimes(1)
    })
  })

  describe('contains valid title and exact valid author', () => {
    it.each([
      [`${t} -`],
      [`${t} - ${a}`],
      [`${a} - ${t}`],
      [`${t}- ${a}`],
      [`${t} -${a}`],
      [`${t} ${a}`],
      [`${a} - ${t} (unabridged)`],
      [`${a} - ${t} (subtitle) - mp3`],
      [`${t} {narrator} - series-01 64kbps 10:00:00`],
      [`${a} - ${t} (2006) narrated by narrator [unabridged]`],
      [`${t} - ${a} 2022 mp3`],
      [`01 ${t}`],
      [`2022_${t}_HQ`],
//      [`${a} - ${t}`],
    ])(`returns result ('%s', '${a}') (1 fuzzy search)` , async (searchTitle) => {
      expect(await bookFinder.search('', searchTitle, a)).toEqual(r)
      expect(bookFinder.runSearch).toHaveBeenCalledTimes(2)
    })

    
    it.each([
      [`s-01 - ${t} (narrator) 64kbps 10:00:00`],
      [`${a} - series 01 - ${t}`],
//      [`${a} - ${t}`],
    ])(`returns result ('%s', '${a}') (2 fuzzy searches)` , async (searchTitle) => {
      expect(await bookFinder.search('', searchTitle, a)).toEqual(r)
      expect(bookFinder.runSearch).toHaveBeenCalledTimes(3)
    })

    it.each([
      [`${t}-${a}`],
      [`${t} junk`],
    ])(`returns empty result ('%s', '${a}')`, async (searchTitle) => { 
      expect(await bookFinder.search('', searchTitle, a)).toEqual([])
    })

    describe('maxFuzzySearches = 0', () => {
      it.each([
        [`${t} - ${a}`],
      ])(`returns empty result ('%s', '${a}') (no fuzzy search)` , async (searchTitle) => {
        expect(await bookFinder.search('', searchTitle, a, null, null, { maxFuzzySearches: 0 })).toEqual([])
        expect(bookFinder.runSearch).toHaveBeenCalledTimes(1)
      })  
    })

    describe('maxFuzzySearches = 1', () => {
      it.each([
        [`s-01 - ${t} (narrator) 64kbps 10:00:00`],
        [`${a} - series 01 - ${t}`],
        ])(`returns empty result ('%s', '${a}') (1 fuzzy search)` , async (searchTitle) => {
        expect(await bookFinder.search('', searchTitle, a, null, null, { maxFuzzySearches: 1 })).toEqual([])
        expect(bookFinder.runSearch).toHaveBeenCalledTimes(2)
      })  
    })  
  })

  describe('contains valid title and no author', () => {
    it.each([
      [`${t} - ${a}`],
      [`${a} - ${t}`],
    ])(`returns result ('%s', '') (1 fuzzy search)` , async (searchTitle) => {
      expect(await bookFinder.search('', searchTitle, '')).toEqual(r)
      expect(bookFinder.runSearch).toHaveBeenCalledTimes(2)
    })

    it.each([
      [`${t}`],
      [`${t} - ${u}`],
      [`${u} - ${t}`],
    ])(`returns empty result ('%s', '') (no fuzzy search)` , async (searchTitle) => {
      expect(await bookFinder.search('', searchTitle, '')).toEqual([])
    })
  })

  describe('contains valid title and unknown author', () => {
    it.each([
      [`${t} - ${u}`],
      [`${u} - ${t}`],
    ])(`returns result ('%s', '') (1 fuzzy search)` , async (searchTitle) => {
      expect(await bookFinder.search('', searchTitle, u)).toEqual(r)
      expect(bookFinder.runSearch).toHaveBeenCalledTimes(2)
    })
/*
    it.each([
    ])(`returns result ('%s', '') (2 fuzzy searches)` , async (searchTitle) => {
      expect(await bookFinder.search('', searchTitle, u)).toEqual(r)
      expect(bookFinder.runSearch).toHaveBeenCalledTimes(3)
    })
*/
    it.each([
      [`${t}`],
    ])(`returns result ('%s', '') (no fuzzy search)` , async (searchTitle) => {
      expect(await bookFinder.search('', searchTitle, u)).toEqual(r)
      expect(bookFinder.runSearch).toHaveBeenCalledTimes(1)
    })
  })

})