const chai = require('chai')
const sinon = require('sinon')
const fs = require('../../../server/libs/fsExtra')
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
    let errorStub
    let exitStub

    beforeEach(() => {
      binaryManager = new BinaryManager()
      findStub = sinon.stub(binaryManager, 'findRequiredBinaries')
      installStub = sinon.stub(binaryManager, 'install')
      errorStub = sinon.stub(console, 'error')
      exitStub = sinon.stub(process, 'exit')
    })

    afterEach(() => {
      findStub.restore()
      installStub.restore()
      errorStub.restore()
      exitStub.restore()
    })

    it('should not install binaries if they are already found', async () => {
      findStub.resolves([])
      
      await binaryManager.init()

      expect(installStub.called).to.be.false
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
    let accessStub
    let downloadBinariesStub

    beforeEach(() => {
      binaryManager = new BinaryManager()
      accessStub = sinon.stub(fs, 'access')
      downloadBinariesStub = sinon.stub(ffbinaries, 'downloadBinaries')
      binaryManager.mainInstallPath = '/path/to/main/install'
      binaryManager.altInstallPath = '/path/to/alt/install'
    })

    afterEach(() => {
      accessStub.restore()
      downloadBinariesStub.restore()
    })

    it('should not install binaries if no binaries are passed', async () => {
      const binaries = []

      await binaryManager.install(binaries)

      expect(accessStub.called).to.be.false
      expect(downloadBinariesStub.called).to.be.false
    })

    it('should install binaries in main install path if has access', async () => {
      const binaries = ['ffmpeg']
      const destination = binaryManager.mainInstallPath
      accessStub.withArgs(destination, fs.constants.W_OK).resolves()
      downloadBinariesStub.resolves()
      
      await binaryManager.install(binaries)

      expect(accessStub.calledOnce).to.be.true
      expect(downloadBinariesStub.calledOnce).to.be.true
      expect(downloadBinariesStub.calledWith(binaries, sinon.match({ destination: destination }))).to.be.true  
    })

    it('should install binaries in alt install path if has no access to main', async () => {
      const binaries = ['ffmpeg']
      const mainDestination = binaryManager.mainInstallPath
      const destination = binaryManager.altInstallPath
      accessStub.withArgs(mainDestination, fs.constants.W_OK).rejects()
      downloadBinariesStub.resolves()
      
      await binaryManager.install(binaries)

      expect(accessStub.calledOnce).to.be.true
      expect(downloadBinariesStub.calledOnce).to.be.true
      expect(downloadBinariesStub.calledWith(binaries, sinon.match({ destination: destination }))).to.be.true  
    })
  })
})

describe('findBinary', () => {
  let binaryManager
  let fsPathExistsStub
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
    fsPathExistsStub = sinon.stub(fs, 'pathExists')
    whichSyncStub = sinon.stub(which, 'sync')
    binaryManager.mainInstallPath = '/path/to/main/install'
    mainInstallPath = path.join(binaryManager.mainInstallPath, executable)
    binaryManager.altInstallPath = '/path/to/alt/install'
    altInstallPath = path.join(binaryManager.altInstallPath, executable)
  })

  afterEach(() => {
    fsPathExistsStub.restore()
    whichSyncStub.restore()
  })

  it('should return defaultPath if it exists', async () => {
    process.env[envVariable] = defaultPath
    fsPathExistsStub.withArgs(defaultPath).resolves(true)

    const result = await binaryManager.findBinary(name, envVariable)

    expect(result).to.equal(defaultPath)
    expect(fsPathExistsStub.calledOnceWith(defaultPath)).to.be.true
    expect(whichSyncStub.notCalled).to.be.true
  })

  it('should return whichPath if it exists', async () => {
    delete process.env[envVariable]
    whichSyncStub.returns(whichPath)

    const result = await binaryManager.findBinary(name, envVariable)

    expect(result).to.equal(whichPath)
    expect(fsPathExistsStub.notCalled).to.be.true
    expect(whichSyncStub.calledOnce).to.be.true
  })

  it('should return mainInstallPath if it exists', async () => {
    delete process.env[envVariable]
    whichSyncStub.returns(null)
    fsPathExistsStub.withArgs(mainInstallPath).resolves(true)

    const result = await binaryManager.findBinary(name, envVariable)

    expect(result).to.equal(mainInstallPath)
    expect(whichSyncStub.calledOnce).to.be.true
    expect(fsPathExistsStub.calledOnceWith(mainInstallPath)).to.be.true
  })

  it('should return altInstallPath if it exists', async () => {
    delete process.env[envVariable]
    whichSyncStub.returns(null)
    fsPathExistsStub.withArgs(mainInstallPath).resolves(false)
    fsPathExistsStub.withArgs(altInstallPath).resolves(true)

    const result = await binaryManager.findBinary(name, envVariable)

    expect(result).to.equal(altInstallPath)
    expect(whichSyncStub.calledOnce).to.be.true
    expect(fsPathExistsStub.calledTwice).to.be.true
    expect(fsPathExistsStub.calledWith(mainInstallPath)).to.be.true
    expect(fsPathExistsStub.calledWith(altInstallPath)).to.be.true
  })

  it('should return null if binary is not found', async () => {
    delete process.env[envVariable]
    whichSyncStub.returns(null)
    fsPathExistsStub.withArgs(mainInstallPath).resolves(false)
    fsPathExistsStub.withArgs(altInstallPath).resolves(false)

    const result = await binaryManager.findBinary(name, envVariable)

    expect(result).to.be.null
    expect(whichSyncStub.calledOnce).to.be.true
    expect(fsPathExistsStub.calledTwice).to.be.true
    expect(fsPathExistsStub.calledWith(mainInstallPath)).to.be.true
    expect(fsPathExistsStub.calledWith(altInstallPath)).to.be.true
  })
})