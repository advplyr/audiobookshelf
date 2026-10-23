const { expect } = require('chai')
const sinon = require('sinon')
const fs = require('fs')
const os = require('os')
const Path = require('path')
const axios = require('axios')
const { Readable, Writable } = require('stream')
const extraFs = require('../../../server/libs/fsExtra')
const Logger = require('../../../server/Logger')
const fileUtils = require('../../../server/utils/fileUtils')

describe('fileUtils compatibility', () => {
  let dir
  let previousIsWin

  beforeEach(() => {
    previousIsWin = global.isWin
    global.isWin = process.platform === 'win32'
    dir = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-fileutils-'))
    for (const method of ['debug', 'warn', 'error', 'info']) sinon.stub(Logger, method)
  })

  afterEach(() => {
    sinon.restore()
    global.isWin = previousIsWin
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('preserves falsy paths and Windows UNC prefixes', () => {
    global.isWin = true
    expect(fileUtils.filePathToPOSIX(null)).to.equal(null)
    expect(fileUtils.filePathToPOSIX(undefined)).to.equal(undefined)
    expect(fileUtils.filePathToPOSIX('')).to.equal('')
    expect(fileUtils.filePathToPOSIX('C:\\Books\\a.mp3')).to.equal('C:/Books/a.mp3')
    expect(fileUtils.filePathToPOSIX('\\\\server\\Books\\a.mp3')).to.equal('\\\\server/Books/a.mp3')
  })

  it('reads actual stats, inode and text from temporary files', async () => {
    const path = Path.join(dir, 'book.txt')
    fs.writeFileSync(path, 'abc')
    const timestamps = await fileUtils.getFileTimestampsWithIno(path)
    expect(timestamps.size).to.equal(3)
    expect(timestamps.ino).to.be.a('string')
    expect(await fileUtils.getFileSize(path)).to.equal(3)
    expect(await fileUtils.getFileMTimeMs(path)).to.be.a('number')
    expect(await fileUtils.getIno(path)).to.equal(timestamps.ino)
    expect(await fileUtils.readTextFile(path)).to.equal('abc')
    expect(await fileUtils.checkPathIsFile(path)).to.equal(true)
    expect(await fileUtils.checkPathIsFile(dir)).to.equal(false)
  })

  it('preserves distinct missing-file return values and size rejection', async () => {
    const path = Path.join(dir, 'missing')
    expect(await fileUtils.getFileTimestampsWithIno(path)).to.equal(false)
    expect(await fileUtils.getIno(path)).to.equal(null)
    expect(await fileUtils.readTextFile(path)).to.equal('')
    expect(await fileUtils.checkPathIsFile(path)).to.equal(false)
    expect(await fileUtils.getFileMTimeMs(path)).to.equal(0)
    const error = await fileUtils.getFileSize(path).then(() => null, (err) => err)
    expect(error.code).to.equal('ENOENT')
    expect(fileUtils.removeFile(null)).to.equal(false)
  })

  it('preserves filename normalization, byte limits and MIME fallback', () => {
    expect(fileUtils.sanitizeFilename(null)).to.equal(false)
    expect(fileUtils.sanitizeFilename('Cafe\u0301: Book?.mp3')).to.equal('Café - Book.mp3')
    expect(fileUtils.sanitizeFilename('CON.txt')).to.equal('')
    const filename = fileUtils.sanitizeFilename('😀'.repeat(100) + '.mp3')
    expect(Buffer.byteLength(filename, 'utf16le')).to.be.at.most(255)
    expect(filename.endsWith('.mp3')).to.equal(true)
    expect(fileUtils.getAudioMimeTypeFromExtname('.M4B')).to.equal('audio/mp4')
    expect(fileUtils.getAudioMimeTypeFromExtname('.unknown')).to.equal(null)
  })

  it('copies to an existing file and tests directory writability', async () => {
    const source = Path.join(dir, 'source')
    const destination = Path.join(dir, 'destination')
    fs.writeFileSync(source, 'copied')
    fs.writeFileSync(destination, 'old data')
    await fileUtils.copyToExisting(source, destination)
    expect(fs.readFileSync(destination, 'utf8')).to.equal('copied')
    expect(await fileUtils.isWritable(dir)).to.equal(true)
    expect(await fileUtils.isWritable(Path.join(dir, 'missing'))).to.equal(false)
  })

  it('image download delegates through the mutable CommonJS exports', async () => {
    const download = sinon.stub(fileUtils, 'downloadFile').resolves()
    await fileUtils.downloadImageFile('https://example.com/image', 'cover.jpg')
    const filter = download.firstCall.args[2]
    expect(filter('image/jpeg')).to.equal(true)
    expect(filter('image/svg+xml')).to.equal(false)
    expect(filter('text/plain')).to.equal(false)
    expect(filter(undefined)).to.equal(undefined)
  })

  it('recursive listing delegates ignore checks through the exports and handles missing directories', async () => {
    fs.writeFileSync(Path.join(dir, 'book.mp3'), 'audio')
    const ignore = sinon.stub(fileUtils, 'shouldIgnoreFile').returns('test ignore')
    expect(await fileUtils.recurseFiles(dir)).to.deep.equal([])
    expect(ignore.calledOnceWithExactly('book.mp3')).to.equal(true)
    expect(await fileUtils.recurseFiles(Path.join(dir, 'missing'))).to.deep.equal([])
  })

  it('lists only directories and removes temporary files', async () => {
    fs.mkdirSync(Path.join(dir, 'book'))
    const path = Path.join(dir, 'file.txt')
    fs.writeFileSync(path, 'text')
    expect(await fileUtils.getDirectoriesInPath(dir, 2)).to.deep.equal([
      { path: fileUtils.filePathToPOSIX(Path.join(dir, 'book')), dirname: 'book', level: 2 }
    ])
    expect(await fileUtils.removeFile(path)).to.equal(true)
    expect(fs.existsSync(path)).to.equal(false)
    expect(fileUtils.getFilePathItemFromFileUpdate({ relPath: '/book/audio.mp3', path: '/library/book/audio.mp3' })).to.deep.equal({
      name: 'audio.mp3', path: 'book/audio.mp3', reldirpath: 'book',
      fullpath: '/library/book/audio.mp3', extension: '.mp3', deep: 1
    })
  })

  it('streams an adapter response and validates content type before opening a writer', async () => {
    const originalAdapter = axios.defaults.adapter
    const writer = new Writable({ write(chunk, encoding, callback) { callback() } })
    const createWriter = sinon.stub(extraFs, 'createWriteStream').returns(writer)
    axios.defaults.adapter = async (config) => ({
      data: Readable.from([Buffer.from('abc')]),
      headers: { 'content-type': 'image/jpeg', 'content-length': '3' },
      status: 200,
      statusText: 'OK',
      config
    })
    try {
      expect(await fileUtils.downloadFile('https://example.com/image', 'cover.jpg')).to.equal(undefined)
      expect(createWriter.calledOnce).to.equal(true)
      createWriter.resetHistory()
      const error = await fileUtils.downloadFile('https://example.com/image', 'cover.jpg', () => false).then(() => null, (err) => err)
      expect(error.message).to.equal('Invalid content type "image/jpeg"')
      expect(createWriter.called).to.equal(false)
    } finally {
      axios.defaults.adapter = originalAdapter
      writer.destroy()
    }
  })
})
