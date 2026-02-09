const Database = require('../../server/Database')
const { Sequelize } = require('sequelize')
const LibraryFile = require('../../server/objects/files/LibraryFile')
const fileUtils = require('../../server/utils/fileUtils')
const FileMetadata = require('../../server/objects/metadata/FileMetadata')
const Path = require('path')
const sinon = require('sinon')

async function loadTestDatabase(mockFileInfo) {
  let libraryItem1Id, libraryItem2Id

  let fileInfo = mockFileInfo || getMockFileInfo()
  // mapping the keys() iterable to an explicit array so reduce() should work consistently.
  let bookLibraryFiles = [...fileInfo.keys()].reduce((acc, key) => {
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
exports.loadTestDatabase = loadTestDatabase

/** @returns {Map<string, import('fs').Stats>} */
function getMockFileInfo() {
  // @ts-ignore
  return new Map([
    ['/test/file.pdf', { path: '/test/file.pdf', isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '1', dev: '100' }],
    ['/mnt/drive/file-same-ino-different-dev.pdf', { path: '/mnt/drive/file-same-ino-different-dev.pdf', isDirectory: () => false, size: 42, mtimeMs: Date.now(), ino: '1', dev: '200' }]
  ])
}

exports.getMockFileInfo = getMockFileInfo
/** @returns {Map<string, import('fs').Stats>} */
// this has the same data as above except one file has been renamed
function getRenamedMockFileInfo() {
  // @ts-ignore
  return new Map([
    ['/test/file-renamed.pdf', { path: '/test/file-renamed.pdf', isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '1', dev: '100' }],
    ['/mnt/drive/file-same-ino-different-dev.pdf', { path: '/mnt/drive/file-same-ino-different-dev.pdf', isDirectory: () => false, size: 42, mtimeMs: Date.now(), ino: '1', dev: '200' }]
  ])
}
exports.getRenamedMockFileInfo = getRenamedMockFileInfo

/**
 * @param {LibraryFile} libraryFile
 * @param {any} bookId
 * @param {string} libraryId
 * @param {any} libraryFolderId
 */
function buildBookLibraryItemParams(libraryFile, bookId, libraryId, libraryFolderId) {
  return {
    path: libraryFile.metadata?.path,
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
exports.buildBookLibraryItemParams = buildBookLibraryItemParams

function stubFileUtils(mockFileInfo = getMockFileInfo()) {
  let getInoStub, getDeviceIdStub, getFileTimestampsWithInoStub
  getInoStub = sinon.stub(fileUtils, 'getIno')
  getInoStub.callsFake((path) => {
    const normalizedPath = fileUtils.filePathToPOSIX(path).replace(/\/$/, '')
    const stats = mockFileInfo.get(normalizedPath)
    if (stats) {
      return stats.ino
    } else {
      return null
    }
  })

  getDeviceIdStub = sinon.stub(fileUtils, 'getDeviceId')
  getDeviceIdStub.callsFake(async (path) => {
    const normalizedPath = fileUtils.filePathToPOSIX(path).replace(/\/$/, '')
    const stats = mockFileInfo.get(normalizedPath)
    if (stats) {
      return stats.dev
    } else {
      return null
    }
  })

  getFileTimestampsWithInoStub = sinon.stub(fileUtils, 'getFileTimestampsWithIno')
  getFileTimestampsWithInoStub.callsFake(async (path) => {
    const normalizedPath = fileUtils.filePathToPOSIX(path).replace(/\/$/, '')
    const stats = mockFileInfo.get(normalizedPath)
    if (stats) {
      return stats
    } else {
      return null
    }
  })
}
exports.stubFileUtils = stubFileUtils

/** @returns {{ libraryFolderId: any; libraryId: any; mediaType: any; ino: any; deviceId: any; mtimeMs: any; ctimeMs: any; birthtimeMs: any; path: any; relPath: any; isFile: any; mediaMetadata: any; libraryFiles: any; }} */
function buildFileProperties(path = '/tmp/foo.epub', ino = '12345', deviceId = '9876', libraryFiles = []) {
  const metadata = new FileMetadata()
  metadata.filename = Path.basename(path)
  metadata.path = path
  metadata.relPath = path
  metadata.ext = Path.extname(path)

  return {
    ino: ino,
    deviceId: deviceId,
    metadata: metadata,
    isSupplementary: false,
    addedAt: Date.now(),
    updatedAt: Date.now(),
    libraryFiles: [...libraryFiles.map((lf) => lf.toJSON())]
  }
}
exports.buildFileProperties = buildFileProperties

/**
 * @returns {import('../../server/models/LibraryItem').LibraryFileObject}
 * @param {string} [path]
 * @param {string} [ino]
 * @param {string} [deviceId]
 */
function buildLibraryFileProperties(path, ino, deviceId) {
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
exports.buildLibraryFileProperties = buildLibraryFileProperties
