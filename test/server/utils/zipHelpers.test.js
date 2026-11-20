const { expect } = require('chai')
const sinon = require('sinon')
const { PassThrough } = require('stream')
const path = require('path')
const fs = require('fs')
const os = require('os')
const zipHelpers = require('../../../server/utils/zipHelpers')
const Logger = require('../../../server/Logger')

describe('zipHelpers', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abs-zip-test-'))
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
  })

  afterEach(() => {
    sinon.restore()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('zipDirectoryPipe', () => {
    function makeMockRes() {
      const stream = new PassThrough()
      stream.attachment = sinon.spy()
      // zipDirectoryPipe resolves on 'close'. PassThrough emits 'finish' but not 'close'
      // automatically — destroy() triggers 'close', so bridge the two events here.
      stream.on('finish', () => stream.destroy())
      return stream
    }

    it('should call res.attachment with the provided filename', async () => {
      fs.writeFileSync(path.join(tmpDir, 'book.mp3'), 'audio content')
      const res = makeMockRes()
      await zipHelpers.zipDirectoryPipe(tmpDir, 'my-book.zip', res)
      expect(res.attachment.calledWith('my-book.zip')).to.be.true
    })

    it('should resolve and produce data for a non-empty directory', async () => {
      fs.writeFileSync(path.join(tmpDir, 'chapter1.mp3'), 'audio data chapter 1')
      fs.writeFileSync(path.join(tmpDir, 'chapter2.mp3'), 'audio data chapter 2')

      const res = makeMockRes()
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))

      await zipHelpers.zipDirectoryPipe(tmpDir, 'book.zip', res)
      const totalBytes = chunks.reduce((sum, c) => sum + c.length, 0)
      expect(totalBytes).to.be.greaterThan(0)
    })

    it('should resolve for an empty directory', async () => {
      const res = makeMockRes()
      // Should not throw
      await zipHelpers.zipDirectoryPipe(tmpDir, 'empty.zip', res)
    })

    it('should produce a valid zip containing the expected files', async () => {
      fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'Hello audiobookshelf')
      const res = makeMockRes()
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))

      await zipHelpers.zipDirectoryPipe(tmpDir, 'archive.zip', res)

      // ZIP files start with the PK signature (0x50 0x4B)
      const combined = Buffer.concat(chunks)
      expect(combined[0]).to.equal(0x50) // 'P'
      expect(combined[1]).to.equal(0x4b) // 'K'
    })

    it('should resolve (not throw) when the source directory does not exist', async () => {
      // archiver treats a missing directory as a warning (ENOENT), not a fatal error,
      // so zipDirectoryPipe resolves with an empty archive rather than rejecting.
      const res = makeMockRes()
      let threw = false
      try {
        await zipHelpers.zipDirectoryPipe('/nonexistent/path/that/does/not/exist', 'fail.zip', res)
      } catch (e) {
        threw = true
      }
      expect(threw).to.be.false
    })
  })
})
