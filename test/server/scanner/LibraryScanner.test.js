const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const rewire = require('rewire')
const fileUtils = require('../../../server/utils/fileUtils')
const Database = require('../../../server/Database')
const { Sequelize } = require('sequelize')
const LibraryFile = require('../../../server/objects/files/LibraryFile')
const LibraryItem = require('../../../server/models/LibraryItem')
const FileMetadata = require('../../../server/objects/metadata/FileMetadata')
const Path = require('path')

describe('LibraryScanner', () => {
  let getInoStub, getDeviceIdStub, getFileTimestampsWithInoStub, LibraryScanner, testLibrary

  beforeEach(async () => {
    getInoStub = sinon.stub(fileUtils, 'getIno')
    getInoStub.callsFake((path) => {
      const normalizedPath = fileUtils.filePathToPOSIX(path).replace(/\/$/, '')
      const stats = getMockFileInfo().get(normalizedPath)
      if (stats) {
        return stats.ino
      } else {
        return null
      }
    })

    getDeviceIdStub = sinon.stub(fileUtils, 'getDeviceId')
    getDeviceIdStub.callsFake(async (path) => {
      const normalizedPath = fileUtils.filePathToPOSIX(path).replace(/\/$/, '')
      const stats = getMockFileInfo().get(normalizedPath)
      if (stats) {
        return stats.dev
      } else {
        return null
      }
    })

    getFileTimestampsWithInoStub = sinon.stub(fileUtils, 'getFileTimestampsWithIno')
    getFileTimestampsWithInoStub.callsFake(async (path) => {
      const normalizedPath = fileUtils.filePathToPOSIX(path).replace(/\/$/, '')
      const stats = getMockFileInfo().get(normalizedPath)
      if (stats) {
        return stats
      } else {
        return null
      }
    })

    LibraryScanner = rewire('../../../server/scanner/LibraryScanner')
  })

  afterEach(() => {
    sinon.restore()
  })

  it('findsByInodeAndDeviceId', async function () {
    // this.timeout(50000) // Note: don't use arrow function or timeout for debugging doesn't work
    let findLibraryItemByItemToFileInoMatch = LibraryScanner.__get__('findLibraryItemByItemToFileInoMatch')
    let fullPath = '/test/file.pdf'

    let mockFileInfo = getMockFileInfo()
    testLibrary = await loadTestDatabase(mockFileInfo)

    const fileInfo = mockFileInfo.get(fullPath)

    /** @type {Promise<import('../../../server/models/LibraryItem') | null>} */
    const result = await findLibraryItemByItemToFileInoMatch(testLibrary.id, fullPath, true)
    expect(result).to.not.be.null
    expect(result.libraryFiles[0].metadata.path).to.equal(fullPath)
    expect(result.libraryFiles[0].deviceId).to.equal(fileInfo.dev)
  })

  it('findsTheCorrectItemByInodeAndDeviceIdWhenThereAreDuplicateInodes', async () => {
    let findLibraryItemByItemToFileInoMatch = LibraryScanner.__get__('findLibraryItemByItemToFileInoMatch')
    let fullPath = '/mnt/drive/file-same-ino-different-dev.pdf'

    let mockFileInfo = getMockFileInfo()
    testLibrary = await loadTestDatabase(mockFileInfo)

    const fileInfo = mockFileInfo.get(fullPath)

    /** @type {Promise<import('../../../server/models/LibraryItem') | null>} */
    const result = await findLibraryItemByItemToFileInoMatch(testLibrary.id, fullPath, true)
    expect(result).to.not.be.null
    expect(result.libraryFiles[0].metadata.path).to.equal(fullPath)
    expect(result.libraryFiles[0].deviceId).to.equal(fileInfo.dev)
  })

  it('findLibraryItemByItemToItemInoMatch', async function () {
    this.timeout(0)
    // findLibraryItemByItemToItemInoMatch(libraryId, fullPath)
    // findLibraryItemByFileToItemInoMatch(libraryId, fullPath, isSingleMedia, itemFiles)
    let findLibraryItemByItemToItemInoMatch = LibraryScanner.__get__('findLibraryItemByItemToItemInoMatch')

    let fullPath = '/test/file.pdf'

    let mockFileInfo = getMockFileInfo()
    testLibrary = await loadTestDatabase(mockFileInfo)

    const fileInfo = mockFileInfo.get(fullPath)

    /** @type {Promise<import('../../../server/models/LibraryItem') | null>} */
    const result = await findLibraryItemByItemToItemInoMatch(testLibrary.id, fullPath)
    expect(result).to.not.be.null
    expect(result.libraryFiles[0].metadata.path).to.equal(fullPath)
    expect(result.libraryFiles[0].deviceId).to.equal(fileInfo.dev)
  })

  // ItemToFileInoMatch
  it('ItemToFileInoMatch-ItemMatchesSelf', async function () {
    this.timeout(0)
    /**
     * @param {import("../../../server/models/LibraryItem") | import("../../../server/scanner/LibraryItemScanData")} libraryItem1
     * @param {import("../../../server/models/LibraryItem") | import("../../../server/scanner/LibraryItemScanData")} libraryItem2
     */
    let ItemToFileInoMatch = LibraryScanner.__get__('ItemToFileInoMatch')

    // this compares the inode from the first library item to the second library item's library file inode
    let mockFileInfo = getMockFileInfo()
    testLibrary = await loadTestDatabase(mockFileInfo)

    const fileInfo = mockFileInfo.get('/test/file.pdf')

    let item1 = await Database.libraryItemModel.findOneExpanded({
      libraryId: testLibrary.id,
      // @ts-ignore
      ino: fileInfo.ino
    })

    expect(ItemToFileInoMatch(item1, item1)).to.be.true
  })

  it('ItemToFileInoMatch-TwoItemsWithSameInoButDifferentDeviceShouldNotMatch', async function () {
    this.timeout(0)
    /**
     * @param {import("../../../server/models/LibraryItem") | import("../../../server/scanner/LibraryItemScanData")} libraryItem1
     * @param {import("../../../server/models/LibraryItem") | import("../../../server/scanner/LibraryItemScanData")} libraryItem2
     */
    let ItemToFileInoMatch = LibraryScanner.__get__('ItemToFileInoMatch')

    let mockFileInfo = getMockFileInfo()
    testLibrary = await loadTestDatabase(mockFileInfo)

    // this compares the inode from the first library item to the second library item's library file inode
    const item1 = await Database.libraryItemModel.findOneExpanded({
      libraryId: testLibrary.id,
      path: '/test/file.pdf'
    })

    const item2 = await Database.libraryItemModel.findOneExpanded({
      libraryId: testLibrary.id,
      path: '/mnt/drive/file-same-ino-different-dev.pdf'
    })

    expect(item1.path).to.not.equal(item2.path)

    expect(ItemToFileInoMatch(item1, item2)).to.be.false
  })

  it('ItemToFileInoMatch-RenamedFileShouldMatch', async function () {
    this.timeout(0)
    /**
     * @param {import("../../../server/models/LibraryItem") | import("../../../server/scanner/LibraryItemScanData")} libraryItem1
     * @param {import("../../../server/models/LibraryItem") | import("../../../server/scanner/LibraryItemScanData")} libraryItem2
     */
    let ItemToFileInoMatch = LibraryScanner.__get__('ItemToFileInoMatch')

    let mockFileInfo = getMockFileInfo()
    testLibrary = await loadTestDatabase(mockFileInfo)

    // this compares the inode from the first library item to the second library item's library file inode
    const original = await Database.libraryItemModel.findOneExpanded({
      libraryId: testLibrary.id,
      path: '/test/file.pdf'
    })

    const renamedMockFileInfo = getRenamedMockFileInfo().get('/test/file-renamed.pdf')
    const renamedFile = new LibraryFile()
    var fileMetadata = new FileMetadata()
    fileMetadata.setData(renamedMockFileInfo)
    fileMetadata.filename = Path.basename(renamedMockFileInfo.path)
    fileMetadata.path = fileUtils.filePathToPOSIX(renamedMockFileInfo.path)
    fileMetadata.relPath = fileUtils.filePathToPOSIX(renamedMockFileInfo.path)
    fileMetadata.ext = Path.extname(renamedMockFileInfo.path)
    renamedFile.ino = renamedMockFileInfo.ino
    renamedFile.deviceId = renamedMockFileInfo.dev
    renamedFile.metadata = fileMetadata
    renamedFile.addedAt = Date.now()
    renamedFile.updatedAt = Date.now()
    renamedFile.metadata = fileMetadata

    const renamedItem = new LibraryItem(buildBookLibraryItemParams(renamedFile, null, testLibrary.id, null))

    expect(ItemToFileInoMatch(original, renamedItem)).to.be.true
  })

  // ItemToItemInoMatch
  it('ItemToItemInoMatch-ItemMatchesSelf', async function () {
    this.timeout(0)
    /**
     * @param {import("../../../server/models/LibraryItem") | import("../../../server/scanner/LibraryItemScanData")} libraryItem1
     * @param {import("../../../server/models/LibraryItem") | import("../../../server/scanner/LibraryItemScanData")} libraryItem2
     */
    let ItemToItemInoMatch = LibraryScanner.__get__('ItemToItemInoMatch')

    // this compares the inode from the first library item to the second library item's library file inode
    let mockFileInfo = getMockFileInfo()
    testLibrary = await loadTestDatabase(mockFileInfo)

    const fileInfo = mockFileInfo.get('/test/file.pdf')

    let item1 = await Database.libraryItemModel.findOneExpanded({
      libraryId: testLibrary.id,
      // @ts-ignore
      ino: fileInfo.ino
    })

    expect(ItemToItemInoMatch(item1, item1)).to.be.true
  })

  it('ItemToItemInoMatch-TwoItemsWithSameInoButDifferentDeviceShouldNotMatch', async () => {
    let ItemToItemInoMatch = LibraryScanner.__get__('ItemToItemInoMatch')

    let mockFileInfo = getMockFileInfo()
    testLibrary = await loadTestDatabase(mockFileInfo)

    // this compares the inode from the first library item to the second library item's library file inode
    const item1 = await Database.libraryItemModel.findOneExpanded({
      libraryId: testLibrary.id,
      path: '/test/file.pdf'
    })

    const item2 = await Database.libraryItemModel.findOneExpanded({
      libraryId: testLibrary.id,
      path: '/mnt/drive/file-same-ino-different-dev.pdf'
    })

    expect(item1.path).to.not.equal(item2.path)

    expect(ItemToItemInoMatch(item1, item2)).to.be.false
  })

  it('ItemToItemInoMatch-RenamedFileShouldMatch', () => {
    let ItemToItemInoMatch = LibraryScanner.__get__('ItemToItemInoMatch')
  })
})

async function loadTestDatabase(mockFileInfo) {
  let libraryItem1Id, libraryItem2Id

  let fileInfo = mockFileInfo || getMockFileInfo()
  let bookLibraryFiles = fileInfo.keys().reduce((acc, key) => {
    let bookfile = new LibraryFile()
    bookfile.setDataFromPath(key, key)
    acc.push(bookfile)
    return acc
  }, [])

  global.ServerSettings = {}
  Database.sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    // Choose one of the logging options
    logging: (...msg) => console.log(msg),
    logQueryParameters: true
  })
  Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
  await Database.buildModels()

  const newLibrary = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
  const newLibraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: newLibrary.id })
  const newLibraryFolder2 = await Database.libraryFolderModel.create({ path: '/mnt/drive', libraryId: newLibrary.id })

  const newBook = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
  const newLibraryItem = await Database.libraryItemModel.create(buildBookLibraryItemParams(bookLibraryFiles[0], newBook.id, newLibrary.id, newLibraryFolder.id))
  libraryItem1Id = newLibraryItem.id

  const newBook2 = await Database.bookModel.create({ title: 'Test Book 2', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
  const newLibraryItem2 = await Database.libraryItemModel.create(buildBookLibraryItemParams(bookLibraryFiles[1], newBook2.id, newLibrary.id, newLibraryFolder2.id))
  libraryItem2Id = newLibraryItem2.id

  return newLibrary
}

/**
 * @param {LibraryFile} libraryFile
 * @param {any} bookId
 * @param {string} libraryId
 * @param {any} libraryFolderId
 */
function buildBookLibraryItemParams(libraryFile, bookId, libraryId, libraryFolderId) {
  return {
    path: libraryFile.metadata.path,
    isFile: true,
    ino: libraryFile.ino,
    deviceId: libraryFile.deviceId,
    libraryFiles: [libraryFile.toJSON()],
    mediaId: bookId,
    mediaType: 'book',
    libraryId: libraryId,
    libraryFolderId: libraryFolderId
  }
}

/** @returns {Map<string, import('fs').Stats>} */
function getMockFileInfo() {
  // @ts-ignore
  return new Map([
    ['/test/file.pdf', { path: '/test/file.pdf', isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '1', dev: '100' }],
    ['/mnt/drive/file-same-ino-different-dev.pdf', { path: '/mnt/drive/file-same-ino-different-dev.pdf', isDirectory: () => false, size: 42, mtimeMs: Date.now(), ino: '1', dev: '200' }]
  ])
}

/** @returns {Map<string, import('fs').Stats>} */
// this has the same data as above except one file has been renamed
function getRenamedMockFileInfo() {
  // @ts-ignore
  return new Map([
    ['/test/file-renamed.pdf', { path: '/test/file-renamed.pdf', isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '1', dev: '100' }],
    ['/mnt/drive/file-same-ino-different-dev.pdf', { path: '/mnt/drive/file-same-ino-different-dev.pdf', isDirectory: () => false, size: 42, mtimeMs: Date.now(), ino: '1', dev: '200' }]
  ])
}
