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
        path: filePath,
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

  it('should keep nested book folders separate when a parent folder also contains a direct media file', async () => {
    const filePaths = [
      'Series Alpha/Standalone Side Story.m4b',
      'Series Alpha/Standalone Side Story.nfo',
      'Series Alpha/Author Example - Book One Main Saga, Book 1/Book One Main Saga, Book 1.m4b',
      'Series Alpha/Author Example - Book One Main Saga, Book 1/Book One Main Saga, Book 1.cue',
      'Series Alpha/Author Example - Book Two Main Saga, Book 2/Book Two Main Saga, Book 2.m4b',
      'Series Alpha/Author Example - Book Two Main Saga, Book 2/Book Two Main Saga, Book 2.nfo'
    ]

    const fileItems = filePaths.map((filePath) => {
      const dirname = Path.dirname(filePath)
      return {
        name: Path.basename(filePath),
        path: filePath,
        reldirpath: dirname === '.' ? '' : dirname,
        extension: Path.extname(filePath),
        deep: filePath.split('/').length - 1
      }
    })

    const libraryItemGrouping = scanUtils.groupFileItemsIntoLibraryItemDirs('book', fileItems, false)

    expect(libraryItemGrouping).to.deep.equal({
      'Series Alpha/Standalone Side Story.m4b': [
        'Series Alpha/Standalone Side Story.m4b',
        'Series Alpha/Standalone Side Story.nfo'
      ],
      'Series Alpha/Author Example - Book One Main Saga, Book 1': [
        'Book One Main Saga, Book 1.m4b',
        'Book One Main Saga, Book 1.cue'
      ],
      'Series Alpha/Author Example - Book Two Main Saga, Book 2': [
        'Book Two Main Saga, Book 2.m4b',
        'Book Two Main Saga, Book 2.nfo'
      ]
    })
  })
})
