const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const fileUtils = require('../../../server/utils/fileUtils')
const fs = require('fs')
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
})
