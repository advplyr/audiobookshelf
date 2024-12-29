const chai = require('chai')
const sinon = require('sinon')
const fs = require('../../../server/libs/fsExtra')
const fileUtils = require('../../../server/utils/fileUtils')
const which = require('../../../server/libs/which')
const path = require('path')
const BinaryManager = require('../../../server/managers/BinaryManager')
const { Binary, ffbinaries } = require('../../../server/managers/BinaryManager')

const expect = chai.expect

describe('BinaryManager', () => {
  let binaryManager

  describe('init', () => {
    let findStub
    let installStub
    let removeOldBinariesStub
    let errorStub
    let exitStub

    beforeEach(() => {
      binaryManager = new BinaryManager()
      findStub = sinon.stub(binaryManager, 'findRequiredBinaries')
      installStub = sinon.stub(binaryManager, 'install')
      removeOldBinariesStub = sinon.stub(binaryManager, 'removeOldBinaries')
      errorStub = sinon.stub(console, 'error')
      exitStub = sinon.stub(process, 'exit')
    })

    afterEach(() => {
      findStub.restore()
      installStub.restore()
      removeOldBinariesStub.restore()
      errorStub.restore()
      exitStub.restore()
    })

    it('should not install binaries if they are already found', async () => {
      findStub.resolves([])

      await binaryManager.init()

      expect(installStub.called).to.be.false
      expect(removeOldBinariesStub.called).to.be.false
      expect(findStub.calledOnce).to.be.true
      expect(errorStub.called).to.be.false
      expect(exitStub.called).to.be.false
    })

    it('should install missing binaries', async () => {
      const ffmpegBinary = new Binary('ffmpeg', 'executable', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      const ffprobeBinary = new Binary('ffprobe', 'executable', 'FFPROBE_PATH', ['5.1'], ffbinaries)
      const requiredBinaries = [ffmpegBinary, ffprobeBinary]
      const missingBinaries = [ffprobeBinary]
      const missingBinariesAfterInstall = []
      findStub.onFirstCall().resolves(missingBinaries)
      findStub.onSecondCall().resolves(missingBinariesAfterInstall)
      binaryManager.requiredBinaries = requiredBinaries

      await binaryManager.init()

      expect(findStub.calledTwice).to.be.true
      expect(installStub.calledOnce).to.be.true
      expect(removeOldBinariesStub.calledOnce).to.be.true
      expect(errorStub.called).to.be.false
      expect(exitStub.called).to.be.false
    })

    it('exit if binaries are not found after installation', async () => {
      const ffmpegBinary = new Binary('ffmpeg', 'executable', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      const ffprobeBinary = new Binary('ffprobe', 'executable', 'FFPROBE_PATH', ['5.1'], ffbinaries)
      const requiredBinaries = [ffmpegBinary, ffprobeBinary]
      const missingBinaries = [ffprobeBinary]
      const missingBinariesAfterInstall = [ffprobeBinary]
      findStub.onFirstCall().resolves(missingBinaries)
      findStub.onSecondCall().resolves(missingBinariesAfterInstall)

      await binaryManager.init()

      expect(findStub.calledTwice).to.be.true
      expect(installStub.calledOnce).to.be.true
      expect(removeOldBinariesStub.calledOnce).to.be.true
      expect(errorStub.calledOnce).to.be.true
      expect(exitStub.calledOnce).to.be.true
      expect(exitStub.calledWith(1)).to.be.true
    })

    it('should not exit if binaries are not found but not required', async () => {
      const ffmpegBinary = new Binary('ffmpeg', 'executable', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      const ffprobeBinary = new Binary('ffprobe', 'executable', 'FFPROBE_PATH', ['5.1'], ffbinaries, false)
      const requiredBinaries = [ffmpegBinary]
      const missingBinaries = [ffprobeBinary]
      const missingBinariesAfterInstall = [ffprobeBinary]
      findStub.onFirstCall().resolves(missingBinaries)
      findStub.onSecondCall().resolves(missingBinariesAfterInstall)
      binaryManager.requiredBinaries = requiredBinaries

      await binaryManager.init()

      expect(findStub.calledTwice).to.be.true
      expect(installStub.calledOnce).to.be.true
      expect(removeOldBinariesStub.calledOnce).to.be.true
      expect(errorStub.called).to.be.false
      expect(exitStub.called).to.be.false
    })
  })

  describe('findRequiredBinaries', () => {
    let findBinaryStub
    let ffmpegBinary

    beforeEach(() => {
      ffmpegBinary = new Binary('ffmpeg', 'executable', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      const requiredBinaries = [ffmpegBinary]
      binaryManager = new BinaryManager(requiredBinaries)
      findBinaryStub = sinon.stub(ffmpegBinary, 'find')
    })

    afterEach(() => {
      findBinaryStub.restore()
    })

    it('should put found paths in the correct environment variables', async () => {
      const pathToFFmpeg = '/path/to/ffmpeg'
      const missingBinaries = []
      delete process.env.FFMPEG_PATH
      findBinaryStub.resolves(pathToFFmpeg)

      const result = await binaryManager.findRequiredBinaries()

      expect(result).to.deep.equal(missingBinaries)
      expect(findBinaryStub.calledOnce).to.be.true
      expect(process.env.FFMPEG_PATH).to.equal(pathToFFmpeg)
    })

    it('should add missing binaries to result', async () => {
      const missingBinaries = [ffmpegBinary]
      delete process.env.FFMPEG_PATH
      findBinaryStub.resolves(null)

      const result = await binaryManager.findRequiredBinaries()

      expect(result).to.deep.equal(missingBinaries)
      expect(findBinaryStub.calledOnce).to.be.true
      expect(process.env.FFMPEG_PATH).to.be.undefined
    })
  })

  describe('install', () => {
    let isWritableStub
    let downloadBinaryStub
    let ffmpegBinary

    beforeEach(() => {
      ffmpegBinary = new Binary('ffmpeg', 'executable', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      const requiredBinaries = [ffmpegBinary]
      binaryManager = new BinaryManager(requiredBinaries)
      isWritableStub = sinon.stub(fileUtils, 'isWritable')
      downloadBinaryStub = sinon.stub(ffmpegBinary, 'download')
      binaryManager.mainInstallDir = '/path/to/main/install'
      binaryManager.altInstallDir = '/path/to/alt/install'
    })

    afterEach(() => {
      isWritableStub.restore()
      downloadBinaryStub.restore()
    })

    it('should not install binaries if no binaries are passed', async () => {
      const binaries = []

      await binaryManager.install(binaries)

      expect(isWritableStub.called).to.be.false
      expect(downloadBinaryStub.called).to.be.false
    })

    it('should install binaries in main install path if has access', async () => {
      const binaries = [ffmpegBinary]
      const destination = binaryManager.mainInstallDir
      isWritableStub.withArgs(destination).resolves(true)
      downloadBinaryStub.resolves()

      await binaryManager.install(binaries)

      expect(isWritableStub.calledOnce).to.be.true
      expect(downloadBinaryStub.calledOnce).to.be.true
      expect(downloadBinaryStub.calledWith(destination)).to.be.true
    })

    it('should install binaries in alt install path if has no access to main', async () => {
      const binaries = [ffmpegBinary]
      const mainDestination = binaryManager.mainInstallDir
      const destination = binaryManager.altInstallDir
      isWritableStub.withArgs(mainDestination).resolves(false)
      downloadBinaryStub.resolves()

      await binaryManager.install(binaries)

      expect(isWritableStub.calledOnce).to.be.true
      expect(downloadBinaryStub.calledOnce).to.be.true
      expect(downloadBinaryStub.calledWith(destination)).to.be.true
    })
  })
})

describe('Binary', () => {
  describe('find', () => {
    let binary
    let isGoodStub
    let whichSyncStub
    let mainInstallPath
    let altInstallPath

    const name = 'ffmpeg'
    const envVariable = 'FFMPEG_PATH'
    const defaultPath = '/path/to/ffmpeg'
    const executable = name + (process.platform == 'win32' ? '.exe' : '')
    const whichPath = '/usr/bin/ffmpeg'

    beforeEach(() => {
      binary = new Binary(name, 'executable', envVariable, ['5.1'], ffbinaries)
      isGoodStub = sinon.stub(binary, 'isGood')
      whichSyncStub = sinon.stub(which, 'sync')
      binary.mainInstallDir = '/path/to/main/install'
      mainInstallPath = path.join(binary.mainInstallDir, executable)
      binary.altInstallDir = '/path/to/alt/install'
      altInstallPath = path.join(binary.altInstallDir, executable)
    })

    afterEach(() => {
      isGoodStub.restore()
      whichSyncStub.restore()
    })

    it('should return the defaultPath if it exists and is a good binary', async () => {
      process.env[envVariable] = defaultPath
      isGoodStub.withArgs(defaultPath).resolves(true)

      const result = await binary.find(binary.mainInstallDir, binary.altInstallDir)

      expect(result).to.equal(defaultPath)
      expect(isGoodStub.calledOnce).to.be.true
      expect(isGoodStub.calledWith(defaultPath)).to.be.true
    })

    it('should return the whichPath if it exists and is a good binary', async () => {
      delete process.env[envVariable]
      isGoodStub.withArgs(undefined).resolves(false)
      whichSyncStub.returns(whichPath)
      isGoodStub.withArgs(whichPath).resolves(true)

      const result = await binary.find(binary.mainInstallDir, binary.altInstallDir)

      expect(result).to.equal(whichPath)
      expect(isGoodStub.calledTwice).to.be.true
      expect(isGoodStub.calledWith(undefined)).to.be.true
      expect(isGoodStub.calledWith(whichPath)).to.be.true
    })

    it('should return the mainInstallPath if it exists and is a good binary', async () => {
      delete process.env[envVariable]
      isGoodStub.withArgs(undefined).resolves(false)
      whichSyncStub.returns(null)
      isGoodStub.withArgs(null).resolves(false)
      isGoodStub.withArgs(mainInstallPath).resolves(true)

      const result = await binary.find(binary.mainInstallDir, binary.altInstallDir)

      expect(result).to.equal(mainInstallPath)
      expect(isGoodStub.callCount).to.be.equal(3)
      expect(isGoodStub.calledWith(undefined)).to.be.true
      expect(isGoodStub.calledWith(null)).to.be.true
      expect(isGoodStub.calledWith(mainInstallPath)).to.be.true
    })

    it('should return the altInstallPath if it exists and is a good binary', async () => {
      delete process.env[envVariable]
      isGoodStub.withArgs(undefined).resolves(false)
      whichSyncStub.returns(null)
      isGoodStub.withArgs(null).resolves(false)
      isGoodStub.withArgs(mainInstallPath).resolves(false)
      isGoodStub.withArgs(altInstallPath).resolves(true)

      const result = await binary.find(binary.mainInstallDir, binary.altInstallDir)

      expect(result).to.equal(altInstallPath)
      expect(isGoodStub.callCount).to.be.equal(4)
      expect(isGoodStub.calledWith(undefined)).to.be.true
      expect(isGoodStub.calledWith(null)).to.be.true
      expect(isGoodStub.calledWith(mainInstallPath)).to.be.true
      expect(isGoodStub.calledWith(altInstallPath)).to.be.true
    })

    it('should return null if no good binary is found', async () => {
      delete process.env[envVariable]
      isGoodStub.withArgs(undefined).resolves(false)
      whichSyncStub.returns(null)
      isGoodStub.withArgs(null).resolves(false)
      isGoodStub.withArgs(mainInstallPath).resolves(false)
      isGoodStub.withArgs(altInstallPath).resolves(false)

      const result = await binary.find(binary.mainInstallDir, binary.altInstallDir)

      expect(result).to.be.null
      expect(isGoodStub.callCount).to.be.equal(4)
      expect(isGoodStub.calledWith(undefined)).to.be.true
      expect(isGoodStub.calledWith(null)).to.be.true
      expect(isGoodStub.calledWith(mainInstallPath)).to.be.true
      expect(isGoodStub.calledWith(altInstallPath)).to.be.true
    })
  })

  describe('isGood', () => {
    let binary
    let fsPathExistsStub
    let fsReadFileStub
    let execStub

    const binaryPath = '/path/to/binary'
    const execCommand = '"' + binaryPath + '"' + ' -version'
    const goodVersions = ['5.1', '6']

    beforeEach(() => {
      binary = new Binary('ffmpeg', 'executable', 'FFMPEG_PATH', goodVersions, ffbinaries)
      fsPathExistsStub = sinon.stub(fs, 'pathExists')
      fsReadFileStub = sinon.stub(fs, 'readFile')
      execStub = sinon.stub(binary, 'exec')
    })

    afterEach(() => {
      fsPathExistsStub.restore()
      fsReadFileStub.restore()
      execStub.restore()
    })

    it('should return false if binaryPath is falsy', async () => {
      fsPathExistsStub.resolves(true)

      const result = await binary.isGood(null)

      expect(result).to.be.false
      expect(fsPathExistsStub.called).to.be.false
      expect(execStub.called).to.be.false
    })

    it('should return false if binaryPath does not exist', async () => {
      fsPathExistsStub.resolves(false)

      const result = await binary.isGood(binaryPath)

      expect(result).to.be.false
      expect(fsPathExistsStub.calledOnce).to.be.true
      expect(fsPathExistsStub.calledWith(binaryPath)).to.be.true
      expect(execStub.called).to.be.false
    })

    it('should return false if failed to check version of binary', async () => {
      fsPathExistsStub.resolves(true)
      execStub.rejects(new Error('Failed to execute command'))

      const result = await binary.isGood(binaryPath)

      expect(result).to.be.false
      expect(fsPathExistsStub.calledOnce).to.be.true
      expect(fsPathExistsStub.calledWith(binaryPath)).to.be.true
      expect(execStub.calledOnce).to.be.true
      expect(execStub.calledWith(execCommand)).to.be.true
    })

    it('should return false if version is not found', async () => {
      const stdout = 'Some output without version'
      fsPathExistsStub.resolves(true)
      execStub.resolves({ stdout })

      const result = await binary.isGood(binaryPath)

      expect(result).to.be.false
      expect(fsPathExistsStub.calledOnce).to.be.true
      expect(fsPathExistsStub.calledWith(binaryPath)).to.be.true
      expect(execStub.calledOnce).to.be.true
      expect(execStub.calledWith(execCommand)).to.be.true
    })

    it('should return false if version is found but does not match a good version', async () => {
      const stdout = 'version 1.2.3'
      fsPathExistsStub.resolves(true)
      execStub.resolves({ stdout })

      const result = await binary.isGood(binaryPath)

      expect(result).to.be.false
      expect(fsPathExistsStub.calledOnce).to.be.true
      expect(fsPathExistsStub.calledWith(binaryPath)).to.be.true
      expect(execStub.calledOnce).to.be.true
      expect(execStub.calledWith(execCommand)).to.be.true
    })

    it('should return true if version is found and matches a good version', async () => {
      const stdout = 'version 6.1.2'
      fsPathExistsStub.resolves(true)
      execStub.resolves({ stdout })

      const result = await binary.isGood(binaryPath)

      expect(result).to.be.true
      expect(fsPathExistsStub.calledOnce).to.be.true
      expect(fsPathExistsStub.calledWith(binaryPath)).to.be.true
      expect(execStub.calledOnce).to.be.true
      expect(execStub.calledWith(execCommand)).to.be.true
    })

    it('should check library version file', async () => {
      const binary = new Binary('libavcodec', 'library', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      fsReadFileStub.resolves('5.1.2 ')
      fsPathExistsStub.onFirstCall().resolves(true)
      fsPathExistsStub.onSecondCall().resolves(true)

      const result = await binary.isGood(binaryPath)

      expect(result).to.be.true
      expect(fsPathExistsStub.calledTwice).to.be.true
      expect(fsPathExistsStub.firstCall.args[0]).to.be.equal(binaryPath)
      expect(fsPathExistsStub.secondCall.args[0]).to.be.equal(binaryPath + '.ver')
      expect(fsReadFileStub.calledOnce).to.be.true
      expect(fsReadFileStub.calledWith(binaryPath + '.ver'), 'utf8').to.be.true
    })

    it('should return false if library version file does not exist', async () => {
      const binary = new Binary('libavcodec', 'library', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      fsReadFileStub.resolves('5.1.2 ')
      fsPathExistsStub.onFirstCall().resolves(true)
      fsPathExistsStub.onSecondCall().resolves(false)

      const result = await binary.isGood(binaryPath)

      expect(result).to.be.false
      expect(fsPathExistsStub.calledTwice).to.be.true
      expect(fsPathExistsStub.firstCall.args[0]).to.be.equal(binaryPath)
      expect(fsPathExistsStub.secondCall.args[0]).to.be.equal(binaryPath + '.ver')
      expect(fsReadFileStub.called).to.be.false
    })

    it('should return false if library version does not match a valid version', async () => {
      const binary = new Binary('libavcodec', 'library', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      fsReadFileStub.resolves('5.2.1 ')
      fsPathExistsStub.onFirstCall().resolves(true)
      fsPathExistsStub.onSecondCall().resolves(true)

      const result = await binary.isGood(binaryPath)

      expect(result).to.be.false
      expect(fsPathExistsStub.calledTwice).to.be.true
      expect(fsPathExistsStub.firstCall.args[0]).to.be.equal(binaryPath)
      expect(fsPathExistsStub.secondCall.args[0]).to.be.equal(binaryPath + '.ver')
      expect(fsReadFileStub.calledOnce).to.be.true
      expect(fsReadFileStub.calledWith(binaryPath + '.ver'), 'utf8').to.be.true
    })
  })

  describe('getFileName', () => {
    let originalPlatform

    const mockPlatform = (platform) => {
      Object.defineProperty(process, 'platform', { value: platform })
    }

    beforeEach(() => {
      // Save the original process.platform descriptor
      originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
    })

    afterEach(() => {
      // Restore the original process.platform descriptor
      Object.defineProperty(process, 'platform', originalPlatform)
    })

    it('should return the executable file name with .exe extension on Windows', () => {
      const binary = new Binary('ffmpeg', 'executable', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      mockPlatform('win32')

      const result = binary.getFileName()

      expect(result).to.equal('ffmpeg.exe')
    })

    it('should return the executable file name without extension on linux', () => {
      const binary = new Binary('ffmpeg', 'executable', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      mockPlatform('linux')

      const result = binary.getFileName()

      expect(result).to.equal('ffmpeg')
    })

    it('should return the library file name with .dll extension on Windows', () => {
      const binary = new Binary('ffmpeg', 'library', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      mockPlatform('win32')

      const result = binary.getFileName()

      expect(result).to.equal('ffmpeg.dll')
    })

    it('should return the library file name with .so extension on linux', () => {
      const binary = new Binary('ffmpeg', 'library', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      mockPlatform('linux')

      const result = binary.getFileName()

      expect(result).to.equal('ffmpeg.so')
    })

    it('should return the file name without extension for other types', () => {
      const binary = new Binary('ffmpeg', 'other', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      mockPlatform('win32')

      const result = binary.getFileName()

      expect(result).to.equal('ffmpeg')
    })
  })

  describe('download', () => {
    let binary
    let downloadBinaryStub
    let fsWriteFileStub

    beforeEach(() => {
      binary = new Binary('ffmpeg', 'executable', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      downloadBinaryStub = sinon.stub(binary.source, 'downloadBinary')
      fsWriteFileStub = sinon.stub(fs, 'writeFile')
    })

    afterEach(() => {
      downloadBinaryStub.restore()
      fsWriteFileStub.restore()
    })

    it('should call downloadBinary with the correct parameters', async () => {
      const destination = '/path/to/destination'

      await binary.download(destination)

      expect(downloadBinaryStub.calledOnce).to.be.true
      expect(downloadBinaryStub.calledWith('ffmpeg', '5.1', destination)).to.be.true
    })

    it('should write a version file for libraries', async () => {
      const binary = new Binary('libavcodec', 'library', 'FFMPEG_PATH', ['5.1'], ffbinaries)
      const destination = '/path/to/destination'
      const versionFilePath = path.join(destination, binary.fileName) + '.ver'

      await binary.download(destination)

      expect(downloadBinaryStub.calledOnce).to.be.true
      expect(downloadBinaryStub.calledWith('libavcodec', '5.1', destination)).to.be.true
      expect(fsWriteFileStub.calledOnce).to.be.true
      expect(fsWriteFileStub.calledWith(versionFilePath, '5.1')).to.be.true
    })
  })
})
