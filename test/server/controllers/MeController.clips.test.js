const { expect } = require('chai')
const sinon = require('sinon')
const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')
const MeController = require('../../../server/controllers/MeController')
const Logger = require('../../../server/Logger')
const SocketAuthority = require('../../../server/SocketAuthority')

describe('MeController Clips Endpoints', () => {
  let loggerStub
  let socketEmitStub

  beforeEach(async () => {
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    await Database.buildModels()

    loggerStub = {
      info: sinon.stub(Logger, 'info'),
      error: sinon.stub(Logger, 'error'),
      warn: sinon.stub(Logger, 'warn')
    }
    socketEmitStub = sinon.stub(SocketAuthority, 'clientEmitter')
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('getClips', () => {
    it('should return all clips for authenticated user', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()

      await Database.audioClipModel.createClip(user.id, libraryItem.id, 10, 20, 'Clip 1')
      await Database.audioClipModel.createClip(user.id, libraryItem.id, 30, 40, 'Clip 2')

      const req = { user }
      const res = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.getClips(req, res)

      expect(res.json.calledOnce).to.be.true
      const response = res.json.firstCall.args[0]
      expect(response.clips).to.have.lengthOf(2)
      expect(response.clips[0]).to.have.property('title')
      expect(response.clips[0]).to.have.property('startTime')
      expect(response.clips[0]).to.have.property('endTime')
    })

    it('should handle errors gracefully', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      // Simulate database error
      sinon.stub(Database.audioClipModel, 'getClipsForUser').rejects(new Error('Database error'))

      const req = { user }
      const res = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.getClips(req, res)

      expect(res.status.calledWith(500)).to.be.true
      expect(res.send.calledWith('Failed to get clips')).to.be.true
    })
  })

  describe('getItemClips', () => {
    it('should return clips for a specific library item', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()

      await Database.audioClipModel.createClip(user.id, libraryItem.id, 10, 20, 'Clip 1')
      await Database.audioClipModel.createClip(user.id, libraryItem.id, 30, 40, 'Clip 2')

      const req = {
        user,
        params: { id: libraryItem.id },
        query: {}
      }
      const res = {
        json: sinon.spy(),
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.getItemClips(req, res)

      expect(res.json.calledOnce).to.be.true
      const response = res.json.firstCall.args[0]
      expect(response.clips).to.have.lengthOf(2)
    })

    it('should return 404 for non-existent library item', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const req = {
        user,
        params: { id: 'nonexistent-id' },
        query: {}
      }
      const res = {
        sendStatus: sinon.spy()
      }

      await MeController.getItemClips(req, res)

      expect(res.sendStatus.calledWith(404)).to.be.true
    })

    it('should filter by episodeId when provided', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()

      await Database.audioClipModel.createClip(user.id, libraryItem.id, 10, 20, 'Clip 1', null, 'episode1')
      await Database.audioClipModel.createClip(user.id, libraryItem.id, 30, 40, 'Clip 2', null, 'episode2')

      const req = {
        user,
        params: { id: libraryItem.id },
        query: { episodeId: 'episode1' }
      }
      const res = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.getItemClips(req, res)

      const response = res.json.firstCall.args[0]
      expect(response.clips).to.have.lengthOf(1)
      expect(response.clips[0].episodeId).to.equal('episode1')
    })

    it('should only return clips for the authenticated user', async () => {
      const user1 = await Database.userModel.create({
        username: 'user1',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const user2 = await Database.userModel.create({
        username: 'user2',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()

      // User 1 creates clips
      await Database.audioClipModel.createClip(user1.id, libraryItem.id, 10, 20, 'User 1 Clip 1')
      await Database.audioClipModel.createClip(user1.id, libraryItem.id, 30, 40, 'User 1 Clip 2')

      // User 2 creates clips
      await Database.audioClipModel.createClip(user2.id, libraryItem.id, 50, 60, 'User 2 Clip 1')

      // User 1 requests clips - should only get their own
      const req1 = {
        user: user1,
        params: { id: libraryItem.id },
        query: {}
      }
      const res1 = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.getItemClips(req1, res1)

      const response1 = res1.json.firstCall.args[0]
      expect(response1.clips).to.have.lengthOf(2)
      expect(response1.clips.every(c => c.userId === user1.id)).to.be.true
      expect(response1.clips.some(c => c.title.includes('User 2'))).to.be.false

      // User 2 requests clips - should only get their own
      const req2 = {
        user: user2,
        params: { id: libraryItem.id },
        query: {}
      }
      const res2 = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.getItemClips(req2, res2)

      const response2 = res2.json.firstCall.args[0]
      expect(response2.clips).to.have.lengthOf(1)
      expect(response2.clips[0].userId).to.equal(user2.id)
      expect(response2.clips.some(c => c.title.includes('User 1'))).to.be.false
    })

    it('should handle errors gracefully', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()

      // Simulate database error
      sinon.stub(Database.audioClipModel, 'getClipsForItem').rejects(new Error('Database error'))

      const req = {
        user,
        params: { id: libraryItem.id },
        query: {}
      }
      const res = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.getItemClips(req, res)

      expect(res.status.calledWith(500)).to.be.true
      expect(res.send.calledWith('Failed to get clips')).to.be.true
    })
  })

  describe('createClip', () => {
    it('should create a new clip', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()

      const req = {
        user,
        params: { id: libraryItem.id },
        body: {
          startTime: 10,
          endTime: 20,
          title: 'Test Clip',
          note: 'Test note'
        }
      }
      const res = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.createClip(req, res)

      expect(res.json.calledOnce).to.be.true
      const clip = res.json.firstCall.args[0]
      expect(clip.title).to.equal('Test Clip')
      expect(clip.startTime).to.equal(10)
      expect(clip.endTime).to.equal(20)
      expect(clip.note).to.equal('Test note')
      expect(socketEmitStub.calledWith(user.id, 'clip_created')).to.be.true
    })

    it('should return 404 for non-existent library item', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const req = {
        user,
        params: { id: 'nonexistent-id' },
        body: {
          startTime: 10,
          endTime: 20,
          title: 'Test'
        }
      }
      const res = {
        sendStatus: sinon.spy()
      }

      await MeController.createClip(req, res)

      expect(res.sendStatus.calledWith(404)).to.be.true
    })

    it('should validate startTime', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()

      const req = {
        user,
        params: { id: libraryItem.id },
        body: {
          startTime: 'invalid',
          endTime: 20,
          title: 'Test'
        }
      }
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.createClip(req, res)

      expect(res.status.calledWith(400)).to.be.true
      expect(res.send.calledWith('Invalid start time')).to.be.true
    })

    it('should validate endTime', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()

      const req = {
        user,
        params: { id: libraryItem.id },
        body: {
          startTime: 10,
          endTime: null,
          title: 'Test'
        }
      }
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.createClip(req, res)

      expect(res.status.calledWith(400)).to.be.true
      expect(res.send.calledWith('Invalid end time')).to.be.true
    })

    it('should validate title', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()

      const req = {
        user,
        params: { id: libraryItem.id },
        body: {
          startTime: 10,
          endTime: 20,
          title: null
        }
      }
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.createClip(req, res)

      expect(res.status.calledWith(400)).to.be.true
      expect(res.send.calledWith('Invalid title')).to.be.true
    })

    it('should handle errors gracefully', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()

      // Simulate database error with custom message
      sinon.stub(Database.audioClipModel, 'createClip').rejects(new Error('Time range invalid'))

      const req = {
        user,
        params: { id: libraryItem.id },
        body: {
          startTime: 10,
          endTime: 20,
          title: 'Test'
        }
      }
      const res = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.createClip(req, res)

      expect(res.status.calledWith(400)).to.be.true
      expect(res.send.calledWith('Time range invalid')).to.be.true
    })
  })

  describe('updateClip', () => {
    it('should update an existing clip', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()
      const clip = await Database.audioClipModel.createClip(user.id, libraryItem.id, 10, 20, 'Original Title')

      const req = {
        user,
        params: { clipId: clip.id },
        body: {
          title: 'Updated Title',
          note: 'Updated note'
        }
      }
      const res = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.updateClip(req, res)

      expect(res.json.calledOnce).to.be.true
      const updatedClip = res.json.firstCall.args[0]
      expect(updatedClip.title).to.equal('Updated Title')
      expect(updatedClip.note).to.equal('Updated note')
      expect(socketEmitStub.calledWith(user.id, 'clip_updated')).to.be.true
    })

    it('should return 404 for non-existent clip', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const req = {
        user,
        params: { clipId: 'nonexistent-id' },
        body: { title: 'Test' }
      }
      const res = {
        sendStatus: sinon.spy()
      }

      await MeController.updateClip(req, res)

      expect(res.sendStatus.calledWith(404)).to.be.true
    })

    it('should validate startTime when updating', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()
      const clip = await Database.audioClipModel.createClip(user.id, libraryItem.id, 10, 20, 'Test')

      const req = {
        user,
        params: { clipId: clip.id },
        body: {
          startTime: 'invalid'
        }
      }
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.updateClip(req, res)

      expect(res.status.calledWith(400)).to.be.true
      expect(res.send.calledWith('Invalid start time')).to.be.true
    })

    it('should validate endTime when updating', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()
      const clip = await Database.audioClipModel.createClip(user.id, libraryItem.id, 10, 20, 'Test')

      const req = {
        user,
        params: { clipId: clip.id },
        body: {
          endTime: null
        }
      }
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.updateClip(req, res)

      expect(res.status.calledWith(400)).to.be.true
      expect(res.send.calledWith('Invalid end time')).to.be.true
    })

    it('should validate title when updating', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()
      const clip = await Database.audioClipModel.createClip(user.id, libraryItem.id, 10, 20, 'Test')

      const req = {
        user,
        params: { clipId: clip.id },
        body: {
          title: 123
        }
      }
      const res = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.updateClip(req, res)

      expect(res.status.calledWith(400)).to.be.true
      expect(res.send.calledWith('Invalid title')).to.be.true
    })

    it('should return 403 if clip belongs to another user', async () => {
      const user1 = await Database.userModel.create({
        username: 'user1',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const user2 = await Database.userModel.create({
        username: 'user2',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()
      const clip = await Database.audioClipModel.createClip(user1.id, libraryItem.id, 10, 20, 'Test')

      const req = {
        user: user2,
        params: { clipId: clip.id },
        body: { title: 'Updated' }
      }
      const res = {
        sendStatus: sinon.spy()
      }

      await MeController.updateClip(req, res)

      expect(res.sendStatus.calledWith(403)).to.be.true
    })

    it('should handle errors gracefully', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()
      const clip = await Database.audioClipModel.createClip(user.id, libraryItem.id, 10, 20, 'Test')

      // Simulate database error
      sinon.stub(Database.audioClipModel, 'updateClip').rejects(new Error('Database error'))

      const req = {
        user,
        params: { clipId: clip.id },
        body: { title: 'Updated' }
      }
      const res = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.updateClip(req, res)

      expect(res.status.calledWith(400)).to.be.true
      expect(res.send.called).to.be.true
    })
  })

  describe('deleteClip', () => {
    it('should delete a clip', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()
      const clip = await Database.audioClipModel.createClip(user.id, libraryItem.id, 10, 20, 'Test')

      const req = {
        user,
        params: { clipId: clip.id }
      }
      const res = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.deleteClip(req, res)

      expect(res.sendStatus.calledWith(200)).to.be.true
      expect(socketEmitStub.calledWith(user.id, 'clip_removed')).to.be.true

      // Verify clip was deleted
      const deletedClip = await Database.audioClipModel.findByPk(clip.id)
      expect(deletedClip).to.be.null
    })

    it('should return 404 for non-existent clip', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const req = {
        user,
        params: { clipId: 'nonexistent-id' }
      }
      const res = {
        sendStatus: sinon.spy()
      }

      await MeController.deleteClip(req, res)

      expect(res.sendStatus.calledWith(404)).to.be.true
    })

    it('should return 403 if clip belongs to another user', async () => {
      const user1 = await Database.userModel.create({
        username: 'user1',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const user2 = await Database.userModel.create({
        username: 'user2',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()
      const clip = await Database.audioClipModel.createClip(user1.id, libraryItem.id, 10, 20, 'Test')

      const req = {
        user: user2,
        params: { clipId: clip.id }
      }
      const res = {
        sendStatus: sinon.spy()
      }

      await MeController.deleteClip(req, res)

      expect(res.sendStatus.calledWith(403)).to.be.true
    })

    it('should handle errors gracefully', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'test',
        type: 'user',
        isActive: true
      })

      const libraryItem = await createTestLibraryItem()
      const clip = await Database.audioClipModel.createClip(user.id, libraryItem.id, 10, 20, 'Test')

      // Simulate database error
      sinon.stub(Database.audioClipModel, 'deleteClip').rejects(new Error('Database error'))

      const req = {
        user,
        params: { clipId: clip.id }
      }
      const res = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.deleteClip(req, res)

      expect(res.status.calledWith(500)).to.be.true
      expect(res.send.calledWith('Failed to delete clip')).to.be.true
    })
  })

  // Helper function to create a test library item
  async function createTestLibraryItem() {
    const library = await Database.libraryModel.create({
      name: 'Test Library',
      mediaType: 'book'
    })

    const libraryFolder = await Database.libraryFolderModel.create({
      path: '/test',
      libraryId: library.id
    })

    const book = await Database.bookModel.create({
      title: 'Test Book',
      audioFiles: [],
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })

    return await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })
  }
})
