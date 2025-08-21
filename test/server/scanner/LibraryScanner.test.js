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
const { stubFileUtils, loadTestDatabase, getMockFileInfo, getRenamedMockFileInfo, buildBookLibraryItemParams } = require('../MockDatabase')

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
