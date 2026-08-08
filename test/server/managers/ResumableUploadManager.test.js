const { expect } = require('chai')
const { Readable } = require('stream')
const Path = require('path')
const os = require('os')

const fs = require('../../../server/libs/fsExtra')
const ResumableUploadManager = require('../../../server/managers/ResumableUploadManager')

describe('ResumableUploadManager', () => {
  let metadataPath

  beforeEach(async () => {
    metadataPath = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-resumable-'))
    global.MetadataPath = metadataPath
  })

  afterEach(async () => {
    await fs.remove(metadataPath)
  })

  function chunkRequest(contents) {
    const request = Readable.from([Buffer.from(contents)])
    request.headers = { 'content-length': String(Buffer.byteLength(contents)) }
    return request
  }

  it('persists a session and reports saved offsets', async () => {
    const uploadId = 'a'.repeat(32)
    const files = [{ id: '0', name: 'book.m4b', size: 6 }]
    await ResumableUploadManager.createSession('user', uploadId, { uploadId, files })

    const firstOffset = await ResumableUploadManager.appendChunk('user', uploadId, files[0], 0, chunkRequest('abc'))
    expect(firstOffset).to.equal(3)
    expect(await ResumableUploadManager.getOffsets('user', uploadId, files)).to.deep.equal([3])

    const finalOffset = await ResumableUploadManager.appendChunk('user', uploadId, files[0], 3, chunkRequest('def'))
    expect(finalOffset).to.equal(6)
    expect(await fs.readFile(ResumableUploadManager.getPartPath('user', uploadId, '0'), 'utf8')).to.equal('abcdef')
  })

  it('rejects a chunk with a stale offset without changing the file', async () => {
    const uploadId = 'b'.repeat(32)
    const file = { id: '0', name: 'book.m4b', size: 6 }
    await ResumableUploadManager.createSession('user', uploadId, { uploadId, files: [file] })
    await ResumableUploadManager.appendChunk('user', uploadId, file, 0, chunkRequest('abc'))

    let error
    try {
      await ResumableUploadManager.appendChunk('user', uploadId, file, 0, chunkRequest('def'))
    } catch (caught) {
      error = caught
    }
    expect(error.code).to.equal('OFFSET_MISMATCH')
    expect(error.offset).to.equal(3)
    expect(await fs.readFile(ResumableUploadManager.getPartPath('user', uploadId, '0'), 'utf8')).to.equal('abc')
  })

  it('rejects chunks that would exceed the declared file size', async () => {
    const uploadId = 'c'.repeat(32)
    const file = { id: '0', name: 'book.m4b', size: 2 }
    await ResumableUploadManager.createSession('user', uploadId, { uploadId, files: [file] })

    let error
    try {
      await ResumableUploadManager.appendChunk('user', uploadId, file, 0, chunkRequest('abc'))
    } catch (caught) {
      error = caught
    }
    expect(error.code).to.equal('INVALID_CHUNK')
  })

  it('serializes concurrent chunks and rejects a stale offset', async () => {
    const uploadId = 'd'.repeat(32)
    const file = { id: '0', name: 'book.m4b', size: 6 }
    await ResumableUploadManager.createSession('user', uploadId, { uploadId, files: [file] })

    const results = await Promise.allSettled([
      ResumableUploadManager.appendChunk('user', uploadId, file, 0, chunkRequest('abc')),
      ResumableUploadManager.appendChunk('user', uploadId, file, 0, chunkRequest('def'))
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).to.have.length(1)
    const rejected = results.find((result) => result.status === 'rejected')
    expect(rejected.reason.code).to.equal('OFFSET_MISMATCH')
    expect(rejected.reason.offset).to.equal(3)
    expect(await fs.stat(ResumableUploadManager.getPartPath('user', uploadId, '0'))).to.have.property('size', 3)
  })
})
