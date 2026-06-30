const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const rewire = require('rewire')
const fileUtils = require('../../../server/utils/fileUtils')
const LibraryFile = require('../../../server/objects/files/LibraryFile')
const LibraryItem = require('../../../server/models/LibraryItem')
const FileMetadata = require('../../../server/objects/metadata/FileMetadata')
const Path = require('path')
const Database = require('../../../server/Database')
const { stubFileUtils, loadTestDatabase, getMockFileInfo, getRenamedMockFileInfo, buildBookLibraryItemParams, buildFileProperties, buildLibraryFileProperties } = require('../MockDatabase')
const libraryScannerInstance = require('../../../server/scanner/LibraryScanner')
const LibraryScan = require('../../../server/scanner/LibraryScan')

describe('LibraryScanner', () => {
  let LibraryScanner, testLibrary

  beforeEach(async () => {
    stubFileUtils()

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
    let findLibraryItemByItemToItemInoMatch = LibraryScanner.__get__('findLibraryItemByItemToItemInoMatch')

    let fullPath = '/test/file.pdf'

    let mockFileInfo = getMockFileInfo()
    testLibrary = await loadTestDatabase(mockFileInfo)

    const fileInfo = mockFileInfo.get(fullPath)

    /** @returns {Promise<import('../../../server/models/LibraryItem') | null>} */
    const result = await findLibraryItemByItemToItemInoMatch(testLibrary.id, fullPath)
    expect(result).to.not.be.null
    expect(result.libraryFiles[0].metadata.path).to.equal(fullPath)
    expect(result.libraryFiles[0].deviceId).to.equal(fileInfo.dev)
  })

  it('findLibraryItemByFileToItemInoMatch-matchesRenamedFileByInoAndDeviceId', async function () {
    this.timeout(0)
    let mockFileInfo = getMockBookFileInfo()
    sinon.restore()
    stubFileUtils(mockFileInfo)
    testLibrary = await loadTestDatabase(mockFileInfo)

    // findLibraryItemByFileToItemInoMatch(libraryId, fullPath, isSingleMedia, itemFiles)
    let findLibraryItemByItemToItemInoMatch = LibraryScanner.__get__('findLibraryItemByFileToItemInoMatch')

    let bookFolderPath = '/test/bookfolder'

    /**
     * @param {UUIDV4} libraryId
     * @param {string} fullPath
     * @param {boolean} isSingleMedia
     * @param {string[]} itemFiles
     * @returns {Promise<import('../models/LibraryItem').LibraryItemExpanded | null>} library item that matches
     */
    const existingItem = await findLibraryItemByItemToItemInoMatch(testLibrary.id, bookFolderPath, false, ['file.epub', 'file-renamed.epub', 'file.opf'])

    expect(existingItem).to.not.be.null
    expect(existingItem.ino).to.equal('1')
    expect(existingItem.deviceId).to.equal('100')
  })

  it('findLibraryItemByFileToItemInoMatch-DoesNotMatchByInoAndDifferentDeviceId', async function () {
    this.timeout(0)
    testLibrary = await loadTestDatabase()

    // findLibraryItemByFileToItemInoMatch(libraryId, fullPath, isSingleMedia, itemFiles)
    let findLibraryItemByItemToItemInoMatch = LibraryScanner.__get__('findLibraryItemByFileToItemInoMatch')

    let bookFolderPath = '/test/bookfolder'

    /**
     * @param {UUIDV4} libraryId
     * @param {string} fullPath
     * @param {boolean} isSingleMedia
     * @param {string[]} itemFiles
     * @returns {Promise<import('../models/LibraryItem').LibraryItemExpanded | null>} library item that matches
     */
    const existingItem = await findLibraryItemByItemToItemInoMatch(testLibrary.id, bookFolderPath, false, ['file.epub', 'different-file.epub', 'file.opf'])

    expect(existingItem).to.be.null
  })

  /** @returns {Map<string, import('fs').Stats>} */
  function getMockBookFileInfo() {
    // @ts-ignore
    return new Map([
      ['/test/bookfolder/file-renamed.epub', { path: '/test/bookfolder/file-renamed.epub', isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '1', dev: '100' }],
      ['/test/bookfolder/file.epub', { path: '/test/bookfolder/file.epub', isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '1', dev: '100' }],
      ['/test/bookfolder/different-file.epub', { path: '/test/bookfolder/different-file.epub', isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '1', dev: '200' }],
      ['/test/bookfolder/file.opf', { path: '/test/bookfolder/file.opf', isDirectory: () => false, size: 42, mtimeMs: Date.now(), ino: '2', dev: '100' }]
    ])
  }

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

  it('ItemToItemInoMatch-RenamedFileShouldMatch', async () => {
    let ItemToItemInoMatch = LibraryScanner.__get__('ItemToItemInoMatch')

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

    expect(ItemToItemInoMatch(original, renamedItem)).to.be.true
  })

  describe('createLibraryItemScanData', () => {
    it('createLibraryItemScanDataSetsDeviceId', async () => {
      /**
       * @param {{ id: any; libraryId: any; }} folder
       * @param {{ mediaType: any; }} library
       * @param {{ ino: any; dev: any; mtimeMs: any; ctimeMs: any; birthtimeMs: any; }} libraryItemFolderStats
       * @param {{ path: any; relPath: any; mediaMetadata: any; }} libraryItemData
       * @param {any} isFile
       * @param {any} fileObjs
       * @returns {LibraryItemScanData} new object
       */
      const createLibraryItemScanData = LibraryScanner.__get__('createLibraryItemScanData')

      const liFolderStats = { path: '/library/book/file.epub', isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '1', dev: '1000' }
      const lf_properties = buildLibraryFileProperties('/library/book/file.epub', '1', '1000')
      const libraryFile = new LibraryFile(lf_properties)

      const lisd = createLibraryItemScanData({ id: 'foo', libraryId: 'bar' }, { mediaType: 'ebook' }, liFolderStats, lf_properties, true, [libraryFile.toJSON()])

      expect(lisd).to.not.be.null
      expect(lisd.ino).to.equal(liFolderStats.ino)
      expect(lisd.deviceId).to.equal(liFolderStats.dev)
    })
  })
})
