const { expect } = require('chai')
const sinon = require('sinon')
const fileUtils = require('../../../server/utils/fileUtils')
const fs = require('../../../server/libs/fsExtra')
const EventEmitter = require('events')

const { generateFFMetadata, addCoverAndMetadataToFile, mergeAudioFiles } = require('../../../server/utils/ffmpegHelpers')

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

  it('should classify SIGKILL as user cancellation when metadata cancellation was requested', async () => {
    ffmpegStub.cancelRequested = true
    ffmpegStub.run = sinon.stub().callsFake(() => {
      ffmpegStub.emit('error', new Error('ffmpeg was killed with signal SIGKILL'))
    })

    try {
      await addCoverAndMetadataToFile(audioFilePath, coverFilePath, metadataFilePath, track, mimeType, null, ffmpegStub, copyStub)
      expect.fail('Expected an error to be thrown')
    } catch (error) {
      expect(error.message).to.equal('FFMPEG_CANCELED')
    }

    sinon.restore()
  })

  it('should preserve an unexpected SIGKILL while embedding metadata', async () => {
    const ffmpegError = new Error('ffmpeg was killed with signal SIGKILL')
    ffmpegStub.run = sinon.stub().callsFake(() => {
      ffmpegStub.emit('error', ffmpegError, 'ffmpeg stdout', 'ffmpeg stderr')
    })

    try {
      await addCoverAndMetadataToFile(audioFilePath, coverFilePath, metadataFilePath, track, mimeType, null, ffmpegStub, copyStub)
      expect.fail('Expected an error to be thrown')
    } catch (error) {
      expect(error).to.equal(ffmpegError)
    }

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

describe('mergeAudioFiles', () => {
  function createFfmpegStub(error) {
    const ffmpegStub = new EventEmitter()
    ffmpegStub.input = sinon.stub().returnsThis()
    ffmpegStub.inputOptions = sinon.stub().returnsThis()
    ffmpegStub.outputOptions = sinon.stub().returnsThis()
    ffmpegStub.output = sinon.stub().returnsThis()
    ffmpegStub.run = sinon.stub().callsFake(() => {
      ffmpegStub.emit('error', error, 'ffmpeg stdout', 'ffmpeg stderr')
    })
    return ffmpegStub
  }

  const audioTracks = [
    {
      metadata: {
        ext: '.m4b',
        path: '/path/to/audio/file.m4b'
      }
    }
  ]

  async function getMergeError(ffmpegStub) {
    try {
      await mergeAudioFiles(audioTracks, 60, '/path/to/cache', '/path/to/output.m4b', {}, null, ffmpegStub)
      expect.fail('Expected an error to be thrown')
    } catch (error) {
      return error
    }
  }

  it('should classify SIGKILL as user cancellation when cancellation was requested', async () => {
    const ffmpegStub = createFfmpegStub(new Error('ffmpeg was killed with signal SIGKILL'))
    ffmpegStub.cancelRequested = true

    const error = await getMergeError(ffmpegStub)

    expect(error.message).to.equal('FFMPEG_CANCELED')
  })

  it('should preserve an unexpected SIGKILL as an ffmpeg failure', async () => {
    const ffmpegError = new Error('ffmpeg was killed with signal SIGKILL')
    const ffmpegStub = createFfmpegStub(ffmpegError)

    const error = await getMergeError(ffmpegStub)

    expect(error).to.equal(ffmpegError)
    expect(error.message).to.equal('ffmpeg was killed with signal SIGKILL')
  })

  it('should preserve an ordinary non-zero ffmpeg exit as an ffmpeg failure', async () => {
    const ffmpegError = new Error('ffmpeg exited with code 1: invalid input')
    const ffmpegStub = createFfmpegStub(ffmpegError)

    const error = await getMergeError(ffmpegStub)

    expect(error).to.equal(ffmpegError)
    expect(error.message).to.equal('ffmpeg exited with code 1: invalid input')
  })
})
