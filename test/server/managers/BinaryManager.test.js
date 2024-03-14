const chai = require('chai')
const sinon = require('sinon')
const fs = require('../../../server/libs/fsExtra')
const fileUtils = require('../../../server/utils/fileUtils')
const which = require('../../../server/libs/which')
const ffbinaries = require('../../../server/libs/ffbinaries')
const path = require('path')
const BinaryManager = require('../../../server/managers/BinaryManager')

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
      const missingBinaries = ['ffmpeg', 'ffprobe']
      const missingBinariesAfterInstall = []
      findStub.onFirstCall().resolves(missingBinaries)
      findStub.onSecondCall().resolves(missingBinariesAfterInstall)

      await binaryManager.init()

      expect(findStub.calledTwice).to.be.true
      expect(installStub.calledOnce).to.be.true
      expect(removeOldBinariesStub.calledOnce).to.be.true
      expect(errorStub.called).to.be.false
      expect(exitStub.called).to.be.false
    })

    it('exit if binaries are not found after installation', async () => {
      const missingBinaries = ['ffmpeg', 'ffprobe']
      const missingBinariesAfterInstall = ['ffmpeg', 'ffprobe']
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
  })

  
  describe('findRequiredBinaries', () => {
    let findBinaryStub

    beforeEach(() => {
      const requiredBinaries = [{ name: 'ffmpeg', envVariable: 'FFMPEG_PATH' }]
      binaryManager = new BinaryManager(requiredBinaries)
      findBinaryStub = sinon.stub(binaryManager, 'findBinary')
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
      const missingBinaries = ['ffmpeg']
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
    let downloadBinariesStub

    beforeEach(() => {
      binaryManager = new BinaryManager()
      isWritableStub = sinon.stub(fileUtils, 'isWritable')
      downloadBinariesStub = sinon.stub(ffbinaries, 'downloadBinaries')
      binaryManager.mainInstallPath = '/path/to/main/install'
      binaryManager.altInstallPath = '/path/to/alt/install'
    })

    afterEach(() => {
      isWritableStub.restore()
      downloadBinariesStub.restore()
    })

    it('should not install binaries if no binaries are passed', async () => {
      const binaries = []

      await binaryManager.install(binaries)

      expect(isWritableStub.called).to.be.false
      expect(downloadBinariesStub.called).to.be.false
    })

    it('should install binaries in main install path if has access', async () => {
      const binaries = ['ffmpeg']
      const destination = binaryManager.mainInstallPath
      isWritableStub.withArgs(destination).resolves(true)
      downloadBinariesStub.resolves()
      
      await binaryManager.install(binaries)

      expect(isWritableStub.calledOnce).to.be.true
      expect(downloadBinariesStub.calledOnce).to.be.true
      expect(downloadBinariesStub.calledWith(binaries, sinon.match({ destination: destination }))).to.be.true  
    })

    it('should install binaries in alt install path if has no access to main', async () => {
      const binaries = ['ffmpeg']
      const mainDestination = binaryManager.mainInstallPath
      const destination = binaryManager.altInstallPath
      isWritableStub.withArgs(mainDestination).resolves(false)
      downloadBinariesStub.resolves()
      
      await binaryManager.install(binaries)

      expect(isWritableStub.calledOnce).to.be.true
      expect(downloadBinariesStub.calledOnce).to.be.true
      expect(downloadBinariesStub.calledWith(binaries, sinon.match({ destination: destination }))).to.be.true  
    })
  })
})

describe('findBinary', () => {
  let binaryManager
  let isBinaryGoodStub
  let whichSyncStub
  let mainInstallPath
  let altInstallPath

  const name = 'ffmpeg'
  const envVariable = 'FFMPEG_PATH'
  const defaultPath = '/path/to/ffmpeg'
  const executable = name + (process.platform == 'win32' ? '.exe' : '')
  const whichPath = '/usr/bin/ffmpeg'


  beforeEach(() => {
    binaryManager = new BinaryManager()
    isBinaryGoodStub = sinon.stub(binaryManager, 'isBinaryGood')
    whichSyncStub = sinon.stub(which, 'sync')
    binaryManager.mainInstallPath = '/path/to/main/install'
    mainInstallPath = path.join(binaryManager.mainInstallPath, executable)
    binaryManager.altInstallPath = '/path/to/alt/install'
    altInstallPath = path.join(binaryManager.altInstallPath, executable)
  })

  afterEach(() => {
    isBinaryGoodStub.restore()
    whichSyncStub.restore()
  })
  
  it('should return the defaultPath if it exists and is a good binary', async () => {
    process.env[envVariable] = defaultPath
    isBinaryGoodStub.withArgs(defaultPath).resolves(true)
  
    const result = await binaryManager.findBinary(name, envVariable)
  
    expect(result).to.equal(defaultPath)    
    expect(isBinaryGoodStub.calledOnce).to.be.true
    expect(isBinaryGoodStub.calledWith(defaultPath)).to.be.true
  })
  
  it('should return the whichPath if it exists and is a good binary', async () => {
    delete process.env[envVariable]
    isBinaryGoodStub.withArgs(undefined).resolves(false)
    isBinaryGoodStub.withArgs(whichPath).resolves(true)
    whichSyncStub.returns(whichPath)
  
    const result = await binaryManager.findBinary(name, envVariable)
  
    expect(result).to.equal(whichPath)
    expect(isBinaryGoodStub.calledTwice).to.be.true
    expect(isBinaryGoodStub.calledWith(undefined)).to.be.true
    expect(isBinaryGoodStub.calledWith(whichPath)).to.be.true
  })
  
  it('should return the mainInstallPath if it exists and is a good binary', async () => {
    delete process.env[envVariable]
    isBinaryGoodStub.withArgs(undefined).resolves(false)
    isBinaryGoodStub.withArgs(null).resolves(false)
    isBinaryGoodStub.withArgs(mainInstallPath).resolves(true)
    whichSyncStub.returns(null)
  
    const result = await binaryManager.findBinary(name, envVariable)
  
    expect(result).to.equal(mainInstallPath)
    expect(isBinaryGoodStub.callCount).to.be.equal(3)
    expect(isBinaryGoodStub.calledWith(undefined)).to.be.true
    expect(isBinaryGoodStub.calledWith(null)).to.be.true
    expect(isBinaryGoodStub.calledWith(mainInstallPath)).to.be.true
  })
  
  it('should return the altInstallPath if it exists and is a good binary', async () => {
    delete process.env[envVariable]
    isBinaryGoodStub.withArgs(undefined).resolves(false)
    isBinaryGoodStub.withArgs(null).resolves(false)
    isBinaryGoodStub.withArgs(mainInstallPath).resolves(false)
    isBinaryGoodStub.withArgs(altInstallPath).resolves(true)
    whichSyncStub.returns(null)
  
    const result = await binaryManager.findBinary(name, envVariable)
  
    expect(result).to.equal(altInstallPath)
    expect(isBinaryGoodStub.callCount).to.be.equal(4)
    expect(isBinaryGoodStub.calledWith(undefined)).to.be.true
    expect(isBinaryGoodStub.calledWith(null)).to.be.true
    expect(isBinaryGoodStub.calledWith(mainInstallPath)).to.be.true
    expect(isBinaryGoodStub.calledWith(altInstallPath)).to.be.true
  })
  
  it('should return null if no good binary is found', async () => {
    delete process.env[envVariable]
    isBinaryGoodStub.withArgs(undefined).resolves(false)
    isBinaryGoodStub.withArgs(null).resolves(false)
    isBinaryGoodStub.withArgs(mainInstallPath).resolves(false)
    isBinaryGoodStub.withArgs(altInstallPath).resolves(false)
    whichSyncStub.returns(null)
  
    const result = await binaryManager.findBinary(name, envVariable)
  
    expect(result).to.be.null
    expect(isBinaryGoodStub.callCount).to.be.equal(4)
    expect(isBinaryGoodStub.calledWith(undefined)).to.be.true
    expect(isBinaryGoodStub.calledWith(null)).to.be.true
    expect(isBinaryGoodStub.calledWith(mainInstallPath)).to.be.true
    expect(isBinaryGoodStub.calledWith(altInstallPath)).to.be.true
  })  
})

describe('isBinaryGood', () => {
  let binaryManager
  let fsPathExistsStub
  let execStub
  let loggerInfoStub
  let loggerErrorStub

  const binaryPath = '/path/to/binary'
  const execCommand = '"' + binaryPath + '"' + ' -version'
  const goodVersions = ['5.1', '6']

  beforeEach(() => {
    binaryManager = new BinaryManager()
    fsPathExistsStub = sinon.stub(fs, 'pathExists')
    execStub = sinon.stub(binaryManager, 'exec')
  })

  afterEach(() => {
    fsPathExistsStub.restore()
    execStub.restore()
  })

  it('should return false if binaryPath is falsy', async () => {
    fsPathExistsStub.resolves(true)

    const result = await binaryManager.isBinaryGood(null, goodVersions)

    expect(result).to.be.false
    expect(fsPathExistsStub.called).to.be.false
    expect(execStub.called).to.be.false
  })

  it('should return false if binaryPath does not exist', async () => {
    fsPathExistsStub.resolves(false)

    const result = await binaryManager.isBinaryGood(binaryPath, goodVersions)

    expect(result).to.be.false
    expect(fsPathExistsStub.calledOnce).to.be.true
    expect(fsPathExistsStub.calledWith(binaryPath)).to.be.true
    expect(execStub.called).to.be.false
  })

  it('should return false if failed to check version of binary', async () => {
    fsPathExistsStub.resolves(true)
    execStub.rejects(new Error('Failed to execute command'))

    const result = await binaryManager.isBinaryGood(binaryPath, goodVersions)

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

    const result = await binaryManager.isBinaryGood(binaryPath, goodVersions)

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

    const result = await binaryManager.isBinaryGood(binaryPath, goodVersions)

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

    const result = await binaryManager.isBinaryGood(binaryPath, goodVersions)

    expect(result).to.be.true
    expect(fsPathExistsStub.calledOnce).to.be.true
    expect(fsPathExistsStub.calledWith(binaryPath)).to.be.true
    expect(execStub.calledOnce).to.be.true
    expect(execStub.calledWith(execCommand)).to.be.true
  })
})