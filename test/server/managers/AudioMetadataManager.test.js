const { expect } = require('chai')
const sinon = require('sinon')
const Manager = require('../../../server/managers/AudioMetadataManager')
const Task = require('../../../server/objects/Task')
const TaskManager = require('../../../server/managers/TaskManager')
const SocketAuthority = require('../../../server/SocketAuthority')
const fileUtils = require('../../../server/utils/fileUtils')
const ffmpeg = require('../../../server/utils/ffmpegHelpers')
const fs = require('../../../server/libs/fsExtra')

describe('AudioMetadataManager compatibility', () => {
  let metadata, tasks, manager
  beforeEach(() => { metadata = global.MetadataPath; global.MetadataPath = '/temporary'; tasks = TaskManager.tasks; TaskManager.tasks = []; manager = new Manager(); sinon.stub(SocketAuthority, 'adminEmitter'); sinon.stub(SocketAuthority, 'emitter') })
  afterEach(() => { sinon.restore(); global.MetadataPath = metadata; TaskManager.tasks = tasks })
  const item = () => ({ id: 'item', path: '/temporary/book', media: { title: 'Title', duration: 10, chapters: [], includedAudioFiles: [{ index: 1, ino: 'ino', duration: 10, mimeType: 'audio/mp4', metadata: { filename: 'book.m4b', path: '/temporary/book/book.m4b' } }] } })
  const task = () => { const task = new Task(); task.setData('embed', { text: 'Embed' }, null, false, { libraryItemId: 'item', libraryItemDir: '/temporary', itemCachePath: '/temporary/cache', metadataObject: {}, chapters: [], coverPath: null, mimeType: 'audio/mp4', duration: 10, options: { backupFiles: false }, audioFiles: [{ index: 1, ino: 'ino', filename: 'book.m4b', path: '/temporary/book.m4b', duration: 10 }] }); return task }
  it('queues at the concurrency limit and preserves metadata payload', async () => {
    manager.tasksRunning = [task()]
    const run = sinon.stub(manager, 'runMetadataEmbed').resolves()
    await manager.updateMetadataForItem('user', item(), { backup: true })
    expect(run.called).to.equal(false)
    expect(manager.getQueuedTaskData()[0]).to.include({ libraryItemId: 'item', userId: 'user', duration: 10 })
    expect(manager.getIsLibraryItemQueuedOrProcessing('item')).to.equal(true)
    expect(manager.tasksQueued[0].data.options).to.deep.equal({ forceEmbedChapters: false, backupFiles: true })
  })
  it('fails unwritable target and dequeues the next task after removing the running task', async () => {
    sinon.stub(fileUtils, 'isWritable').resolves(false)
    const first = task(), second = task()
    manager.tasksQueued = [second]
    const original = manager.runMetadataEmbed.bind(manager), run = sinon.stub(manager, 'runMetadataEmbed').resolves()
    await original(first)
    expect(first.isFailed).to.equal(true)
    expect(manager.tasksRunning).to.deep.equal([])
    expect(run.calledOnceWithExactly(second)).to.equal(true)
    expect(manager.tasksQueued).to.deep.equal([])
  })
  it('reports track/progress events, marks completion and cleans only the metadata file for an existing cache', async () => {
    sinon.stub(fileUtils, 'isWritable').resolves(true)
    sinon.stub(fs, 'access').resolves()
    sinon.stub(fs, 'pathExists').resolves(true)
    const remove = sinon.stub(fs, 'remove').resolves()
    sinon.stub(ffmpeg, 'writeFFMetadataFile').resolves(true)
    sinon.stub(ffmpeg, 'addCoverAndMetadataToFile').callsFake(async (...args) => args[5](50))
    const current = task()
    await manager.runMetadataEmbed(current)
    expect(current.isFinished).to.equal(true)
    expect(manager.tasksRunning).to.deep.equal([])
    expect(SocketAuthority.adminEmitter.calledWith('track_started')).to.equal(true)
    expect(SocketAuthority.adminEmitter.calledWith('track_progress', { libraryItemId: 'item', ino: 'ino', progress: 50 })).to.equal(true)
    expect(remove.firstCall.args[0]).to.include('ffmetadata.txt')
  })
  it('preserves the rejection for an item with no audio files', async () => {
    const empty = item(); empty.media.includedAudioFiles = []
    expect(await manager.updateMetadataForItem('user', empty).catch(e => e)).to.be.instanceOf(TypeError)
  })
})
