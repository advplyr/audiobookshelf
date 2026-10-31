const { expect } = require('chai')
const sinon = require('sinon')
const Manager = require('../../../server/managers/AbMergeManager')
const Task = require('../../../server/objects/Task')
const TaskManager = require('../../../server/managers/TaskManager')
const SocketAuthority = require('../../../server/SocketAuthority')
const nodeFs = require('fs')
const Path = require('path')
const os = require('os')
const ffmpeg = require('../../../server/utils/ffmpegHelpers')
const fs = require('../../../server/libs/fsExtra')

describe('AbMergeManager compatibility', () => {
  let metadata, manager, temporary
  beforeEach(() => { metadata = global.MetadataPath; temporary = nodeFs.mkdtempSync(Path.join(os.tmpdir(), 'abs-phase5-merge-')); global.MetadataPath = temporary; manager = new Manager(); sinon.stub(TaskManager, 'taskFinished'); sinon.stub(SocketAuthority, 'adminEmitter') })
  afterEach(() => { sinon.restore(); global.MetadataPath = metadata; nodeFs.rmSync(temporary, { recursive: true, force: true }) })
  const task = () => { const current = new Task(); current.setData('merge', { text: 'Merge' }, null, false, { libraryItemId: 'item', libraryItemDir: temporary, ffmetadataObject: {}, chapters: [], ffmetadataPath: '/temporary/ffmetadata', tempFilepath: '/temporary/temp', inos: ['ino'], duration: 10, itemCachePath: '/temporary/cache' }); return current }
  const item = { id: 'item', media: { includedAudioFiles: [{ duration: 10 }] } }
  it('keeps pending-task wrapper lookup and fails an unwritable target', async () => {
    const current = task(), pending = { id: current.id, task: current }
    manager.pendingTasks = [pending]
    expect(manager.getPendingTaskByLibraryItemId('item')).to.equal(pending)
    current.data.libraryItemDir = Path.join(temporary, 'missing')
    const remove = sinon.stub(manager, 'removeTask').resolves()
    await manager.runAudiobookMerge(item, current, {})
    expect(current.isFailed).to.equal(true)
    expect(remove.calledOnceWithExactly(current, true)).to.equal(true)
  })
  it('marks merge failures and requests cleanup', async () => {
    sinon.stub(ffmpeg, 'writeFFMetadataFile').resolves(true)
    sinon.stub(ffmpeg, 'mergeAudioFiles').rejects(new Error('failed'))
    const remove = sinon.stub(manager, 'removeTask').resolves(), current = task()
    await manager.runAudiobookMerge(item, current, {})
    expect(current.isFailed).to.equal(true)
    expect(current.error).to.equal('Failed to merge audio files')
    expect(remove.calledOnceWithExactly(current, true)).to.equal(true)
  })
  it('cancels, waits for the process unlock and then cleans temporary files', async () => {
    const clock = sinon.useFakeTimers(), current = task(), kill = sinon.spy()
    current.data.ffmpeg = { kill }
    manager.pendingTasks = [{ id: current.id, task: current }]
    sinon.stub(fs, 'pathExists').resolves(true)
    const remove = sinon.stub(fs, 'remove').resolves()
    const pending = manager.cancelEncode(current)
    expect(kill.calledOnce).to.equal(true)
    expect(remove.called).to.equal(false)
    await clock.tickAsync(500)
    await pending
    expect(remove.callCount).to.equal(2)
    expect(manager.pendingTasks).to.deep.equal([])
    expect(current.error).to.equal('Task canceled by user')
    expect(TaskManager.taskFinished.calledOnceWithExactly(current)).to.equal(true)
  })
})
