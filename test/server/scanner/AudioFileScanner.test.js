const { expect } = require('chai')
const sinon = require('sinon')
const AudioFileScanner = require('../../../server/scanner/AudioFileScanner')

describe('AudioFileScanner.getBookChaptersFromAudioFiles', () => {
  const chapterTable = (prefix) => Array.from({ length: 3 }, (_, i) => ({ id: i, title: `${prefix} ${i + 1}`, start: i * 4, end: (i + 1) * 4 }))
  const audioFile = (index, chapters = [], duration = 12) => ({ duration, chapters, metadata: { filename: `Book (${index}).mp3` }, metaTags: {} })
  let libraryScan

  beforeEach(() => {
    libraryScan = { addLog: sinon.spy() }
  })

  const getChapters = (files) => AudioFileScanner.getBookChaptersFromAudioFiles('Book', files, libraryScan)

  it('copies embedded chapters for a single file', () => {
    const file = audioFile(1, chapterTable('Chapter'))
    const result = getChapters([file])
    expect(result).to.deep.equal(file.chapters)
    expect(result[0]).not.to.equal(file.chapters[0])
  })

  it('leaves a single file without embedded chapters unchanged', () => {
    expect(getChapters([audioFile(1)])).to.deep.equal([])
  })

  it('builds a chapter per file without embedded chapters', () => {
    const files = Array.from({ length: 11 }, (_, i) => audioFile(i + 1))
    expect(getChapters(files)).to.deep.equal(files.map((file, i) => ({ id: i, title: `Book (${i + 1})`, start: i * 12, end: (i + 1) * 12 })))
  })

  it('uses unique title tags for a normal multi-file book', () => {
    const files = [audioFile(1), audioFile(2)]
    files.forEach((file, i) => {
      file.metaTags.tagTitle = `Part ${i + 1}`
    })
    expect(getChapters(files).map((chapter) => chapter.title)).to.deep.equal(['Part 1', 'Part 2'])
  })

  it('combines unique embedded chapters with file offsets and sequential ids', () => {
    const files = [audioFile(1, chapterTable('First')), audioFile(2, chapterTable('Second'))]
    expect(getChapters(files)).to.deep.equal(files.flatMap((file, i) => file.chapters.map((chapter, j) => ({ ...chapter, id: i * 3 + j, start: chapter.start + i * 12, end: chapter.end + i * 12 }))))
  })

  for (const count of [2, 11]) {
    it(`uses one chapter table when all ${count} files share it`, () => {
      const files = Array.from({ length: count }, (_, i) => audioFile(i + 1, chapterTable('Shared')))
      expect(getChapters(files)).to.deep.equal(chapterTable('Shared'))
    })
  }

  it('combines all 11 files when only the first two chapter tables match (#5538)', () => {
    const files = Array.from({ length: 11 }, (_, i) => audioFile(i + 1, chapterTable(i < 2 ? 'Shared' : `File ${i + 1}`)))
    const before = structuredClone(files)
    const result = getChapters(files)
    expect(result).to.have.length(33)
    expect(result[6]).to.deep.equal({ id: 6, title: 'File 3 1', start: 24, end: 28 })
    expect(result[32]).to.deep.equal({ id: 32, title: 'File 11 3', start: 128, end: 132 })
    expect(files).to.deep.equal(before)
  })

  it('checks through the last file before reusing the first chapter table', () => {
    const files = Array.from({ length: 11 }, (_, i) => audioFile(i + 1, chapterTable(i === 10 ? 'Different' : 'Shared')))
    expect(getChapters(files)).to.have.length(33)
  })

  it('does not treat later files without chapters as a shared chapter table', () => {
    const files = [audioFile(1, chapterTable('Shared')), audioFile(2, chapterTable('Shared')), audioFile(3)]
    expect(getChapters(files)).to.have.length(6)
  })

  it('handles a later file with no chapter property', () => {
    const files = [audioFile(1, chapterTable('Shared')), audioFile(2, chapterTable('Shared')), audioFile(3)]
    delete files[2].chapters
    expect(getChapters(files)).to.have.length(6)
  })

  it('retains short intro and outro files without embedded chapters', () => {
    const files = [audioFile(1, [], 0.5), audioFile(2), audioFile(3, [], 0.5)]
    expect(getChapters(files)).to.deep.equal([
      { id: 0, title: 'Book (1)', start: 0, end: 0.5 },
      { id: 1, title: 'Book (2)', start: 0.5, end: 12.5 },
      { id: 2, title: 'Book (3)', start: 12.5, end: 13 }
    ])
  })

  it('still filters embedded chapters shorter than 0.1 seconds', () => {
    const files = [
      audioFile(1, [
        { id: 0, title: 'Tiny', start: 0, end: 0.05 },
        { id: 1, title: 'First', start: 0.05, end: 12 }
      ]),
      audioFile(2, chapterTable('Second'))
    ]
    const result = getChapters(files)
    expect(result).to.have.length(4)
    expect(result[0].title).to.equal('First')
    expect(result[1].start).to.equal(12)
    expect(libraryScan.addLog.calledWithMatch(sinon.match.any, sinon.match('Skipping this chapter'))).to.equal(true)
  })
})
