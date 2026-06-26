const chai = require('chai')
const expect = chai.expect
const Path = require('path')

const { buildFileProperties, buildLibraryFileProperties } = require('../MockDatabase')

const LibraryItemScanData = require('../../../server/scanner/LibraryItemScanData')
const LibraryFile = require('../../../server/objects/files/LibraryFile')
const LibraryScan = require('../../../server/scanner/LibraryScan')
const ScanLogger = require('../../../server/scanner/ScanLogger')
describe('LibraryItemScanData', () => {
  // compareUpdateLibraryFile - returns false if no changes; true if changes
  describe('compareUpdateLibraryFileWithDeviceId', () => {
    it('fileChangeDetectedWhenInodeAndDeviceIdPairDiffers', () => {
      const existing_lf = buildLibraryFileProperties('/tmp/file.pdf', '4432', '300')
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
      const existing_lf = buildLibraryFileProperties('/tmp/file.pdf', '4432', '300')
      const scanned_lf = new LibraryFile(buildLibraryFileProperties('/tmp/file.pdf', '4432', '100'))

      expect(existing_lf.ino).to.equal(scanned_lf.ino)
      expect(existing_lf.deviceId).to.not.equal(scanned_lf.deviceId)
      const changeDetected = LibraryItemScanData.compareUpdateLibraryFile('/file/path.pdf', existing_lf, scanned_lf, new LibraryScan())
      expect(changeDetected).to.be.false
    })
  })

  describe('findMatchingLibraryFileByPathOrInodeAndDeviceId', () => {
    it('isMatchWhenInodeAndDeviceIdPairIsSame', () => {
      const lisd = new LibraryItemScanData(buildFileProperties('/library/book/file.epub', '1', '1000', [new LibraryFile(buildLibraryFileProperties('/library/book/file.epub', '1', '1000'))]))

      const scanned_lf_properties = buildLibraryFileProperties('/tmp/file.epub', '1', '1000')

      const matchingFile = lisd.findMatchingLibraryFileByPathOrInodeAndDeviceId(scanned_lf_properties, new ScanLogger())

      // don't want match based on filename
      expect(lisd.path).to.not.equal(scanned_lf_properties.metadata.path)
      expect(matchingFile).to.not.be.undefined
      expect(matchingFile?.ino).to.equal(lisd.ino)
      expect(matchingFile?.deviceId).to.equal(lisd.deviceId)
    })
    it('isNotMatchWhenInodeSameButDeviceIdDiffers', () => {
      const lisd = new LibraryItemScanData(buildFileProperties('/library/book/file.epub', '1', '1000', [new LibraryFile(buildLibraryFileProperties('/library/book/file.epub', '1', '1000'))]))

      const scanned_lf_properties = buildLibraryFileProperties('/tmp/file.epub', '1', '500')

      // don't want match based on filename
      expect(lisd.path).to.not.equal(scanned_lf_properties.metadata.path)
      expect(lisd.deviceId).to.not.equal(scanned_lf_properties.ino)

      const matchingFile = lisd.findMatchingLibraryFileByPathOrInodeAndDeviceId(scanned_lf_properties, new ScanLogger())

      expect(matchingFile).to.be.undefined
    })
  })

  describe('checkAudioFileRemoved', function () {
    this.timeout(0)
    it('doesNotDetectFileRemovedWhenInodeIsSameButDeviceIdDiffers', () => {
      const lisd = new LibraryItemScanData(buildFileProperties('/library/book/file.mp3', '1', '1000'))
      lisd.libraryFilesRemoved.push(buildLibraryFileProperties('/library/book/file.mp3', '1', '1000'))
      const af_obj = buildAudioFileObject('/library/someotherbook/chapter1.mp3', '1', '200')

      const fileRemoved = lisd.checkAudioFileRemoved(af_obj)

      expect(fileRemoved).to.be.false
    })

    it('detectsFileRemovedWhenNameDoesNotMatchButInodeAndDeviceIdMatch', () => {
      const lisd = new LibraryItemScanData(buildFileProperties('/library/book/file.mp3', '1', '1000'))
      lisd.libraryFilesRemoved.push(buildLibraryFileProperties('/library/book/file.mp3', '1', '1000'))
      const af_obj = buildAudioFileObject('/library/someotherbook/chapter1.mp3', '1', '1000')

      expect(lisd.path).to.not.equal(af_obj.metadata.path)
      const fileRemoved = lisd.checkAudioFileRemoved(af_obj)

      expect(fileRemoved).to.be.true
    })
  })

  // checkEbookFileRemoved
  describe('checkEbookFileRemoved', () => {
    it('doesNotDetectFileRemovedWhenInodeIsSameButDeviceIdDiffers', () => {
      const lisd = new LibraryItemScanData(buildFileProperties('/library/book/file.epub', '1', '1000', [new LibraryFile(buildLibraryFileProperties('/library/book/file.epub', '1', '1000'))]))
      lisd.libraryFilesRemoved.push(buildLibraryFileProperties('/library/book/file.epub', '1', '1000')) // This is the file that was removed
      const ebook_obj = buildEbookFileObject('/library/someotherbook/chapter1.epub', '1', '200') // this file was NOT removed

      expect(lisd.path).to.not.equal(ebook_obj.metadata.path)
      const fileRemoved = lisd.checkEbookFileRemoved(ebook_obj)

      expect(fileRemoved).to.be.false
    })

    it('detectsFileRemovedWhenInodeAndDeviceIdIsSame', () => {
      const lisd = new LibraryItemScanData(buildFileProperties('/library/book/file.epub', '1', '1000', [new LibraryFile(buildLibraryFileProperties('/library/book/file.epub', '1', '1000'))]))
      lisd.libraryFilesRemoved.push(buildLibraryFileProperties('/library/book/file.epub', '1', '1000')) // This is the file that was removed
      const ebook_obj = buildEbookFileObject('/library/someotherbook/chapter1.epub', '1', '1000') // this file was removed

      expect(lisd.path).to.not.equal(ebook_obj.metadata.path)
      const fileRemoved = lisd.checkEbookFileRemoved(ebook_obj)

      expect(fileRemoved).to.be.true
    })
  })

  // libraryItemObject()
  describe('libraryItemObject', () => {
    it('setsDeviceIdOnLibraryObject', () => {
      const lisd = new LibraryItemScanData(buildFileProperties('/library/book/file.epub', '1', '1000', [new LibraryFile(buildLibraryFileProperties('/library/book/file.epub', '1', '1000'))]))
      expect(lisd.libraryItemObject.ino).to.equal(lisd.ino)
      expect(lisd.libraryItemObject.deviceId).to.equal(lisd.deviceId)
    })
  })
})

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

/** @returns {import('../../../server/models/Book').EBookFileObject} */
function buildEbookFileObject(path = '/library/somebook/file.epub', ino = '100', deviceId = '1000') {
  return {
    ino: ino,
    deviceId: deviceId,
    ebookFormat: Path.extname(path),
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
