const { expect } = require('chai')
const sinon = require('sinon')
const Logger = require('../../../server/Logger')
const AudioFileScanner = require('../../../server/scanner/AudioFileScanner')

/**
 * Create a minimal audio file object for use in chapter tests.
 * @param {string} filename
 * @param {string|null} tagTitle
 * @param {number} duration
 */
function makeAudioFile(filename, tagTitle, duration) {
  return {
    duration,
    metadata: { filename, path: `/books/test/${filename}` },
    metaTags: { tagTitle },
    chapters: []
  }
}

/**
 * Minimal libraryScan stub that satisfies addLog calls.
 */
function makeLibraryScan() {
  return { addLog: sinon.stub() }
}

describe('AudioFileScanner', () => {
  describe('getBookChaptersFromAudioFiles', () => {
    let libraryScan

    beforeEach(() => {
      sinon.stub(Logger, 'debug')
      libraryScan = makeLibraryScan()
    })

    afterEach(() => {
      sinon.restore()
    })

    it('uses tagTitle for chapters when all titles are unique', () => {
      const audioFiles = [
        makeAudioFile('01 Chapter One.m4a', 'Chapter One', 100),
        makeAudioFile('02 Chapter Two.m4a', 'Chapter Two', 120)
      ]

      const chapters = AudioFileScanner.getBookChaptersFromAudioFiles('My Book', audioFiles, libraryScan)

      expect(chapters).to.have.lengthOf(2)
      expect(chapters[0].title).to.equal('Chapter One')
      expect(chapters[1].title).to.equal('Chapter Two')
    })

    it('uses tagTitle even when one track title matches the book title', () => {
      // Reproduces issue #5639: m4a files where the first track title equals
      // the album/book title. The old code filtered out titles matching the
      // book title, leaving the count short and falling back to filenames.
      const audioFiles = [
        makeAudioFile('01 Ik Ben Benjamin Ben.m4a', 'Ik Ben Benjamin Ben', 35),
        makeAudioFile('02 Track Two.m4a', 'Track Two', 40),
        makeAudioFile('03 Track Three.m4a', 'Track Three', 38)
      ]

      const chapters = AudioFileScanner.getBookChaptersFromAudioFiles('Ik Ben Benjamin Ben', audioFiles, libraryScan)

      expect(chapters).to.have.lengthOf(3)
      expect(chapters[0].title).to.equal('Ik Ben Benjamin Ben')
      expect(chapters[1].title).to.equal('Track Two')
      expect(chapters[2].title).to.equal('Track Three')
    })

    it('falls back to filename when not all files have a tagTitle', () => {
      const audioFiles = [
        makeAudioFile('01 Chapter One.m4a', 'Chapter One', 100),
        makeAudioFile('02 Chapter Two.m4a', null, 120)
      ]

      const chapters = AudioFileScanner.getBookChaptersFromAudioFiles('My Book', audioFiles, libraryScan)

      expect(chapters).to.have.lengthOf(2)
      expect(chapters[0].title).to.equal('01 Chapter One')
      expect(chapters[1].title).to.equal('02 Chapter Two')
    })

    it('falls back to filename when tagTitle values are not all unique', () => {
      const audioFiles = [
        makeAudioFile('01 Chapter One.m4a', 'Same Title', 100),
        makeAudioFile('02 Chapter Two.m4a', 'Same Title', 120)
      ]

      const chapters = AudioFileScanner.getBookChaptersFromAudioFiles('My Book', audioFiles, libraryScan)

      expect(chapters).to.have.lengthOf(2)
      expect(chapters[0].title).to.equal('01 Chapter One')
      expect(chapters[1].title).to.equal('02 Chapter Two')
    })

    it('returns no chapters when there is only one audio file with no embedded chapters', () => {
      const audioFiles = [makeAudioFile('01 Single.m4a', 'Single Track', 300)]

      const chapters = AudioFileScanner.getBookChaptersFromAudioFiles('My Book', audioFiles, libraryScan)

      expect(chapters).to.have.lengthOf(0)
    })
  })
})
