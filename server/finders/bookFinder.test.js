const bookFinder = require('./BookFinder')

describe('TitleCandidates with author', () => {
  let titleCandidates

  beforeEach(() => {
    titleCandidates = new bookFinder.constructor.TitleCandidates('leo tolstoy')
  })

  describe('single add', () => {
    it.each([
      ['adds a clean title to candidates', 'anna karenina', ['anna karenina']],
      ['lowercases candidate title', 'ANNA KARENINA', ['anna karenina']],
      ['removes author name from title', 'anna karenina by leo tolstoy', ['anna karenina']],
      ['removes author name title', 'leo tolstoy', []],
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
      ['author candidate is removed', ['title1', 'leo tolstoy'], ['title1']],
    ])('%s', (_, titles, expected) => {
      for (const title of titles) titleCandidates.add(title)
      expect(titleCandidates.getCandidates()).toEqual(expected)
    })
  })
})

describe('TitleCandidates with no author', () => {
  let titleCandidates

  beforeEach(() => {
    titleCandidates = new bookFinder.constructor.TitleCandidates('')
  })

  describe('single add', () => {
    it.each([
      ['does not removes author name', 'leo tolstoy', ['leo tolstoy']],
    ])('%s', (_, title, expected) => {
      titleCandidates.add(title)
      expect(titleCandidates.getCandidates()).toEqual(expected)
    })
  })
})

