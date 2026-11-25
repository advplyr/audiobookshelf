const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const os = require('os')
const Path = require('path')
const fs = require('fs/promises')
const fsExtra = require('../../../server/libs/fsExtra')

const Database = require('../../../server/Database')
const MiscController = require('../../../server/controllers/MiscController')
const FileSystemController = require('../../../server/controllers/FileSystemController')
const Logger = require('../../../server/Logger')
const uploadPath = require('../../../server/utils/uploadPath')
const fileUtils = require('../../../server/utils/fileUtils')
const { filePathToPOSIX } = fileUtils

describe('upload path collisions', () => {
  /** @type {string} */
  let root
  /** @type {import('../../../server/models/Library')} */
  let library
  /** @type {import('../../../server/models/LibraryFolder')} */
  let folder

  const uploadUser = {
    username: 'uploader',
    canUpload: true,
    canUpdate: false,
    canDelete: false,
    checkCanAccessLibrary: () => true
  }

  async function pathExists(targetPath) {
    try {
      await fs.access(targetPath)
      return true
    } catch {
      return false
    }
  }

  async function findNusqlite3Extension() {
    const ext = process.platform === 'win32' ? '.dll' : process.platform === 'darwin' ? '.dylib' : '.so'
    const candidates = [process.env.NUSQLITE3_PATH, Path.resolve(process.cwd(), `libnusqlite3${ext}`)].filter(Boolean)
    for (const candidate of candidates) {
      if (await pathExists(candidate)) return candidate
    }
    return null
  }

  function mockRes() {
    return {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code
        return this
      },
      send(body) {
        this.body = body
        return this
      },
      sendStatus(code) {
        this.statusCode = code
        return this
      },
      json(body) {
        this.body = body
        return this
      }
    }
  }

  /**
   * @param {string} name
   * @param {string} contents
   * @param {{ fail?: boolean, failCode?: string }} [options]
   */
  function fakeUploadFile(name, contents, options = {}) {
    const tempFilePath = Path.join(root, `tmp-${name}-${Math.random().toString(16).slice(2)}`)
    return {
      name,
      tempFilePath,
      contents,
      async mv(destination) {
        if (options.fail) {
          const error = new Error('mv failed')
          if (options.failCode) error.code = options.failCode
          throw error
        }
        await fs.writeFile(destination, contents)
        await fs.rm(tempFilePath, { force: true })
      }
    }
  }

  /**
   * @param {object} [overrides]
   */
  function uploadRequest(overrides = {}) {
    return {
      user: uploadUser,
      files: {
        0: fakeUploadFile('01.mp3', 'new-audio')
      },
      body: {
        title: 'Book B',
        author: 'Author A',
        series: '',
        library: library.id,
        folder: folder.id
      },
      ...overrides
    }
  }

  beforeEach(async () => {
    global.isWin = process.platform === 'win32'
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'debug')

    root = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-upload-'))
    const folderPath = Path.join(root, 'library')
    await fs.mkdir(folderPath)

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    folder = await Database.libraryFolderModel.create({ path: folderPath, libraryId: library.id })
  })

  afterEach(async () => {
    sinon.restore()
    if (root) {
      await fs.rm(root, { recursive: true, force: true })
    }
    await Database.sequelize.close()
  })

  it('writes a new item when the destination does not exist', async () => {
    const file = fakeUploadFile('01.mp3', 'new-audio')
    const req = uploadRequest({ files: { 0: file } })
    const res = mockRes()

    await MiscController.handleUpload(req, res)

    expect(res.statusCode).to.equal(200)
    const destination = Path.join(folder.path, 'Author A', 'Book B', '01.mp3')
    expect(await fs.readFile(destination, 'utf8')).to.equal('new-audio')
    expect(await pathExists(file.tempFilePath)).to.equal(false)
  })

  it('refuses when the destination directory already exists and leaves it unchanged', async () => {
    const destinationDir = Path.join(folder.path, 'Author A', 'Book B')
    await fs.mkdir(destinationDir, { recursive: true })
    const existing = Path.join(destinationDir, '01.mp3')
    await fs.writeFile(existing, 'original')

    const res = mockRes()
    await MiscController.handleUpload(uploadRequest(), res)

    expect(res.statusCode).to.equal(409)
    expect(res.body).to.deep.equal({
      code: uploadPath.UPLOAD_ERROR_CODE.pathExists,
      error: uploadPath.UPLOAD_PATH_EXISTS_MESSAGE
    })
    expect(await fs.readFile(existing, 'utf8')).to.equal('original')
  })

  it('refuses when a parent path is a file and leaves that file unchanged', async () => {
    const authorFile = Path.join(folder.path, 'Author A')
    await fs.writeFile(authorFile, 'not-a-directory')

    const res = mockRes()
    await MiscController.handleUpload(uploadRequest(), res)

    expect(res.statusCode).to.equal(409)
    expect(res.body).to.deep.equal({
      code: uploadPath.UPLOAD_ERROR_CODE.pathExists,
      error: uploadPath.UPLOAD_PATH_EXISTS_MESSAGE
    })
    expect(await fs.readFile(authorFile, 'utf8')).to.equal('not-a-directory')
    expect(await pathExists(Path.join(folder.path, 'Author A', 'Book B'))).to.equal(false)
  })

  it('does not delete an existing item when the upload check throws', async () => {
    const destinationDir = Path.join(folder.path, 'Author A', 'Book B')
    await fs.mkdir(destinationDir, { recursive: true })
    const existing = Path.join(destinationDir, '01.mp3')
    await fs.writeFile(existing, 'original')
    sinon.stub(uploadPath, 'assertUploadDestination').rejects(new Error('database unavailable'))

    const res = mockRes()
    await MiscController.handleUpload(uploadRequest(), res)

    expect(res.statusCode).to.equal(500)
    expect(await fs.readFile(existing, 'utf8')).to.equal('original')
  })

  it('does not delete an existing item when the directory appears before it is created', async () => {
    const destinationDir = Path.join(folder.path, 'Author A', 'Book B')
    await fs.mkdir(destinationDir, { recursive: true })
    const existing = Path.join(destinationDir, '01.mp3')
    await fs.writeFile(existing, 'original')
    sinon.stub(uploadPath, 'assertUploadDestination').resolves()

    const res = mockRes()
    await MiscController.handleUpload(uploadRequest(), res)

    expect(res.statusCode).to.equal(409)
    expect(res.body).to.deep.equal({
      code: uploadPath.UPLOAD_ERROR_CODE.pathExists,
      error: uploadPath.UPLOAD_PATH_EXISTS_MESSAGE
    })
    expect(await fs.readFile(existing, 'utf8')).to.equal('original')
  })

  it('refuses an upload nested inside an existing library item', async () => {
    const parentPath = filePathToPOSIX(Path.join(folder.path, 'Author A', 'Book B'))
    await Database.libraryItemModel.create({
      path: parentPath,
      title: 'Book B',
      mediaType: 'book',
      libraryFiles: [],
      libraryId: library.id,
      libraryFolderId: folder.id
    })

    const req = uploadRequest({
      body: {
        title: 'Sequel',
        author: 'Author A',
        series: 'Book B',
        library: library.id,
        folder: folder.id
      }
    })
    const res = mockRes()
    await MiscController.handleUpload(req, res)

    expect(res.statusCode).to.equal(409)
    expect(res.body).to.deep.equal({
      code: uploadPath.UPLOAD_ERROR_CODE.libraryItemExists,
      libraryItemTitle: 'Book B',
      error: `${uploadPath.UPLOAD_LIBRARY_ITEM_EXISTS_PREFIX}Book B`
    })
    expect(await pathExists(Path.join(folder.path, 'Author A', 'Book B', 'Sequel'))).to.equal(false)
  })

  it('refuses an upload nested in a library item whose name starts with two dots', async () => {
    const parentPath = filePathToPOSIX(Path.join(folder.path, '..foo'))
    await Database.libraryItemModel.create({
      path: parentPath,
      title: 'Dot Book',
      mediaType: 'book',
      libraryFiles: [],
      libraryId: library.id,
      libraryFolderId: folder.id
    })

    const res = mockRes()
    await MiscController.handleUpload(
      uploadRequest({
        body: {
          title: 'Sequel',
          author: '..foo',
          series: '',
          library: library.id,
          folder: folder.id
        }
      }),
      res
    )

    expect(res.statusCode).to.equal(409)
    expect(res.body).to.deep.equal({
      code: uploadPath.UPLOAD_ERROR_CODE.libraryItemExists,
      libraryItemTitle: 'Dot Book',
      error: `${uploadPath.UPLOAD_LIBRARY_ITEM_EXISTS_PREFIX}Dot Book`
    })
    expect(await pathExists(Path.join(folder.path, '..foo', 'Sequel'))).to.equal(false)
  })

  it('refuses an upload nested in a library item that differs only by case', async () => {
    global.isWin = true
    const parentPath = filePathToPOSIX(Path.join(folder.path, 'Author A', 'Book B'))
    await Database.libraryItemModel.create({
      path: parentPath,
      title: 'Book B',
      mediaType: 'book',
      libraryFiles: [],
      libraryId: library.id,
      libraryFolderId: folder.id
    })

    const req = uploadRequest({
      body: {
        title: 'Sequel',
        author: 'author a',
        series: 'book b',
        library: library.id,
        folder: folder.id
      }
    })
    const res = mockRes()
    await MiscController.handleUpload(req, res)

    expect(res.statusCode).to.equal(409)
    expect(res.body).to.deep.equal({
      code: uploadPath.UPLOAD_ERROR_CODE.libraryItemExists,
      libraryItemTitle: 'Book B',
      error: `${uploadPath.UPLOAD_LIBRARY_ITEM_EXISTS_PREFIX}Book B`
    })
    expect(await pathExists(Path.join(folder.path, 'author a', 'book b', 'Sequel'))).to.equal(false)

    const pathExistsRes = mockRes()
    await FileSystemController.checkPathExists(
      {
        user: uploadUser,
        body: {
          directory: Path.join('author a', 'book b', 'Sequel'),
          folderPath: folder.path
        }
      },
      pathExistsRes
    )
    expect(pathExistsRes.body).to.deep.equal({
      exists: true,
      libraryItemTitle: 'Book B'
    })
  })

  it('writes a podcast under the title and ignores author and series', async () => {
    await library.update({ mediaType: 'podcast' })
    const res = mockRes()
    await MiscController.handleUpload(
      uploadRequest({
        body: {
          title: 'Show A',
          author: 'Ignored Author',
          series: 'Ignored Series',
          library: library.id,
          folder: folder.id
        }
      }),
      res
    )

    expect(res.statusCode).to.equal(200)
    expect(await fs.readFile(Path.join(folder.path, 'Show A', '01.mp3'), 'utf8')).to.equal('new-audio')
    expect(await pathExists(Path.join(folder.path, 'Ignored Author'))).to.equal(false)
  })

  it('pathexists rejects a directory that leaves the library folder', async () => {
    const res = mockRes()
    await FileSystemController.checkPathExists(
      {
        user: uploadUser,
        body: {
          directory: '../outside',
          folderPath: folder.path
        }
      },
      res
    )

    expect(res.statusCode).to.equal(400)
    expect(await pathExists(Path.join(folder.path, '..', 'outside'))).to.equal(false)
  })

  it('matches non-ASCII parent library item paths even without libnusqlite3 loaded', async () => {
    global.isWin = true
    const parentPath = filePathToPOSIX(Path.join(folder.path, 'Émile Zola', 'Germinal'))
    await Database.libraryItemModel.create({
      path: parentPath,
      title: 'Germinal',
      mediaType: 'book',
      libraryFiles: [],
      libraryId: library.id,
      libraryFolderId: folder.id
    })

    const req = uploadRequest({
      body: {
        title: 'Sequel',
        author: 'Émile Zola',
        series: 'Germinal',
        library: library.id,
        folder: folder.id
      }
    })
    const res = mockRes()
    await MiscController.handleUpload(req, res)

    expect(res.statusCode).to.equal(409)
    expect(res.body).to.deep.equal({
      code: uploadPath.UPLOAD_ERROR_CODE.libraryItemExists,
      libraryItemTitle: 'Germinal',
      error: `${uploadPath.UPLOAD_LIBRARY_ITEM_EXISTS_PREFIX}Germinal`
    })
    expect(await pathExists(Path.join(folder.path, 'Émile Zola', 'Germinal', 'Sequel'))).to.equal(false)
  })

  it('refuses a different-case non-ASCII upload when libnusqlite3 is loaded', async function () {
    const extensionPath = await findNusqlite3Extension()
    if (!extensionPath) {
      if (process.env.CI || process.env.NUSQLITE3_PATH) {
        throw new Error('libnusqlite3 extension not found')
      }
      this.skip()
    }
    await Database.loadExtension(extensionPath)

    global.isWin = true
    const parentPath = filePathToPOSIX(Path.join(folder.path, 'Émile Zola', 'Germinal'))
    await Database.libraryItemModel.create({
      path: parentPath,
      title: 'Germinal',
      mediaType: 'book',
      libraryFiles: [],
      libraryId: library.id,
      libraryFolderId: folder.id
    })

    const req = uploadRequest({
      body: {
        title: 'Sequel',
        author: 'émile zola',
        series: 'germinal',
        library: library.id,
        folder: folder.id
      }
    })
    const res = mockRes()
    await MiscController.handleUpload(req, res)

    expect(res.statusCode).to.equal(409)
    expect(res.body).to.deep.equal({
      code: uploadPath.UPLOAD_ERROR_CODE.libraryItemExists,
      libraryItemTitle: 'Germinal',
      error: `${uploadPath.UPLOAD_LIBRARY_ITEM_EXISTS_PREFIX}Germinal`
    })
    expect(await pathExists(Path.join(folder.path, 'émile zola', 'germinal', 'Sequel'))).to.equal(false)

    const pathExistsRes = mockRes()
    await FileSystemController.checkPathExists(
      {
        user: uploadUser,
        body: {
          directory: Path.join('émile zola', 'germinal', 'Sequel'),
          folderPath: folder.path
        }
      },
      pathExistsRes
    )
    expect(pathExistsRes.body).to.deep.equal({
      exists: true,
      libraryItemTitle: 'Germinal'
    })
  })

  it('allows a different-case path when the filesystem is case-sensitive', async function () {
    // Windows and macOS compare case-insensitively. Flipping global.isWin here would also
    // switch path checks to POSIX rules, which do not apply to a Windows path.
    if (process.platform === 'win32' || process.platform === 'darwin') {
      this.skip()
    }
    const parentPath = filePathToPOSIX(Path.join(folder.path, 'Author A', 'Book B'))
    await Database.libraryItemModel.create({
      path: parentPath,
      title: 'Book B',
      mediaType: 'book',
      libraryFiles: [],
      libraryId: library.id,
      libraryFolderId: folder.id
    })

    const req = uploadRequest({
      body: {
        title: 'Sequel',
        author: 'author a',
        series: 'book b',
        library: library.id,
        folder: folder.id
      }
    })
    const res = mockRes()
    await MiscController.handleUpload(req, res)

    expect(res.statusCode).to.equal(200)
    expect(await fs.readFile(Path.join(folder.path, 'author a', 'book b', 'Sequel', '01.mp3'), 'utf8')).to.equal('new-audio')
  })

  it('refuses duplicate file names in one request', async () => {
    const req = uploadRequest({
      files: {
        0: fakeUploadFile('01.mp3', 'a'),
        1: fakeUploadFile('01.MP3', 'b')
      }
    })
    const res = mockRes()
    await MiscController.handleUpload(req, res)

    expect(res.statusCode).to.equal(409)
    expect(res.body).to.deep.equal({
      code: uploadPath.UPLOAD_ERROR_CODE.duplicateFileName,
      error: uploadPath.UPLOAD_DUPLICATE_FILENAME_MESSAGE
    })
    expect(await pathExists(Path.join(folder.path, 'Author A', 'Book B'))).to.equal(false)
  })

  it('refuses a title that sanitizes to an empty directory name', async () => {
    const res = mockRes()
    await MiscController.handleUpload(
      uploadRequest({
        body: {
          title: '...',
          author: 'NewAuthor',
          series: '',
          library: library.id,
          folder: folder.id
        }
      }),
      res
    )

    expect(res.statusCode).to.equal(400)
    expect(res.body).to.equal('Invalid upload path')
    expect(await pathExists(Path.join(folder.path, 'NewAuthor'))).to.equal(false)
  })

  it('drops an author name that sanitizes to empty', async () => {
    const res = mockRes()
    await MiscController.handleUpload(
      uploadRequest({
        body: {
          title: 'Book B',
          author: '...',
          series: '',
          library: library.id,
          folder: folder.id
        }
      }),
      res
    )

    expect(res.statusCode).to.equal(200)
    const destination = Path.join(folder.path, 'Book B', '01.mp3')
    expect(await fs.readFile(destination, 'utf8')).to.equal('new-audio')
    expect(await pathExists(Path.join(folder.path, '...'))).to.equal(false)
  })

  it('does not let an upload-only user overwrite an existing item', async () => {
    const destinationDir = Path.join(folder.path, 'Author A', 'Book B')
    await fs.mkdir(destinationDir, { recursive: true })
    await fs.writeFile(Path.join(destinationDir, '01.mp3'), 'original')

    const res = mockRes()
    await MiscController.handleUpload(uploadRequest(), res)

    expect(uploadUser.canUpdate).to.equal(false)
    expect(uploadUser.canDelete).to.equal(false)
    expect(res.statusCode).to.equal(409)
    expect(await fs.readFile(Path.join(destinationDir, '01.mp3'), 'utf8')).to.equal('original')
  })

  it('removes partial files when a move fails and does not answer 200', async () => {
    const first = fakeUploadFile('01.mp3', 'first')
    const second = fakeUploadFile('02.mp3', 'second', { fail: true })
    await fs.writeFile(second.tempFilePath, 'second')

    const res = mockRes()
    await MiscController.handleUpload(
      uploadRequest({
        files: { 0: first, 1: second }
      }),
      res
    )

    expect(res.statusCode).to.equal(500)
    const outputDirectory = Path.join(folder.path, 'Author A', 'Book B')
    expect(await pathExists(outputDirectory)).to.equal(false)
    expect(await pathExists(Path.join(folder.path, 'Author A'))).to.equal(false)
    expect(await pathExists(second.tempFilePath)).to.equal(true)
  })

  it('keeps a pre-existing empty parent when a move fails', async () => {
    const authorDir = Path.join(folder.path, 'Author A')
    await fs.mkdir(authorDir)
    const file = fakeUploadFile('01.mp3', 'new-audio', { fail: true })
    await fs.writeFile(file.tempFilePath, 'new-audio')

    const res = mockRes()
    await MiscController.handleUpload(uploadRequest({ files: { 0: file } }), res)

    expect(res.statusCode).to.equal(500)
    expect(await pathExists(authorDir)).to.equal(true)
    expect(await pathExists(Path.join(authorDir, 'Book B'))).to.equal(false)
  })

  it('keeps a pre-existing empty directory when the upload check throws', async () => {
    const authorDir = Path.join(folder.path, 'Author A')
    await fs.mkdir(authorDir)
    sinon.stub(uploadPath, 'assertUploadDestination').rejects(new Error('database unavailable'))

    const res = mockRes()
    await MiscController.handleUpload(uploadRequest(), res)

    expect(res.statusCode).to.equal(500)
    expect(await pathExists(authorDir)).to.equal(true)
  })

  it('keeps the library folder when its path has a trailing separator and a move fails', async () => {
    const folderWithSeparator = folder.path.endsWith(Path.sep) ? folder.path : folder.path + Path.sep
    await folder.update({ path: folderWithSeparator })

    const first = fakeUploadFile('01.mp3', 'first')
    const second = fakeUploadFile('02.mp3', 'second', { fail: true })
    await fs.writeFile(second.tempFilePath, 'second')

    const res = mockRes()
    await MiscController.handleUpload(
      uploadRequest({
        files: { 0: first, 1: second }
      }),
      res
    )

    expect(res.statusCode).to.equal(500)
    expect(await pathExists(folderWithSeparator)).to.equal(true)
    expect(await pathExists(Path.join(folderWithSeparator, 'Author A'))).to.equal(false)
    expect(await pathExists(second.tempFilePath)).to.equal(true)
  })

  it('keeps a pre-existing empty parent when the library folder path has a trailing separator', async () => {
    const folderWithSeparator = folder.path.endsWith(Path.sep) ? folder.path : folder.path + Path.sep
    await folder.update({ path: folderWithSeparator })
    const authorDir = Path.join(folderWithSeparator, 'Author A')
    await fs.mkdir(authorDir)
    const file = fakeUploadFile('01.mp3', 'new-audio', { fail: true })

    const res = mockRes()
    await MiscController.handleUpload(uploadRequest({ files: { 0: file } }), res)

    expect(res.statusCode).to.equal(500)
    expect(await pathExists(folderWithSeparator)).to.equal(true)
    expect(await pathExists(authorDir)).to.equal(true)
    expect(await pathExists(Path.join(authorDir, 'Book B'))).to.equal(false)
  })

  it('answers 403 when the library folder is not writable', async () => {
    const mkdirError = new Error('permission denied')
    mkdirError.code = 'EACCES'
    sinon.stub(fsExtra, 'mkdir').rejects(mkdirError)
    const res = mockRes()

    await MiscController.handleUpload(uploadRequest(), res)

    expect(res.statusCode).to.equal(403)
    expect(res.body).to.deep.equal({
      code: uploadPath.UPLOAD_ERROR_CODE.folderNotWritable,
      error: uploadPath.UPLOAD_FOLDER_NOT_WRITABLE_MESSAGE
    })
    expect(await pathExists(Path.join(folder.path, 'Author A'))).to.equal(false)
  })

  it('answers 403 when a move is denied and removes the new directory', async () => {
    const file = fakeUploadFile('01.mp3', 'new-audio', { fail: true, failCode: 'EPERM' })
    await fs.writeFile(file.tempFilePath, 'new-audio')
    const res = mockRes()

    await MiscController.handleUpload(uploadRequest({ files: { 0: file } }), res)

    expect(res.statusCode).to.equal(403)
    expect(res.body).to.deep.equal({
      code: uploadPath.UPLOAD_ERROR_CODE.folderNotWritable,
      error: uploadPath.UPLOAD_FOLDER_NOT_WRITABLE_MESSAGE
    })
    expect(await pathExists(Path.join(folder.path, 'Author A', 'Book B'))).to.equal(false)
    expect(await pathExists(folder.path)).to.equal(true)
    expect(await pathExists(file.tempFilePath)).to.equal(true)
  })

  it('pathexists reports a library item that already uses a parent directory', async () => {
    const parentPath = filePathToPOSIX(Path.join(folder.path, 'Author A', 'Book B'))
    await Database.libraryItemModel.create({
      path: parentPath,
      title: 'Book B',
      mediaType: 'book',
      libraryFiles: [],
      libraryId: library.id,
      libraryFolderId: folder.id
    })

    const res = mockRes()
    await FileSystemController.checkPathExists(
      {
        user: uploadUser,
        body: {
          directory: Path.join('Author A', 'Book B', 'Sequel'),
          folderPath: folder.path
        }
      },
      res
    )

    expect(res.body).to.deep.equal({
      exists: true,
      libraryItemTitle: 'Book B'
    })

    const slashRes = mockRes()
    await FileSystemController.checkPathExists(
      {
        user: uploadUser,
        body: {
          directory: 'Author A/Book B/Sequel',
          folderPath: folder.path
        }
      },
      slashRes
    )
    expect(slashRes.body).to.deep.equal({
      exists: true,
      libraryItemTitle: 'Book B'
    })
  })

  it('answers 500 when pathexists fails unexpectedly', async () => {
    sinon.stub(Database.libraryItemModel, 'findOne').rejects(new Error('database unavailable'))

    const res = mockRes()
    await FileSystemController.checkPathExists(
      {
        user: uploadUser,
        body: {
          directory: Path.join('Author A', 'Book B', 'Sequel'),
          folderPath: folder.path
        }
      },
      res
    )

    expect(res.statusCode).to.equal(500)
  })

  it('answers 400 when a file field is an empty list', async () => {
    const res = mockRes()
    await MiscController.handleUpload(uploadRequest({ files: { 0: [] } }), res)

    expect(res.statusCode).to.equal(400)
  })

  it('answers 500 when the library lookup fails', async () => {
    sinon.stub(Database.libraryModel, 'findByIdWithFolders').rejects(new Error('database unavailable'))

    const res = mockRes()
    await MiscController.handleUpload(uploadRequest(), res)

    expect(res.statusCode).to.equal(500)
  })

  it('answers 500 when the pathexists folder lookup fails', async () => {
    sinon.stub(Database.libraryFolderModel, 'findOne').rejects(new Error('database unavailable'))

    const res = mockRes()
    await FileSystemController.checkPathExists(
      {
        user: uploadUser,
        body: {
          directory: Path.join('Author A', 'Book B'),
          folderPath: folder.path
        }
      },
      res
    )

    expect(res.statusCode).to.equal(500)
  })
})
