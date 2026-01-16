const { expect } = require('chai')
const sinon = require('sinon')
const fileUtils = require('../../../server/utils/fileUtils')
const fs = require('../../../server/libs/fsExtra')
const EventEmitter = require('events')

const { generateFFMetadata, addCoverAndMetadataToFile, extractCoverArt } = require('../../../server/utils/ffmpegHelpers')

global.isWin = process.platform === 'win32'

describe('generateFFMetadata', () => {
  function createTestSetup() {
    const metadata = {
      title: 'My Audiobook',
      artist: 'John Doe',
      album: 'Best Audiobooks'
    }

    const chapters = [
      { start: 0, end: 1000, title: 'Chapter 1' },
      { start: 1000, end: 2000, title: 'Chapter 2' }
    ]

    return { metadata, chapters }
  }

  let metadata = null
  let chapters = null
  beforeEach(() => {
    const input = createTestSetup()
    metadata = input.metadata
    chapters = input.chapters
  })

  it('should generate ffmetadata content with chapters', () => {
    const result = generateFFMetadata(metadata, chapters)

    expect(result).to.equal(';FFMETADATA1\ntitle=My Audiobook\nartist=John Doe\nalbum=Best Audiobooks\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=1000000\ntitle=Chapter 1\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=1000000\nEND=2000000\ntitle=Chapter 2\n')
  })

  it('should generate ffmetadata content without chapters', () => {
    chapters = null

    const result = generateFFMetadata(metadata, chapters)

    expect(result).to.equal(';FFMETADATA1\ntitle=My Audiobook\nartist=John Doe\nalbum=Best Audiobooks\n')
  })

  it('should handle chapters with no title', () => {
    chapters = [
      { start: 0, end: 1000 },
      { start: 1000, end: 2000 }
    ]

    const result = generateFFMetadata(metadata, chapters)

    expect(result).to.equal(';FFMETADATA1\ntitle=My Audiobook\nartist=John Doe\nalbum=Best Audiobooks\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=1000000\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=1000000\nEND=2000000\n')
  })

  it('should handle metadata escaping special characters (=, ;, #,  and a newline)', () => {
    metadata.title = 'My Audiobook; with = special # characters\n'
    chapters[0].title = 'Chapter #1'

    const result = generateFFMetadata(metadata, chapters)

    expect(result).to.equal(';FFMETADATA1\ntitle=My Audiobook\\; with \\= special \\# characters\\\n\nartist=John Doe\nalbum=Best Audiobooks\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=1000000\ntitle=Chapter \\#1\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=1000000\nEND=2000000\ntitle=Chapter 2\n')
  })
})

describe('addCoverAndMetadataToFile', () => {
  function createTestSetup() {
    const audioFilePath = '/path/to/audio/file.mp3'
    const coverFilePath = '/path/to/cover/image.jpg'
    const metadataFilePath = '/path/to/metadata/file.txt'
    const track = 1
    const mimeType = 'audio/mpeg'

    const ffmpegStub = new EventEmitter()
    ffmpegStub.input = sinon.stub().returnsThis()
    ffmpegStub.outputOptions = sinon.stub().returnsThis()
    ffmpegStub.output = sinon.stub().returnsThis()
    ffmpegStub.input = sinon.stub().returnsThis()
    ffmpegStub.run = sinon.stub().callsFake(() => {
      ffmpegStub.emit('end')
    })
    const copyStub = sinon.stub().resolves()
    const fsRemoveStub = sinon.stub(fs, 'remove').resolves()

    return { audioFilePath, coverFilePath, metadataFilePath, track, mimeType, ffmpegStub, copyStub, fsRemoveStub }
  }

  let audioFilePath = null
  let coverFilePath = null
  let metadataFilePath = null
  let track = null
  let mimeType = null
  let ffmpegStub = null
  let copyStub = null
  let fsRemoveStub = null
  beforeEach(() => {
    const input = createTestSetup()
    audioFilePath = input.audioFilePath
    coverFilePath = input.coverFilePath
    metadataFilePath = input.metadataFilePath
    track = input.track
    mimeType = input.mimeType
    ffmpegStub = input.ffmpegStub
    copyStub = input.copyStub
    fsRemoveStub = input.fsRemoveStub
  })

  it('should add cover image and metadata to audio file', async () => {
    // Act
    await addCoverAndMetadataToFile(audioFilePath, coverFilePath, metadataFilePath, track, mimeType, null, ffmpegStub, copyStub)

    // Assert
    expect(ffmpegStub.input.calledThrice).to.be.true
    expect(ffmpegStub.input.getCall(0).args[0]).to.equal(audioFilePath)
    expect(ffmpegStub.input.getCall(1).args[0]).to.equal(metadataFilePath)
    expect(ffmpegStub.input.getCall(2).args[0]).to.equal(coverFilePath)

    expect(ffmpegStub.outputOptions.callCount).to.equal(4)
    expect(ffmpegStub.outputOptions.getCall(0).args[0]).to.deep.equal(['-map 0:a', '-map_metadata 1', '-map_metadata 0', '-map_chapters 1', '-c copy'])
    expect(ffmpegStub.outputOptions.getCall(1).args[0]).to.deep.equal(['-metadata track=1'])
    expect(ffmpegStub.outputOptions.getCall(2).args[0]).to.deep.equal(['-id3v2_version 3'])
    expect(ffmpegStub.outputOptions.getCall(3).args[0]).to.deep.equal(['-map 2:v', '-disposition:v:0 attached_pic', '-metadata:s:v', 'title=Cover', '-metadata:s:v', 'comment=Cover'])

    expect(ffmpegStub.output.calledOnce).to.be.true
    expect(ffmpegStub.output.firstCall.args[0]).to.equal('/path/to/audio/file.tmp.mp3')

    expect(ffmpegStub.run.calledOnce).to.be.true

    expect(copyStub.calledOnce).to.be.true
    expect(copyStub.firstCall.args[0]).to.equal('/path/to/audio/file.tmp.mp3')
    expect(copyStub.firstCall.args[1]).to.equal('/path/to/audio/file.mp3')
    expect(fsRemoveStub.calledOnce).to.be.true
    expect(fsRemoveStub.firstCall.args[0]).to.equal('/path/to/audio/file.tmp.mp3')

    // Restore the stub
    sinon.restore()
  })

  it('should handle missing cover image', async () => {
    // Arrange
    coverFilePath = null

    // Act
    await addCoverAndMetadataToFile(audioFilePath, coverFilePath, metadataFilePath, track, mimeType, null, ffmpegStub, copyStub)

    // Assert
    expect(ffmpegStub.input.calledTwice).to.be.true
    expect(ffmpegStub.input.getCall(0).args[0]).to.equal(audioFilePath)
    expect(ffmpegStub.input.getCall(1).args[0]).to.equal(metadataFilePath)

    expect(ffmpegStub.outputOptions.callCount).to.equal(4)
    expect(ffmpegStub.outputOptions.getCall(0).args[0]).to.deep.equal(['-map 0:a', '-map_metadata 1', '-map_metadata 0', '-map_chapters 1', '-c copy'])
    expect(ffmpegStub.outputOptions.getCall(1).args[0]).to.deep.equal(['-metadata track=1'])
    expect(ffmpegStub.outputOptions.getCall(2).args[0]).to.deep.equal(['-id3v2_version 3'])
    expect(ffmpegStub.outputOptions.getCall(3).args[0]).to.deep.equal(['-map 0:v?'])

    expect(ffmpegStub.output.calledOnce).to.be.true
    expect(ffmpegStub.output.firstCall.args[0]).to.equal('/path/to/audio/file.tmp.mp3')

    expect(ffmpegStub.run.calledOnce).to.be.true

    expect(copyStub.callCount).to.equal(1)
    expect(copyStub.firstCall.args[0]).to.equal('/path/to/audio/file.tmp.mp3')
    expect(copyStub.firstCall.args[1]).to.equal('/path/to/audio/file.mp3')
    expect(fsRemoveStub.calledOnce).to.be.true
    expect(fsRemoveStub.firstCall.args[0]).to.equal('/path/to/audio/file.tmp.mp3')

    // Restore the stub
    sinon.restore()
  })

  it('should handle error during ffmpeg execution', async () => {
    // Arrange
    ffmpegStub.run = sinon.stub().callsFake(() => {
      ffmpegStub.emit('error', new Error('FFmpeg error'))
    })

    // Act
    try {
      await addCoverAndMetadataToFile(audioFilePath, coverFilePath, metadataFilePath, track, mimeType, null, ffmpegStub, copyStub)
      expect.fail('Expected an error to be thrown')
    } catch (error) {
      // Assert
      expect(error.message).to.equal('FFmpeg error')
    }

    // Assert
    expect(ffmpegStub.input.calledThrice).to.be.true
    expect(ffmpegStub.input.getCall(0).args[0]).to.equal(audioFilePath)
    expect(ffmpegStub.input.getCall(1).args[0]).to.equal(metadataFilePath)
    expect(ffmpegStub.input.getCall(2).args[0]).to.equal(coverFilePath)

    expect(ffmpegStub.outputOptions.callCount).to.equal(4)
    expect(ffmpegStub.outputOptions.getCall(0).args[0]).to.deep.equal(['-map 0:a', '-map_metadata 1', '-map_metadata 0', '-map_chapters 1', '-c copy'])
    expect(ffmpegStub.outputOptions.getCall(1).args[0]).to.deep.equal(['-metadata track=1'])
    expect(ffmpegStub.outputOptions.getCall(2).args[0]).to.deep.equal(['-id3v2_version 3'])
    expect(ffmpegStub.outputOptions.getCall(3).args[0]).to.deep.equal(['-map 2:v', '-disposition:v:0 attached_pic', '-metadata:s:v', 'title=Cover', '-metadata:s:v', 'comment=Cover'])

    expect(ffmpegStub.output.calledOnce).to.be.true
    expect(ffmpegStub.output.firstCall.args[0]).to.equal('/path/to/audio/file.tmp.mp3')

    expect(ffmpegStub.run.calledOnce).to.be.true

    expect(copyStub.called).to.be.false
    expect(fsRemoveStub.called).to.be.false

    // Restore the stub
    sinon.restore()
  })

  it('should handle m4b embedding', async () => {
    // Arrange
    mimeType = 'audio/mp4'
    audioFilePath = '/path/to/audio/file.m4b'

    // Act
    await addCoverAndMetadataToFile(audioFilePath, coverFilePath, metadataFilePath, track, mimeType, null, ffmpegStub, copyStub)

    // Assert
    expect(ffmpegStub.input.calledThrice).to.be.true
    expect(ffmpegStub.input.getCall(0).args[0]).to.equal(audioFilePath)
    expect(ffmpegStub.input.getCall(1).args[0]).to.equal(metadataFilePath)
    expect(ffmpegStub.input.getCall(2).args[0]).to.equal(coverFilePath)

    expect(ffmpegStub.outputOptions.callCount).to.equal(4)
    expect(ffmpegStub.outputOptions.getCall(0).args[0]).to.deep.equal(['-map 0:a', '-map_metadata 1', '-map_metadata 0', '-map_chapters 1', '-c copy'])
    expect(ffmpegStub.outputOptions.getCall(1).args[0]).to.deep.equal(['-metadata track=1'])
    expect(ffmpegStub.outputOptions.getCall(2).args[0]).to.deep.equal(['-f mp4'])
    expect(ffmpegStub.outputOptions.getCall(3).args[0]).to.deep.equal(['-map 2:v', '-disposition:v:0 attached_pic', '-metadata:s:v', 'title=Cover', '-metadata:s:v', 'comment=Cover'])

    expect(ffmpegStub.output.calledOnce).to.be.true
    expect(ffmpegStub.output.firstCall.args[0]).to.equal('/path/to/audio/file.tmp.m4b')

    expect(ffmpegStub.run.calledOnce).to.be.true

    expect(copyStub.calledOnce).to.be.true
    expect(copyStub.firstCall.args[0]).to.equal('/path/to/audio/file.tmp.m4b')
    expect(copyStub.firstCall.args[1]).to.equal('/path/to/audio/file.m4b')
    expect(fsRemoveStub.calledOnce).to.be.true
    expect(fsRemoveStub.firstCall.args[0]).to.equal('/path/to/audio/file.tmp.m4b')

    // Restore the stub
    sinon.restore()
  })
})

describe('extractCoverArt', () => {
  function createTestSetup() {
    const filepath = '/path/to/audio/file.m4b'
    const outputpath = '/path/to/output/cover.jpg'

    const ffmpegCommandStub = new EventEmitter()
    ffmpegCommandStub.addOption = sinon.stub().returnsThis()
    ffmpegCommandStub.output = sinon.stub().returnsThis()
    ffmpegCommandStub.run = sinon.stub().callsFake(() => {
      ffmpegCommandStub.emit('end')
    })

    const ffmpegModuleStub = sinon.stub().returns(ffmpegCommandStub)
    ffmpegModuleStub.ffprobe = sinon.stub()

    const ensureDirStub = sinon.stub(fs, 'ensureDir').resolves()

    return { filepath, outputpath, ffmpegCommandStub, ffmpegModuleStub, ensureDirStub }
  }

  let filepath = null
  let outputpath = null
  let ffmpegCommandStub = null
  let ffmpegModuleStub = null
  let ensureDirStub = null

  beforeEach(() => {
    const input = createTestSetup()
    filepath = input.filepath
    outputpath = input.outputpath
    ffmpegCommandStub = input.ffmpegCommandStub
    ffmpegModuleStub = input.ffmpegModuleStub
    ensureDirStub = input.ensureDirStub
  })

  afterEach(() => {
    sinon.restore()
  })

  it('should extract cover art from a file with a single video stream', async () => {
    // Arrange
    const metadata = {
      streams: [
        { codec_type: 'audio', index: 0 },
        { codec_type: 'video', index: 1, width: 400, height: 400 }
      ]
    }
    ffmpegModuleStub.ffprobe.yields(null, metadata)

    // Act
    const result = await extractCoverArt(filepath, outputpath, ffmpegModuleStub)

    // Assert
    expect(ffmpegModuleStub.ffprobe.calledOnce).to.be.true
    expect(ffmpegModuleStub.ffprobe.firstCall.args[0]).to.equal(filepath)
    expect(ffmpegCommandStub.addOption.calledOnce).to.be.true
    expect(ffmpegCommandStub.addOption.firstCall.args[0]).to.deep.equal(['-map 0:1', '-frames:v 1'])
    expect(ffmpegCommandStub.output.calledOnce).to.be.true
    expect(ffmpegCommandStub.output.firstCall.args[0]).to.equal(outputpath)
    expect(ffmpegCommandStub.run.calledOnce).to.be.true
    expect(result).to.equal(outputpath)
  })

  it('should select the largest video stream when multiple exist and ignore 1x1 placeholder', async () => {
    // Arrange - simulate the Christmas Carol case with 1x1 and 400x400 streams
    const metadata = {
      streams: [
        { codec_type: 'audio', index: 0 },
        { codec_type: 'video', index: 1, width: 1, height: 1 },
        { codec_type: 'audio', index: 2 },
        { codec_type: 'video', index: 3, width: 400, height: 400 }
      ]
    }
    ffmpegModuleStub.ffprobe.yields(null, metadata)

    // Act
    const result = await extractCoverArt(filepath, outputpath, ffmpegModuleStub)

    // Assert
    expect(ffmpegModuleStub.ffprobe.calledOnce).to.be.true
    expect(ffmpegCommandStub.addOption.calledOnce).to.be.true
    // Should select index 3 (400x400) and ignore index 1 (1x1)
    expect(ffmpegCommandStub.addOption.firstCall.args[0]).to.deep.equal(['-map 0:3', '-frames:v 1'])
    expect(result).to.equal(outputpath)
  })

  it('should select the largest video stream among multiple sizes', async () => {
    // Arrange - test with various resolutions
    const metadata = {
      streams: [
        { codec_type: 'video', index: 0, width: 100, height: 100 }, // 10,000 pixels
        { codec_type: 'video', index: 1, width: 200, height: 150 }, // 30,000 pixels
        { codec_type: 'video', index: 2, width: 300, height: 200 }, // 60,000 pixels (largest)
        { codec_type: 'video', index: 3, width: 150, height: 300 }  // 45,000 pixels
      ]
    }
    ffmpegModuleStub.ffprobe.yields(null, metadata)

    // Act
    const result = await extractCoverArt(filepath, outputpath, ffmpegModuleStub)

    // Assert
    expect(ffmpegCommandStub.addOption.firstCall.args[0]).to.deep.equal(['-map 0:2', '-frames:v 1'])
    expect(result).to.equal(outputpath)
  })

  it('should ignore video streams with missing width/height and select valid ones', async () => {
    // Arrange
    const metadata = {
      streams: [
        { codec_type: 'video', index: 0 }, // no dimensions (will be filtered out)
        { codec_type: 'video', index: 1, width: 400, height: 400 }
      ]
    }
    ffmpegModuleStub.ffprobe.yields(null, metadata)

    // Act
    const result = await extractCoverArt(filepath, outputpath, ffmpegModuleStub)

    // Assert
    // Should ignore index 0 (no dimensions) and select index 1 (400x400)
    expect(ffmpegCommandStub.addOption.firstCall.args[0]).to.deep.equal(['-map 0:1', '-frames:v 1'])
    expect(result).to.equal(outputpath)
  })

  it('should return false when ffprobe fails', async () => {
    // Arrange
    ffmpegModuleStub.ffprobe.yields(new Error('ffprobe error'), null)

    // Act
    const result = await extractCoverArt(filepath, outputpath, ffmpegModuleStub)

    // Assert
    expect(ffmpegModuleStub.ffprobe.calledOnce).to.be.true
    expect(ffmpegCommandStub.run.called).to.be.false
    expect(result).to.be.false
  })

  it('should return false when no video streams found', async () => {
    // Arrange
    const metadata = {
      streams: [
        { codec_type: 'audio', index: 0 },
        { codec_type: 'audio', index: 1 }
      ]
    }
    ffmpegModuleStub.ffprobe.yields(null, metadata)

    // Act
    const result = await extractCoverArt(filepath, outputpath, ffmpegModuleStub)

    // Assert
    expect(ffmpegModuleStub.ffprobe.calledOnce).to.be.true
    expect(ffmpegCommandStub.run.called).to.be.false
    expect(result).to.be.false
  })

  it('should return false when only tiny placeholder images exist (width or height <= 1)', async () => {
    // Arrange
    const metadata = {
      streams: [
        { codec_type: 'audio', index: 0 },
        { codec_type: 'video', index: 1, width: 1, height: 1 },
        { codec_type: 'video', index: 2, width: 0, height: 100 },
        { codec_type: 'video', index: 3, width: 100, height: 1 }
      ]
    }
    ffmpegModuleStub.ffprobe.yields(null, metadata)

    // Act
    const result = await extractCoverArt(filepath, outputpath, ffmpegModuleStub)

    // Assert
    expect(ffmpegModuleStub.ffprobe.calledOnce).to.be.true
    expect(ffmpegCommandStub.run.called).to.be.false
    expect(result).to.be.false
  })

  it('should return false when ffmpeg extraction fails', async () => {
    // Arrange
    const metadata = {
      streams: [
        { codec_type: 'video', index: 0, width: 400, height: 400 }
      ]
    }
    ffmpegModuleStub.ffprobe.yields(null, metadata)
    ffmpegCommandStub.run = sinon.stub().callsFake(() => {
      ffmpegCommandStub.emit('error', new Error('FFmpeg extraction error'))
    })

    // Act
    const result = await extractCoverArt(filepath, outputpath, ffmpegModuleStub)

    // Assert
    expect(ffmpegModuleStub.ffprobe.calledOnce).to.be.true
    expect(ffmpegCommandStub.run.calledOnce).to.be.true
    expect(result).to.be.false
  })

  it('should ensure output directory exists', async () => {
    // Arrange
    const metadata = {
      streams: [
        { codec_type: 'video', index: 0, width: 400, height: 400 }
      ]
    }
    ffmpegModuleStub.ffprobe.yields(null, metadata)

    // Act
    await extractCoverArt(filepath, outputpath, ffmpegModuleStub)

    // Assert
    expect(ensureDirStub.calledOnce).to.be.true
    expect(ensureDirStub.firstCall.args[0]).to.equal('/path/to/output')
  })
})
