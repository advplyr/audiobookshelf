const { expect } = require('chai')
const sinon = require('sinon')

const Watcher = require('../../server/Watcher')
const Logger = require('../../server/Logger')
const TaskManager = require('../../server/managers/TaskManager')

describe('Watcher', () => {
  beforeEach(() => {
    sinon.stub(Logger, 'debug')
    sinon.stub(TaskManager, 'createAndAddTask').returns({})
    sinon.stub(Watcher, 'handlePendingFileUpdatesTimeout')

    Watcher.libraryWatchers = [{ id: 'lib1', name: 'Test Library', libraryFolders: [{ id: 'folder1', path: '/lib' }] }]
  })

  afterEach(() => {
    sinon.restore()
    Watcher.libraryWatchers = []
    Watcher.pendingFileUpdates = []
    Watcher.pendingTask = null
    Watcher.ignoreDirs = []
  })

  describe('onFileRename', () => {
    it('queues the new path and the old path', () => {
      Watcher.onFileRename('lib1', '/lib/Old/01.mp3', '/lib/New/01.mp3')

      expect(Watcher.pendingFileUpdates.map((fu) => ({ path: fu.path, relPath: fu.relPath, folderId: fu.folderId, type: fu.type }))).to.deep.equal([
        { path: '/lib/New/01.mp3', relPath: '/New/01.mp3', folderId: 'folder1', type: 'renamed' },
        { path: '/lib/Old/01.mp3', relPath: '/Old/01.mp3', folderId: 'folder1', type: 'deleted' }
      ])
    })

    it('does not queue the old path when it is in an ignored dir', () => {
      Watcher.ignoreDirs = ['/lib/Old']
      Watcher.onFileRename('lib1', '/lib/Old/01.mp3', '/lib/New/01.mp3')

      expect(Watcher.pendingFileUpdates.map((fu) => fu.path)).to.deep.equal(['/lib/New/01.mp3'])
    })

    it('queues nothing when the new path is in an ignored dir', () => {
      Watcher.ignoreDirs = ['/lib/New']
      Watcher.onFileRename('lib1', '/lib/Old/01.mp3', '/lib/New/01.mp3')

      expect(Watcher.pendingFileUpdates).to.have.lengthOf(0)
    })
  })
})
