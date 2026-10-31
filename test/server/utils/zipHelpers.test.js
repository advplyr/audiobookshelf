const { expect } = require('chai')
const { EventEmitter } = require('events')
const { Writable } = require('stream')
const fs = require('fs')
const os = require('os')
const Path = require('path')
const sinon = require('sinon')
const archiver = require('../../../server/libs/archiver')
const Logger = require('../../../server/Logger')
const zipHelpers = require('../../../server/utils/zipHelpers')

describe('zipHelpers', () => {
  let archive
  let res

  beforeEach(() => {
    archive = new EventEmitter()
    for (const method of ['pipe', 'directory', 'file', 'finalize']) archive[method] = sinon.stub()
    archive.pointer = sinon.stub().returns(123)
    sinon.stub(archiver, 'create').returns(archive)
    for (const method of ['info', 'debug', 'warn', 'error']) sinon.stub(Logger, method)
    res = new EventEmitter()
    res.attachment = sinon.stub().returns(res)
    res.status = sinon.stub().returns(res)
    res.send = sinon.stub().returns(res)
    res.headersSent = false
  })

  afterEach(() => sinon.restore())

  it('streams a directory without adding a root folder and resolves on response close', async () => {
    const pending = zipHelpers.zipDirectoryPipe('/books/title', 'title.zip', res)
    expect(res.attachment.calledOnceWithExactly('title.zip')).to.equal(true)
    expect(archiver.create.calledOnceWithExactly('zip', { zlib: { level: 0 } })).to.equal(true)
    expect(archive.pipe.calledOnceWithExactly(res)).to.equal(true)
    expect(archive.directory.calledOnceWithExactly('/books/title', false)).to.equal(true)
    expect(archive.finalize.calledOnce).to.equal(true)
    res.emit('end')
    res.emit('close')
    expect(await pending).to.equal(undefined)
  })

  it('adds files and directories using their basenames', async () => {
    const pending = zipHelpers.zipDirectoriesPipe([
      { path: '/books/title', isFile: false },
      { path: '/books/audio.mp3', isFile: true }
    ], 'books.zip', res)
    expect(archive.directory.calledOnceWithExactly('/books/title', 'title')).to.equal(true)
    expect(archive.file.calledOnceWithExactly('/books/audio.mp3', { name: 'audio.mp3' })).to.equal(true)
    res.emit('close')
    await pending
  })

  for (const method of ['zipDirectoryPipe', 'zipDirectoriesPipe']) {
    const input = method === 'zipDirectoryPipe' ? '/books/title' : []

    it(`${method} logs missing-file warnings without rejecting`, async () => {
      const pending = zipHelpers[method](input, 'books.zip', res)
      archive.emit('warning', Object.assign(new Error('Missing file'), { code: 'ENOENT' }))
      expect(Logger.warn.calledOnce).to.equal(true)
      res.emit('close')
      await pending
    })

    for (const event of ['warning', 'error']) {
      it(`${method} rejects with the original ${event}`, async () => {
        const pending = zipHelpers[method](input, 'books.zip', res)
        const error = Object.assign(new Error('Archive failed'), { code: 'EACCES' })
        archive.emit(event, error)
        const caught = await pending.then(() => null, (err) => err)
        expect(caught).to.equal(error)
      })
    }
  }

  it('maps download failures to the existing HTTP status and message', () => {
    expect(zipHelpers.handleDownloadError({ code: 'ENOENT' }, res)).to.equal(res)
    expect(res.status.calledWithExactly(404)).to.equal(true)
    expect(res.send.calledWithExactly('File not found')).to.equal(true)
    zipHelpers.handleDownloadError(new Error('Failed'), res)
    expect(res.status.calledWithExactly(500)).to.equal(true)
    expect(res.send.calledWithExactly('Download failed')).to.equal(true)
  })

  it('does not send another response once headers have been sent', () => {
    res.headersSent = true
    expect(zipHelpers.handleDownloadError(null, res)).to.equal(undefined)
    expect(res.status.called).to.equal(false)
    expect(res.send.called).to.equal(false)
  })
})

describe('zipHelpers archive integration', () => {
  it('streams an actual ZIP from temporary files', async () => {
    const dir = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-zip-'))
    const chunks = []
    const res = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk)
        callback()
      }
    })
    res.attachment = sinon.stub().returns(res)
    try {
      fs.writeFileSync(Path.join(dir, 'book.txt'), 'audiobook metadata')
      await zipHelpers.zipDirectoryPipe(dir, 'book.zip', res)
      const data = Buffer.concat(chunks)
      expect(data.readUInt32LE(0)).to.equal(0x04034b50)
      expect(data.includes(Buffer.from('book.txt'))).to.equal(true)
      expect(data.includes(Buffer.from('audiobook metadata'))).to.equal(true)
    } finally {
      res.destroy()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
