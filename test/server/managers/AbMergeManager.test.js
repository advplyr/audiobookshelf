const { expect } = require('chai')
const sinon = require('sinon')
const Path = require('path')
const os = require('os')
const fs = require('../../../server/libs/fsExtra')
const AbMergeManager = require('../../../server/managers/AbMergeManager')
const TaskManager = require('../../../server/managers/TaskManager')
const Task = require('../../../server/objects/Task')
const SocketAuthority = require('../../../server/SocketAuthority')
const ffmpegHelpers = require('../../../server/utils/ffmpegHelpers')

describe('AbMergeManager ffmpeg termination lifecycle', () => {
  let manager
  let task
  let tempDir
  let originalTasks
  let originalMetadataPath

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(Path.join(os.tmpdir(), 'audiobookshelf-ab-merge-'))
    originalMetadataPath = global.MetadataPath
    global.MetadataPath = tempDir
    manager = new AbMergeManager()
    task = new Task()
    task.setData('encode-m4b', { text: 'Encoding M4b' }, null, false, {
      libraryItemId: 'library-item-id',
      libraryItemDir: tempDir,
      originalTrackPaths: [Path.join(tempDir, 'input.m4b')],
      inos: ['ino'],
      tempFilepath: Path.join(tempDir, 'output.m4b'),
      targetFilepath: Path.join(tempDir, 'target.m4b'),
      itemCachePath: tempDir,
      ffmetadataObject: {},
      chapters: [],
      coverPath: null,
      ffmetadataPath: Path.join(tempDir, 'ffmetadata.txt'),
      duration: 60,
      encodeOptions: {}
    })
    originalTasks = TaskManager.tasks
    TaskManager.tasks = [task]
    sinon.stub(SocketAuthority, 'emitter')
  })

  afterEach(async () => {
    TaskManager.tasks = originalTasks
    global.MetadataPath = originalMetadataPath
    sinon.restore()
    await fs.remove(tempDir)
  })

  it('should mark explicit cancellation intent and finish task cleanup', async () => {
    const ffmpeg = { kill: sinon.spy() }
    task.data.ffmpeg = ffmpeg
    manager.pendingTasks.push({ id: task.id, task })

    await manager.cancelEncode(task)

    expect(ffmpeg.cancelRequested).to.be.true
    expect(ffmpeg.kill.calledOnce).to.be.true
    expect(task.isFailed).to.be.true
    expect(task.error).to.equal('Task canceled by user')
    expect(manager.pendingTasks).to.be.empty
    expect(TaskManager.tasks).to.be.empty
    expect(SocketAuthority.emitter.calledOnceWith('task_finished')).to.be.true
  })

  it('should fail and finish cleanup after an unexpected SIGKILL', async () => {
    const libraryItem = {
      id: 'library-item-id',
      media: {
        includedAudioFiles: [{ duration: 60 }]
      }
    }
    const taskFinished = new Promise((resolve) => {
      SocketAuthority.emitter.callsFake((event, finishedTask) => {
        if (event === 'task_finished') resolve(finishedTask)
      })
    })
    sinon.stub(ffmpegHelpers, 'writeFFMetadataFile').resolves(true)
    sinon.stub(ffmpegHelpers, 'mergeAudioFiles').rejects(new Error('ffmpeg was killed with signal SIGKILL'))

    await manager.runAudiobookMerge(libraryItem, task, {})
    const finishedTask = await taskFinished

    expect(task.isFailed).to.be.true
    expect(task.error).to.equal('Failed to merge audio files')
    expect(manager.pendingTasks).to.be.empty
    expect(TaskManager.tasks).to.be.empty
    expect(finishedTask.isFailed).to.be.true
    expect(SocketAuthority.emitter.calledOnceWith('task_finished')).to.be.true
  })
})
