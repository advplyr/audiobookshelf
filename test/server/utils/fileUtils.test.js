const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const fileUtils = require('../../../server/utils/fileUtils')
const fs = require('fs')
const http = require('http')
const path = require('path')
const os = require('os')
const Logger = require('../../../server/Logger')

describe('fileUtils', () => {
  it('shouldIgnoreFile', () => {
    global.isWin = process.platform === 'win32'

    const testCases = [
      { path: 'test.txt', expected: null },
      { path: 'folder/test.mp3', expected: null },
      { path: 'normal/path/file.m4b', expected: null },
      { path: 'test.txt.part', expected: '.part file' },
      { path: 'test.txt.tmp', expected: '.tmp file' },
      { path: 'test.txt.crdownload', expected: '.crdownload file' },
      { path: 'test.txt.download', expected: '.download file' },
      { path: 'test.txt.bak', expected: '.bak file' },
      { path: 'test.txt.old', expected: '.old file' },
      { path: 'test.txt.temp', expected: '.temp file' },
      { path: 'test.txt.tempfile', expected: '.tempfile file' },
      { path: 'test.txt.tempfile~', expected: '.tempfile~ file' },
      { path: '.gitignore', expected: 'dotfile' },
      { path: 'folder/.hidden', expected: 'dotfile' },
      { path: '.git/config', expected: 'dotpath' },
      { path: 'path/.hidden/file.txt', expected: 'dotpath' },
      { path: '@eaDir', expected: '@eaDir directory' },
      { path: 'folder/@eaDir', expected: '@eaDir directory' },
      { path: 'path/@eaDir/file.txt', expected: '@eaDir directory' },
      { path: '.hidden/test.tmp', expected: 'dotpath' },
      { path: '@eaDir/test.part', expected: '@eaDir directory' }
    ]

    testCases.forEach(({ path, expected }) => {
      const result = fileUtils.shouldIgnoreFile(path)
      expect(result).to.equal(expected)
    })
  })

  describe('recurseFiles', () => {
    let readdirStub, realpathStub, statStub

    beforeEach(() => {
      global.isWin = process.platform === 'win32'

      // Mock file structure with normalized paths
      const mockDirContents = new Map([
        ['/test', ['file1.mp3', 'subfolder', 'ignoreme', 'ignoremenot.mp3', 'temp.mp3.tmp']],
        ['/test/subfolder', ['file2.m4b']],
        ['/test/ignoreme', ['.ignore', 'ignored.mp3']]
      ])

      const mockStats = new Map([
        ['/test/file1.mp3', { isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '1' }],
        ['/test/subfolder', { isDirectory: () => true, size: 0, mtimeMs: Date.now(), ino: '2' }],
        ['/test/subfolder/file2.m4b', { isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '3' }],
        ['/test/ignoreme', { isDirectory: () => true, size: 0, mtimeMs: Date.now(), ino: '4' }],
        ['/test/ignoreme/.ignore', { isDirectory: () => false, size: 0, mtimeMs: Date.now(), ino: '5' }],
        ['/test/ignoreme/ignored.mp3', { isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '6' }],
        ['/test/ignoremenot.mp3', { isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '7' }],
        ['/test/temp.mp3.tmp', { isDirectory: () => false, size: 1024, mtimeMs: Date.now(), ino: '8' }]
      ])

      // Stub fs.readdir
      readdirStub = sinon.stub(fs, 'readdir')
      readdirStub.callsFake((path, callback) => {
        const contents = mockDirContents.get(path)
        if (contents) {
          callback(null, contents)
        } else {
          callback(new Error(`ENOENT: no such file or directory, scandir '${path}'`))
        }
      })

      // Stub fs.realpath
      realpathStub = sinon.stub(fs, 'realpath')
      realpathStub.callsFake((path, callback) => {
        // Return normalized path
        callback(null, fileUtils.filePathToPOSIX(path).replace(/\/$/, ''))
      })

      // Stub fs.stat
      statStub = sinon.stub(fs, 'stat')
      statStub.callsFake((path, callback) => {
        const normalizedPath = fileUtils.filePathToPOSIX(path).replace(/\/$/, '')
        const stats = mockStats.get(normalizedPath)
        if (stats) {
          callback(null, stats)
        } else {
          callback(new Error(`ENOENT: no such file or directory, stat '${normalizedPath}'`))
        }
      })

      // Stub Logger
      sinon.stub(Logger, 'debug')
    })

    afterEach(() => {
      sinon.restore()
    })

    it('should return filtered file list', async () => {
      const files = await fileUtils.recurseFiles('/test')
      expect(files).to.be.an('array')
      expect(files).to.have.lengthOf(3)

      expect(files[0]).to.deep.equal({
        name: 'file1.mp3',
        path: 'file1.mp3',
        reldirpath: '',
        fullpath: '/test/file1.mp3',
        extension: '.mp3',
        deep: 0
      })

      expect(files[1]).to.deep.equal({
        name: 'ignoremenot.mp3',
        path: 'ignoremenot.mp3',
        reldirpath: '',
        fullpath: '/test/ignoremenot.mp3',
        extension: '.mp3',
        deep: 0
      })

      expect(files[2]).to.deep.equal({
        name: 'file2.m4b',
        path: 'subfolder/file2.m4b',
        reldirpath: 'subfolder',
        fullpath: '/test/subfolder/file2.m4b',
        extension: '.m4b',
        deep: 1
      })
    })
  })

  describe('downloadFile', () => {
    let server
    let serverPort
    let tmpDir
    let serveContent
    let serveContentType
    let serveStatusCode

    before(async () => {
      // Disable the SSRF filter so we can hit 127.0.0.1 in tests
      global.DisableSsrfRequestFilter = () => true

      server = http.createServer((req, res) => {
        res.writeHead(serveStatusCode, {
          'Content-Type': serveContentType,
          'Content-Length': serveContent.length.toString()
        })
        res.end(serveContent)
      })
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      serverPort = server.address().port
    })

    after(async () => {
      delete global.DisableSsrfRequestFilter
      await new Promise((resolve) => server.close(resolve))
    })

    beforeEach(() => {
      serveContent = Buffer.from('fake audio content for testing purposes')
      serveContentType = 'audio/mpeg'
      serveStatusCode = 200
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abs-fileutils-test-'))
      sinon.stub(Logger, 'debug')
      sinon.stub(Logger, 'error')
    })

    afterEach(() => {
      sinon.restore()
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('should download file and write it to the specified path', async () => {
      const destPath = path.join(tmpDir, 'output.mp3')
      await fileUtils.downloadFile(`http://127.0.0.1:${serverPort}/test.mp3`, destPath)
      expect(fs.existsSync(destPath)).to.be.true
      expect(fs.readFileSync(destPath).toString()).to.equal(serveContent.toString())
    })

    it('should write the exact number of bytes served', async () => {
      serveContent = Buffer.alloc(8192, 0xff)
      const destPath = path.join(tmpDir, 'exact.mp3')
      await fileUtils.downloadFile(`http://127.0.0.1:${serverPort}/exact.mp3`, destPath)
      expect(fs.statSync(destPath).size).to.equal(8192)
    })

    it('should reject when content type filter rejects the response content type', async () => {
      const destPath = path.join(tmpDir, 'rejected.mp3')
      let didReject = false
      try {
        await fileUtils.downloadFile(`http://127.0.0.1:${serverPort}/test.mp3`, destPath, (ct) => ct.includes('video/'))
      } catch (e) {
        didReject = true
        expect(e.message).to.include('Invalid content type')
      }
      expect(didReject).to.be.true
    })

    it('should pass when content type filter accepts the response content type', async () => {
      const destPath = path.join(tmpDir, 'accepted.mp3')
      await fileUtils.downloadFile(`http://127.0.0.1:${serverPort}/test.mp3`, destPath, (ct) => ct.includes('audio/'))
      expect(fs.existsSync(destPath)).to.be.true
    })

    it('should resolve with no content type filter provided', async () => {
      const destPath = path.join(tmpDir, 'nofilter.mp3')
      await fileUtils.downloadFile(`http://127.0.0.1:${serverPort}/test.mp3`, destPath)
      expect(fs.existsSync(destPath)).to.be.true
    })
  })
})
