const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')

const Path = require('path')
const Database = require('../../../server/Database')
const { loadTestDatabase, stubFileUtils, getMockFileInfo, buildFileProperties } = require('../MockDatabase')

// TODO: all of these classes duplicate each other.
const LibraryFile = require('../../../server/objects/files/LibraryFile')
const EBookFile = require('../../../server/objects/files/EBookFile')
const AudioFile = require('../../../server/objects/files/AudioFile')
const LibraryItemScanData = require('../../../server/scanner/LibraryItemScanData')

const fileProperties = buildFileProperties()
const lf = new LibraryFile(fileProperties)
const ebf = new EBookFile(fileProperties)
const af = new AudioFile(fileProperties)

describe('SimilarLibraryFileObjects', () => {
  describe('ObjectSetsDeviceIdWhenConstructed', function () {
    this.timeout(0)
    beforeEach(async () => {
      stubFileUtils()
      await loadTestDatabase()
    })

    afterEach(() => {
      sinon.restore()
    })

    const lisd = new LibraryItemScanData(fileProperties)

    const objects = [lf, ebf, af, lisd]

    objects.forEach((obj) => {
      it(`${obj.constructor.name}SetsDeviceIdWhenConstructed`, () => {
        expect(obj.ino).to.equal(fileProperties.ino)
        expect(obj.deviceId).to.equal(fileProperties.deviceId)
      })
    })

    it('LibraryItemSetsDeviceIdWhenConstructed', async () => {
      const mockFileInfo = getMockFileInfo().get('/test/file.pdf')

      /** @type {import('../../../server/models/LibraryItem') | null} */
      const li = await Database.libraryItemModel.findOneExpanded({
        path: '/test/file.pdf'
      })

      expect(li?.ino).to.equal(mockFileInfo?.ino)
      expect(li?.deviceId).to.equal(mockFileInfo?.dev)
    })

    it('LibraryFileJSONHasDeviceId', async () => {
      const mockFileInfo = getMockFileInfo().get('/test/file.pdf')

      /** @type {import('../../../server/models/LibraryItem') | null} */
      const li = await Database.libraryItemModel.findOneExpanded({
        path: '/test/file.pdf'
      })

      const lf_json = li?.libraryFiles[0]
      expect(lf_json).to.not.be.null
      expect(lf_json?.deviceId).to.equal(mockFileInfo?.dev)
    })
  })

  describe('ObjectSetsDeviceIdWhenSerialized', () => {
    const objects = [lf, ebf, af]
    objects.forEach((obj) => {
      it(`${obj.constructor.name}SetsDeviceIdWhenSerialized`, () => {
        const obj_json = obj.toJSON()
        expect(obj_json.ino).to.equal(fileProperties.ino)
        expect(obj_json.deviceId).to.equal(fileProperties.deviceId)
      })
    })
  })
})

function buildLibraryItemProperties(fileProperties) {
  return {
    id: '7792E90F-D526-4636-8A38-EA8342E71FEE',
    path: fileProperties.path,
    relPath: fileProperties.path,
    isFile: true,
    ino: fileProperties.ino,
    deviceId: fileProperties.dev,
    libraryFiles: [],
    mediaId: '7195803A-9974-46E4-A7D1-7A6E1AD7FD4B',
    mediaType: 'book',
    libraryId: '907DA361-67E4-47CF-9C67-C8E2E5CA1B15',
    libraryFolderId: 'E2216F60-8ABF-4E55-BA83-AD077EB907F3',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}
