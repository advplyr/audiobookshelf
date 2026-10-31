const { expect } = require('chai')
const sinon = require('sinon')
const Path = require('path')
const os = require('os')
const fs = require('fs/promises')
const { createWriteStream } = require('fs')
const { finished } = require('stream/promises')
const unrar = require('node-unrar-js')
const archiver = require('../../../server/libs/archiver')
const StreamZip = require('../../../server/libs/nodeStreamZip')
const embeddedFs = require('../../../server/libs/fsExtra')
const Logger = require('../../../server/Logger')
const extractors = require('../../../server/utils/comicBookExtractors')

describe('comicBookExtractors compatibility', () => {
  let directory
  let previousMetadataPath
  let opened

  beforeEach(async () => {
    directory = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-comics-'))
    previousMetadataPath = global.MetadataPath
    global.MetadataPath = directory
    opened = []
    for (const method of ['debug', 'error']) sinon.stub(Logger, method)
  })

  afterEach(async () => {
    sinon.restore()
    // close() intentionally returns void; wait for the underlying ZIP close when cleaning up.
    for (const extractor of opened) {
      if (extractor.archive instanceof StreamZip.async) await extractor.archive.close()
    }
    global.MetadataPath = previousMetadataPath
    await fs.rm(directory, { recursive: true, force: true })
  })

  async function createCbz() {
    const source = Path.join(directory, 'source.jpg')
    const archivePath = Path.join(directory, 'book.CBZ')
    await fs.writeFile(source, 'cover bytes')
    const output = createWriteStream(archivePath)
    const completion = finished(output)
    const archive = archiver('zip', { zlib: { level: 0 } })
    archive.pipe(output)
    archive.file(source, { name: 'images/cover.jpg' })
    await archive.finalize()
    await completion
    const extractor = extractors.createComicBookExtractor(archivePath)
    opened.push(extractor)
    await extractor.open()
    return extractor
  }

  it('preserves the CommonJS factory and rejects unsupported extensions', () => {
    expect(Object.keys(extractors)).to.deep.equal(['createComicBookExtractor'])
    expect(() => extractors.createComicBookExtractor('book.zip')).to.throw('Unsupported comic book format ".zip"')
    expect(extractors.createComicBookExtractor('book.CBR').comicPath).to.equal('book.CBR')
  })

  it('returns null or false before either archive type is opened', async () => {
    for (const extension of ['cbr', 'cbz']) {
      const extractor = extractors.createComicBookExtractor(`book.${extension}`)
      expect(await extractor.getFilePaths()).to.equal(null)
      expect(await extractor.extractToBuffer('cover.jpg')).to.equal(null)
      expect(await extractor.extractToFile('cover.jpg', 'unused.jpg')).to.equal(false)
      expect(extractor.close()).to.equal(undefined)
    }
  })

  it('reads a real CBZ and extracts matching buffer and file data', async () => {
    const extractor = await createCbz()
    expect(await extractor.getFilePaths()).to.deep.equal(['images/cover.jpg'])
    expect((await extractor.extractToBuffer('images/cover.jpg')).toString()).to.equal('cover bytes')
    const output = Path.join(directory, 'cover.jpg')
    expect(await extractor.extractToFile('images/cover.jpg', output)).to.equal(true)
    expect(await fs.readFile(output, 'utf8')).to.equal('cover bytes')
    // The embedded ZIP library resolves an empty extraction for an absent entry.
    expect(await extractor.extractToFile('missing.jpg', output)).to.equal(true)
    expect(await extractor.extractToFile('images/cover.jpg', Path.join(directory, 'missing', 'cover.jpg'))).to.equal(false)
  })

  it('keeps ZIP buffer errors as rejections and handles close failures asynchronously', async () => {
    const extractor = await createCbz()
    let failure
    try { await extractor.extractToBuffer('missing.jpg') } catch (error) { failure = error }
    expect(failure).to.be.instanceOf(Error)
    const closeError = new Error('close failed')
    sinon.stub(extractor.archive, 'close').rejects(closeError)
    expect(extractor.close()).to.equal(undefined)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(Logger.error.lastCall.args[1]).to.equal(closeError)
    extractor.archive.close.restore()
  })

  it('keeps missing buffer results and asynchronous read errors distinct', async () => {
    const extractor = extractors.createComicBookExtractor(Path.join(directory, 'missing.cbr'))
    expect(await extractor.getBuffer()).to.equal(null)
    await fs.writeFile(extractor.comicPath, 'data')
    const reason = new Error('read failed')
    sinon.stub(embeddedFs, 'readFile').rejects(reason)
    let failure
    try { await extractor.getBuffer() } catch (error) { failure = error }
    expect(failure).to.equal(reason)
  })

  it('uses RAR filename sanitization and removes only empty extraction parents', async () => {
    const archive = { getFileList: sinon.stub(), extract: sinon.stub() }
    const create = sinon.stub(unrar, 'createExtractorFromFile').resolves(archive)
    const extractor = extractors.createComicBookExtractor(Path.join(directory, 'book.cbr'))
    await extractor.open()
    const options = create.firstCall.args[0]
    const temporary = Path.join(directory, 'tmp')
    expect(options.targetPath).to.equal(temporary)
    expect(options.filenameTransform('images/cover.jpg')).to.equal(Path.join('images', 'cover.jpg'))
    for (const path of ['.', '..', 'images/../../escape.jpg']) {
      expect(() => options.filenameTransform(path)).to.throw('Unsafe archive path')
    }
    archive.getFileList.returns({ fileHeaders: [
      { name: 'images', flags: { directory: true } },
      { name: 'images/cover.jpg', flags: { directory: false } }
    ] })
    expect(await extractor.getFilePaths()).to.deep.equal(['images/cover.jpg'])
    const imageDirectory = Path.join(temporary, 'images')
    await fs.mkdir(imageDirectory)
    await fs.writeFile(Path.join(imageDirectory, 'cover.jpg'), 'cover bytes')
    archive.extract.returns({ files: [{ fileHeader: { name: 'images/cover.jpg' } }] })
    expect((await extractor.extractToBuffer('images/cover.jpg')).toString()).to.equal('cover bytes')
    expect(await embeddedFs.pathExists(imageDirectory)).to.equal(false)

    await fs.mkdir(imageDirectory)
    await fs.writeFile(Path.join(imageDirectory, 'cover.jpg'), 'new cover')
    await fs.writeFile(Path.join(imageDirectory, 'keep.txt'), 'keep')
    const output = Path.join(directory, 'cover.jpg')
    await fs.writeFile(output, 'old cover')
    expect(await extractor.extractToFile('images/cover.jpg', output)).to.equal(true)
    expect(await fs.readFile(output, 'utf8')).to.equal('new cover')
    expect(await fs.readFile(Path.join(imageDirectory, 'keep.txt'), 'utf8')).to.equal('keep')
  })

  it('keeps RAR listing exceptions as promise rejections', async () => {
    const reason = new Error('invalid RAR')
    sinon.stub(unrar, 'createExtractorFromFile').resolves({ getFileList: sinon.stub().throws(reason) })
    const extractor = extractors.createComicBookExtractor(Path.join(directory, 'book.cbr'))
    await extractor.open()
    let pending
    expect(() => { pending = extractor.getFilePaths() }).not.to.throw()
    let failure
    try { await pending } catch (error) { failure = error }
    expect(failure).to.equal(reason)
  })
})
