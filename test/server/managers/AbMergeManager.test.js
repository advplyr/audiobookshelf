const { expect } = require('chai')
const sinon = require('sinon')
const os = require('os')
const Path = require('path')
const fs = require('../../../server/libs/fsExtra')

const Logger = require('../../../server/Logger')
const Task = require('../../../server/objects/Task')
const TaskManager = require('../../../server/managers/TaskManager')
const SocketAuthority = require('../../../server/SocketAuthority')
const ffmpegHelpers = require('../../../server/utils/ffmpegHelpers')
const LibraryItemScanner = require('../../../server/scanner/LibraryItemScanner')
const AbMergeManager = require('../../../server/managers/AbMergeManager')

describe('AbMergeManager', () => {
  let tempDir
  let itemDir
  let manager
  let scanStub
  let originalMetadataPath

  /**
   * Library item with a single audio file in the item folder
   */
  function buildLibraryItem(filename, isFile = false) {
    const trackPath = Path.join(itemDir, filename)
    return {
      id: 'li_1',
      isFile,
      path: isFile ? trackPath : itemDir,
      media: {
        title: 'Test Book',
        includedAudioFiles: [{ ino: '1', duration: 10, metadata: { path: trackPath } }]
      }
    }
  }

  function buildTask(libraryItem) {
    const itemCachePath = Path.join(manager.itemsCacheDir, libraryItem.id)
    const task = new Task()
    task.setData('encode-m4b', { text: 'Encoding M4b' }, { text: 'Encoding' }, false, {
      libraryItemId: libraryItem.id,
      libraryItemDir: itemDir,
      originalTrackPaths: libraryItem.media.includedAudioFiles.map((t) => t.metadata.path),
      inos: libraryItem.media.includedAudioFiles.map((f) => f.ino),
      tempFilepath: Path.join(itemCachePath, 'Test Book.m4b'),
      targetFilename: 'Test Book.m4b',
      targetFilepath: Path.join(itemDir, 'Test Book.m4b'),
      itemCachePath,
      ffmetadataPath: Path.join(itemCachePath, 'ffmetadata.txt'),
      duration: 10
    })
    return task
  }

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-merge-'))
    itemDir = Path.join(tempDir, 'library', 'Test Book')
    await fs.ensureDir(itemDir)

    originalMetadataPath = global.MetadataPath
    global.MetadataPath = Path.join(tempDir, 'metadata')
    manager = new AbMergeManager()
    await fs.ensureDir(Path.join(manager.itemsCacheDir, 'li_1'))

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'error')
    sinon.stub(TaskManager, 'taskFinished')
    sinon.stub(SocketAuthority, 'adminEmitter')
    sinon.stub(ffmpegHelpers, 'writeFFMetadataFile').resolves(true)
    // Stand in for ffmpeg by writing the encoded file to the temp path
    sinon.stub(ffmpegHelpers, 'mergeAudioFiles').callsFake(async (audioFiles, duration, itemCachePath, tempFilepath) => {
      await fs.writeFile(tempFilepath, 'encoded')
    })
    sinon.stub(ffmpegHelpers, 'addCoverAndMetadataToFile').resolves()
    scanStub = sinon.stub(LibraryItemScanner, 'scanLibraryItem').resolves()
  })

  afterEach(async () => {
    sinon.restore()
    global.MetadataPath = originalMetadataPath
    await fs.remove(tempDir)
  })

  describe('runAudiobookMerge', () => {
    it('should rescan the library item when the m4b keeps its filename', async () => {
      const libraryItem = buildLibraryItem('Test Book.m4b')
      const task = buildTask(libraryItem)
      await fs.writeFile(task.data.targetFilepath, 'original')

      await manager.runAudiobookMerge(libraryItem, task, {})

      expect(await fs.readFile(task.data.targetFilepath, 'utf8')).to.equal('encoded')
      expect(scanStub.calledOnceWithExactly('li_1')).to.be.true
      expect(task.isFinished).to.be.true
      expect(task.isFailed).to.be.false
    })

    it('should finish the task when the rescan fails', async () => {
      scanStub.rejects(new Error('scan failed'))
      const libraryItem = buildLibraryItem('Test Book.m4b')
      const task = buildTask(libraryItem)
      await fs.writeFile(task.data.targetFilepath, 'original')

      await manager.runAudiobookMerge(libraryItem, task, {})

      expect(scanStub.calledOnce).to.be.true
      expect(task.isFinished).to.be.true
      expect(task.isFailed).to.be.false
    })

    it('should not rescan a single file library item', async () => {
      const libraryItem = buildLibraryItem('Test Book.m4b', true)
      const task = buildTask(libraryItem)
      await fs.writeFile(task.data.targetFilepath, 'original')

      await manager.runAudiobookMerge(libraryItem, task, {})

      expect(scanStub.called).to.be.false
      expect(task.isFinished).to.be.true
    })
  })
})
