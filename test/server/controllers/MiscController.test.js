const { expect } = require('chai')
const sinon = require('sinon')
const Path = require('path')
const os = require('os')

const fs = require('../../../server/libs/fsExtra')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const MiscController = require('../../../server/controllers/MiscController')

function mockResponse() {
  const res = {}
  res.statusCode = 200
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.send = (body) => {
    res.body = body
    return res
  }
  res.sendStatus = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (obj) => {
    res.jsonBody = obj
    return res
  }
  return res
}

function chunkRequest(uploadId, fileIndex, chunkIndex, numChunks, buffer) {
  return {
    user: { canUpload: true, username: 'admin', checkCanAccessLibrary: () => true },
    body: { uploadId, fileIndex: `${fileIndex}`, chunkIndex: `${chunkIndex}`, numChunks: `${numChunks}` },
    files: {
      chunk: {
        mv: async (dest) => fs.writeFile(dest, buffer)
      }
    }
  }
}

describe('MiscController - chunked resumable upload', () => {
  let metadataRoot
  let libraryRoot

  beforeEach(async () => {
    metadataRoot = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-meta-'))
    libraryRoot = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-lib-'))
    global.MetadataPath = metadataRoot

    sinon.stub(Database, 'libraryModel').get(() => ({
      findByIdWithFolders: async (id) => (id === 'lib1' ? { id: 'lib1', isPodcast: false, libraryFolders: [{ id: 'fold1', path: libraryRoot }] } : null)
    }))

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
  })

  afterEach(async () => {
    sinon.restore()
    await fs.remove(metadataRoot)
    await fs.remove(libraryRoot)
    delete global.MetadataPath
  })

  it('stores chunks, lists them for resume, then assembles them in order', async () => {
    const uploadId = 'session-abc'

    let res = mockResponse()
    await MiscController.handleUploadChunk(chunkRequest(uploadId, 0, 0, 2, Buffer.from('hello ')), res)
    expect(res.statusCode).to.equal(200)

    res = mockResponse()
    await MiscController.handleUploadChunk(chunkRequest(uploadId, 0, 1, 2, Buffer.from('world')), res)
    expect(res.statusCode).to.equal(200)

    res = mockResponse()
    await MiscController.getUploadChunks({ user: { canUpload: true }, params: { uploadId, fileIndex: '0' } }, res)
    expect(res.jsonBody.chunks.sort()).to.deep.equal([0, 1])

    res = mockResponse()
    await MiscController.handleUploadFinalize(
      {
        user: { canUpload: true, username: 'admin', checkCanAccessLibrary: () => true },
        body: { uploadId, title: 'My Book', author: 'Author', library: 'lib1', folder: 'fold1', files: [{ index: 0, name: 'audio.mp3', numChunks: 2 }] }
      },
      res
    )
    expect(res.statusCode).to.equal(200)

    const assembled = await fs.readFile(Path.join(libraryRoot, 'Author', 'My Book', 'audio.mp3'))
    expect(assembled.toString()).to.equal('hello world')

    expect(await fs.pathExists(Path.join(metadataRoot, 'uploads', uploadId))).to.equal(false)
  })

  it('only re-sends the missing chunk on resume', async () => {
    const uploadId = 'session-resume'

    let res = mockResponse()
    await MiscController.handleUploadChunk(chunkRequest(uploadId, 0, 0, 2, Buffer.from('AAAA')), res)

    res = mockResponse()
    await MiscController.getUploadChunks({ user: { canUpload: true }, params: { uploadId, fileIndex: '0' } }, res)
    expect(res.jsonBody.chunks).to.deep.equal([0])

    res = mockResponse()
    await MiscController.handleUploadChunk(chunkRequest(uploadId, 0, 1, 2, Buffer.from('BBBB')), res)

    res = mockResponse()
    await MiscController.handleUploadFinalize(
      {
        user: { canUpload: true, username: 'admin', checkCanAccessLibrary: () => true },
        body: { uploadId, title: 'Resumed', library: 'lib1', folder: 'fold1', files: [{ index: 0, name: 'audio.mp3', numChunks: 2 }] }
      },
      res
    )
    expect(res.statusCode).to.equal(200)

    const assembled = await fs.readFile(Path.join(libraryRoot, 'Resumed', 'audio.mp3'))
    expect(assembled.toString()).to.equal('AAAABBBB')
  })

  it('fails finalize when a chunk is missing', async () => {
    const uploadId = 'session-missing'

    let res = mockResponse()
    await MiscController.handleUploadChunk(chunkRequest(uploadId, 0, 0, 2, Buffer.from('only-first')), res)

    res = mockResponse()
    await MiscController.handleUploadFinalize(
      {
        user: { canUpload: true, username: 'admin', checkCanAccessLibrary: () => true },
        body: { uploadId, title: 'Broken', library: 'lib1', folder: 'fold1', files: [{ index: 0, name: 'audio.mp3', numChunks: 2 }] }
      },
      res
    )
    expect(res.statusCode).to.equal(400)
  })

  it('rejects an upload id that escapes the uploads directory', async () => {
    const res = mockResponse()
    await MiscController.handleUploadChunk(chunkRequest('../escape', 0, 0, 1, Buffer.from('x')), res)
    expect(res.statusCode).to.equal(400)
  })

  it('rejects a chunk upload without permission', async () => {
    const res = mockResponse()
    await MiscController.handleUploadChunk({ user: { canUpload: false, username: 'reader' }, body: {}, files: {} }, res)
    expect(res.statusCode).to.equal(403)
  })

  it('stages chunks under UPLOAD_TEMP_DIR when set', async () => {
    const altRoot = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-up-'))
    process.env.UPLOAD_TEMP_DIR = altRoot
    try {
      const uploadId = 'session-env'
      const res = mockResponse()
      await MiscController.handleUploadChunk(chunkRequest(uploadId, 0, 0, 1, Buffer.from('Z')), res)
      expect(res.statusCode).to.equal(200)
      expect(await fs.pathExists(Path.join(altRoot, uploadId, '0', '0'))).to.equal(true)
    } finally {
      delete process.env.UPLOAD_TEMP_DIR
      await fs.remove(altRoot)
    }
  })
})
