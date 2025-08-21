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

describe('checkAudioFileRemoved', function () {
  this.timeout(0)
  it('doesNotDetectFileRemovedWhenInodeIsSameButDeviceIdDiffers', () => {
    const lisd = new LibraryItemScanData(buildFileProperties('/library/book/file.mp3', '1', '1000'))
    lisd.libraryFilesRemoved.push(buildLibraryFileObject('/library/book/file.mp3', '1', '1000'))
    const af_obj = buildAudioFileObject('/library/someotherbook/chapter1.mp3', '1', '200')

    const fileRemoved = lisd.checkAudioFileRemoved(af_obj)

    expect(fileRemoved).to.be.false
  })

  it('detectsFileRemovedWhenNameDoesNotMatchButInodeAndDeviceIdMatch', () => {
    const lisd = new LibraryItemScanData(buildFileProperties('/library/book/file.mp3', '1', '1000'))
    lisd.libraryFilesRemoved.push(buildLibraryFileObject('/library/book/file.mp3', '1', '1000'))
    const af_obj = buildAudioFileObject('/library/someotherbook/chapter1.mp3', '1', '1000')

    expect(lisd.path).to.not.equal(af_obj.metadata.path)
    const fileRemoved = lisd.checkAudioFileRemoved(af_obj)

    expect(fileRemoved).to.be.true
  })
})

// checkEbookFileRemoved

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

/** @returns {import('../../../server/models/Book').AudioFileObject} */
function buildAudioFileObject(path = '/library/somebook/file.mp3', ino = '1', deviceId = '1000') {
  return {
    index: 0,
    ino: ino,
    deviceId: deviceId,
    metadata: {
      filename: Path.basename(path),
      ext: Path.extname(path),
      path: path,
      relPath: path,
      size: 0,
      mtimeMs: 0,
      ctimeMs: 0,
      birthtimeMs: 0
    },
    addedAt: 0,
    updatedAt: 0,
    trackNumFromMeta: 0,
    discNumFromMeta: 0,
    trackNumFromFilename: 0,
    discNumFromFilename: 0,
    manuallyVerified: false,
    format: '',
    duration: 0,
    bitRate: 0,
    language: '',
    codec: '',
    timeBase: '',
    channels: 0,
    channelLayout: '',
    chapters: [],
    metaTags: undefined,
    mimeType: ''
  }
}
