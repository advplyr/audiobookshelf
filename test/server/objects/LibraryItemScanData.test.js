const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const rewire = require('rewire')
const Path = require('path')

const { stubFileUtils, getMockFileInfo, loadTestDatabase, buildFileProperties } = require('../MockDatabase')

const LibraryItemScanData = require('../../../server/scanner/LibraryItemScanData')
const LibraryFile = require('../../../server/objects/files/LibraryFile')
const LibraryScan = require('../../../server/scanner/LibraryScan')

// TODO - need to check
// compareUpdateLibraryFile - returns false if no changes; true if changes
describe('compareUpdateLibraryFileWithDeviceId', () => {
  it('fileChangeDetectedWhenInodeAndDeviceIdPairDiffers', () => {
    const existing_lf = buildLibraryFileObject('/tmp/file.pdf', '4432', '300')
    const scanned_lf = new LibraryFile({
      ino: '1',
      deviceId: '100'
    })

    expect(existing_lf.ino).to.not.equal(scanned_lf.ino)
    expect(existing_lf.deviceId).to.not.equal(scanned_lf.deviceId)
    const changeDetected = LibraryItemScanData.compareUpdateLibraryFile('/file/path.pdf', existing_lf, scanned_lf, new LibraryScan())
    expect(changeDetected).to.be.true
  })

  it('fileChangeNotDetectedWhenInodeSameButDeviceIdDiffers', () => {
    // Same inode on different deviceId does NOT mean these are the same file
    const existing_lf = buildLibraryFileObject('/tmp/file.pdf', '4432', '300')
    const scanned_lf = new LibraryFile(buildLibraryFileObject('/tmp/file.pdf', '4432', '100'))

    expect(existing_lf.ino).to.equal(scanned_lf.ino)
    expect(existing_lf.deviceId).to.not.equal(scanned_lf.deviceId)
    const changeDetected = LibraryItemScanData.compareUpdateLibraryFile('/file/path.pdf', existing_lf, scanned_lf, new LibraryScan())
    expect(changeDetected).to.be.false
  })
})

/**
 * @returns {import('../../../server/models/LibraryItem').LibraryFileObject}
 * @param {string} [path]
 * @param {string} [ino]
 * @param {string} [deviceId]
 */
function buildLibraryFileObject(path, ino, deviceId) {
  return {
    ino: ino,
    deviceId: deviceId,
    isSupplementary: false,
    addedAt: 0,
    updatedAt: 0,
    metadata: {
      filename: Path.basename(path),
      ext: Path.extname(path),
      path: path,
      relPath: path,
      size: 0,
      mtimeMs: 0,
      ctimeMs: 0,
      birthtimeMs: 0
    }
  }
}
// checkEbookFileRemoved
// checkAudioFileRemoved
// libraryItemObject()
/*
new LibraryItemScanData({
    libraryFolderId: folder.id,
    libraryId: library.id,
    mediaType: library.mediaType,
    ino: libraryItemStats.ino,
    deviceId: libraryItemStats.dev,
    mtimeMs: libraryItemStats.mtimeMs || 0,
    ctimeMs: libraryItemStats.ctimeMs || 0,
    birthtimeMs: libraryItemStats.birthtimeMs || 0,
    path: libraryItemData.path,
    relPath: libraryItemData.relPath,
    isFile: isSingleMediaItem,
    mediaMetadata: libraryItemData.mediaMetadata || null,
    libraryFiles
  })

*/
