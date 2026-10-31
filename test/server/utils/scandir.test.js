const Path = require('path')
const chai = require('chai')
const expect = chai.expect
const scanUtils = require('../../../server/utils/scandir')

describe('scanUtils', async () => {
  it('should properly group files into potential book library items', async () => {
    global.isWin = process.platform === 'win32'
    global.ServerSettings = {
      scannerParseSubtitle: true
    }

    const filePaths = [
      'randomfile.txt', // Should be ignored because it's not a book media file
      'Book1.m4b', // Root single file audiobook
      'Book2/audiofile.m4b',
      'Book2/disk 001/audiofile.m4b',
      'Book2/disk 002/audiofile.m4b',
      'Author/Book3/audiofile.mp3',
      'Author/Book3/Disc 1/audiofile.mp3',
      'Author/Book3/Disc 2/audiofile.mp3',
      'Author/Series/Book4/cover.jpg',
      'Author/Series/Book4/CD1/audiofile.mp3',
      'Author/Series/Book4/CD2/audiofile.mp3',
      'Author/Series2/Book5/deeply/nested/cd 01/audiofile.mp3',
      'Author/Series2/Book5/deeply/nested/cd 02/audiofile.mp3',
      'Author/Series2/Book5/randomfile.js' // Should be ignored because it's not a book media file
    ]

    // Create fileItems to match the format of fileUtils.recurseFiles
    const fileItems = []
    for (const filePath of filePaths) {
      const dirname = Path.dirname(filePath)
      fileItems.push({
        name: Path.basename(filePath),
        reldirpath: dirname === '.' ? '' : dirname,
        extension: Path.extname(filePath),
        deep: filePath.split('/').length - 1
      })
    }

    const libraryItemGrouping = scanUtils.groupFileItemsIntoLibraryItemDirs('book', fileItems, false)

    expect(libraryItemGrouping).to.deep.equal({
      'Book1.m4b': 'Book1.m4b',
      Book2: ['audiofile.m4b', 'disk 001/audiofile.m4b', 'disk 002/audiofile.m4b'],
      'Author/Book3': ['audiofile.mp3', 'Disc 1/audiofile.mp3', 'Disc 2/audiofile.mp3'],
      'Author/Series/Book4': ['CD1/audiofile.mp3', 'CD2/audiofile.mp3', 'cover.jpg'],
      'Author/Series2/Book5/deeply/nested': ['cd 01/audiofile.mp3', 'cd 02/audiofile.mp3']
    })
  })
})


describe('scanUtils compatibility', () => {
  const fileItem = (path) => ({
    name: Path.posix.basename(path),
    path,
    fullpath: `/library/${path}`,
    reldirpath: Path.posix.dirname(path) === '.' ? '' : Path.posix.dirname(path),
    extension: Path.posix.extname(path),
    deep: path.split('/').length - 1
  })

  it('preserves missing metadata and empty titles', () => {
    expect(scanUtils.getBookDataFromDir('')).to.deep.equal({
      title: '', subtitle: null, asin: null, authors: [], narrators: [],
      seriesName: null, seriesSequence: null, publishedYear: null
    })
    expect(scanUtils.getBookDataFromDir('Author/Title - Subtitle').title).to.equal('Title - Subtitle')
    expect(scanUtils.getBookDataFromDir('Author/Title', true).subtitle).to.equal('')
  })

  it('extracts series, year, subtitle, narrator and ASIN together', () => {
    expect(scanUtils.getBookDataFromDir('Author/Series/Book 2 - 2020 - Title - Subtitle {Jane Doe} [B0015T963C]', true)).to.deep.equal({
      title: 'Title', subtitle: 'Subtitle', asin: 'B0015T963C', authors: ['Author'],
      narrators: ['Jane Doe'], seriesName: 'Series', seriesSequence: '2', publishedYear: '2020'
    })
  })

  it('distinguishes numbered titles from series sequences', () => {
    expect(scanUtils.getBookDataFromDir('Author/Series/101 Dalmations').seriesSequence).to.equal(null)
    expect(scanUtils.getBookDataFromDir('Author/Series/0.5 - Title').seriesSequence).to.equal('0.5')
    expect(scanUtils.getBookDataFromDir('Author/Book 2 - Title').title).to.equal('Book 2 - Title')
  })

  it('excludes root podcast files and ebook-only podcast directories', () => {
    const items = ['episode.mp3', 'Podcast/episode.MP3', 'Ebooks/book.epub'].map(fileItem)
    expect(scanUtils.groupFileItemsIntoLibraryItemDirs('podcast', items, false)).to.deep.equal({ Podcast: ['episode.MP3'] })
    expect(scanUtils.groupFileItemsIntoLibraryItemDirs('book', [fileItem('Ebooks/book.epub')], true)).to.deep.equal({})
  })

  it('includes cover and metadata-only directories when requested by the watcher', () => {
    const items = ['Cover/cover.jpg', 'Metadata/metadata.json', 'Unknown/file.xyz', 'cover.jpg'].map(fileItem)
    expect(scanUtils.groupFileItemsIntoLibraryItemDirs('book', items, false)).to.deep.equal({})
    expect(scanUtils.groupFileItemsIntoLibraryItemDirs('book', items, false, true)).to.deep.equal({
      Cover: ['cover.jpg'], Metadata: ['metadata.json']
    })
  })

  it('preserves the error for a root-file and directory name collision', () => {
    const items = ['book.mp3', 'book.mp3/track.mp3'].map(fileItem)
    expect(() => scanUtils.groupFileItemsIntoLibraryItemDirs('book', items, false)).to.throw(TypeError)
  })

  it('returns only a title for podcasts and normalizes Windows paths', () => {
    const previousIsWin = global.isWin
    try {
      global.isWin = true
      expect(scanUtils.getDataFromMediaDir('podcast', '/library', 'Author\\Podcast')).to.deep.equal({
        mediaMetadata: { title: 'Podcast' }, relPath: 'Author/Podcast', path: '/library/Author/Podcast'
      })
    } finally {
      global.isWin = previousIsWin
    }
  })

  it('recognizes audio extensions case-insensitively', () => {
    expect(scanUtils.checkFilepathIsAudioFile('/library/book.MP3')).to.equal(true)
    expect(scanUtils.checkFilepathIsAudioFile('/library/book.epub')).to.equal(false)
    expect(scanUtils.checkFilepathIsAudioFile('/library/book')).to.equal(false)
  })

  it('builds library files with real temporary file metadata', async () => {
    const fs = require('fs/promises')
    const os = require('os')
    const directory = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-scandir-'))
    try {
      await fs.writeFile(Path.join(directory, 'track.mp3'), 'audio')
      const files = await scanUtils.buildLibraryFile(directory, ['track.mp3'])
      expect(files).to.have.length(1)
      expect(files[0].fileType).to.equal('audio')
      expect(files[0].metadata.filename).to.equal('track.mp3')
      expect(await scanUtils.buildLibraryFile(directory, [])).to.deep.equal([])
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
})
