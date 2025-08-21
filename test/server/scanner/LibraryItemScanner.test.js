const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const rewire = require('rewire')
const Path = require('path')

const { stubFileUtils, getMockFileInfo, loadTestDatabase } = require('../MockDatabase')

const LibraryFile = require('../../../server/objects/files/LibraryFile')
const FileMetadata = require('../../../server/objects/metadata/FileMetadata')
const LibraryFolder = require('../../../server/models/LibraryFolder')

describe('buildLibraryItemScanData', () => {
  let testLibrary = null
  beforeEach(async () => {
    stubFileUtils()
    testLibrary = await loadTestDatabase()
  })

  afterEach(() => {
    sinon.restore()
  })

  it('setsDeviceId', async () => {
    const libraryItemScanner = rewire('../../../server/scanner/LibraryItemScanner')

    /**
     * @param {{ path?: any; relPath?: any; mediaMetadata?: any; }} libraryItemData
     * @param {import("../../../server/models/LibraryFolder")} folder
     * @param {import("../../../server/models/Library")} library
     * @param {boolean} isSingleMediaItem
     * @param {LibraryFile[]} libraryFiles
     * @return {import('../../../server/scanner/LibraryItemScanData') | null}
     * */
    const buildLibraryItemScanData = libraryItemScanner.__get__('buildLibraryItemScanData')

    const mockFileInfo = getMockFileInfo().get('/test/file.pdf')
    const lf = new LibraryFile()
    var fileMetadata = new FileMetadata()
    fileMetadata.setData(mockFileInfo)
    fileMetadata.filename = Path.basename(mockFileInfo?.path)
    fileMetadata.path = mockFileInfo?.path
    fileMetadata.relPath = mockFileInfo?.path
    fileMetadata.ext = Path.extname(mockFileInfo?.path)
    lf.ino = mockFileInfo?.ino
    lf.deviceId = mockFileInfo?.dev
    lf.metadata = fileMetadata
    lf.addedAt = Date.now()
    lf.updatedAt = Date.now()
    lf.metadata = fileMetadata

    const libraryItemData = {
      path: mockFileInfo?.path, // full path
      relPath: mockFileInfo?.path, // only filename
      mediaMetadata: {
        title: Path.basename(mockFileInfo?.path, Path.extname(mockFileInfo?.path))
      }
    }

    const scanData = await buildLibraryItemScanData(libraryItemData, buildLibraryFolder(), testLibrary, true, [lf.toJSON()])

    expect(scanData).to.not.be.null
    expect(scanData.deviceId).to.equal(mockFileInfo?.dev)
  })
})

/** @return {import("../../../server/models/LibraryFolder")} folder */
function buildLibraryFolder() {
  return new LibraryFolder()
}
