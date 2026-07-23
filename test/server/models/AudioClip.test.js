const { expect } = require('chai')
const sinon = require('sinon')
const { Sequelize } = require('sequelize')
const AudioClip = require('../../../server/models/AudioClip')
const Logger = require('../../../server/Logger')

describe('AudioClip Model', () => {
  let sequelize
  let loggerStub

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    loggerStub = {
      info: sinon.stub(Logger, 'info'),
      warn: sinon.stub(Logger, 'warn'),
      error: sinon.stub(Logger, 'error')
    }

    // Create mock models with proper associations
    const User = sequelize.define('user', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      username: Sequelize.STRING
    })

    const LibraryItem = sequelize.define('libraryItem', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      title: Sequelize.STRING
    })

    AudioClip.init(sequelize)
    await sequelize.sync({ force: true })

    // Create test users
    await User.create({
      id: '87654321-4321-4321-4321-210987654321',
      username: 'testuser'
    })
    await User.create({
      id: 'user1',
      username: 'user1'
    })
    await User.create({
      id: 'user2',
      username: 'user2'
    })
    await User.create({
      id: 'user3',
      username: 'user3'
    })

    // Create test library items
    await LibraryItem.create({
      id: '11111111-2222-3333-4444-555555555555',
      title: 'Test Item'
    })
    await LibraryItem.create({
      id: 'item1',
      title: 'Item 1'
    })
    await LibraryItem.create({
      id: 'item2',
      title: 'Item 2'
    })
    await LibraryItem.create({
      id: 'item3',
      title: 'Item 3'
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('Model Definition', () => {
    it('should create an AudioClip with valid data', async () => {
      const clip = await AudioClip.create({
        id: '12345678-1234-1234-1234-123456789012',
        userId: '87654321-4321-4321-4321-210987654321',
        libraryItemId: '11111111-2222-3333-4444-555555555555',
        startTime: 10.5,
        endTime: 20.8,
        title: 'Test Clip',
        note: 'Test note'
      })

      expect(clip).to.exist
      expect(clip.id).to.equal('12345678-1234-1234-1234-123456789012')
      expect(clip.userId).to.equal('87654321-4321-4321-4321-210987654321')
      expect(clip.startTime).to.equal(10.5)
      expect(clip.endTime).to.equal(20.8)
      expect(clip.title).to.equal('Test Clip')
      expect(clip.note).to.equal('Test note')
    })

    it('should require userId', async () => {
      try {
        await AudioClip.create({
          libraryItemId: '11111111-2222-3333-4444-555555555555',
          startTime: 10,
          endTime: 20,
          title: 'Test'
        })
        expect.fail('Should have thrown validation error')
      } catch (error) {
        expect(error.name).to.equal('SequelizeValidationError')
      }
    })

    it('should require libraryItemId', async () => {
      try {
        await AudioClip.create({
          userId: '87654321-4321-4321-4321-210987654321',
          startTime: 10,
          endTime: 20,
          title: 'Test'
        })
        expect.fail('Should have thrown validation error')
      } catch (error) {
        expect(error.name).to.equal('SequelizeValidationError')
      }
    })

    it('should allow null episodeId', async () => {
      const clip = await AudioClip.create({
        userId: '87654321-4321-4321-4321-210987654321',
        libraryItemId: '11111111-2222-3333-4444-555555555555',
        episodeId: null,
        startTime: 10,
        endTime: 20,
        title: 'Test'
      })

      expect(clip.episodeId).to.be.null
    })
  })

  describe('getDuration', () => {
    it('should calculate duration correctly', async () => {
      const clip = await AudioClip.create({
        userId: '87654321-4321-4321-4321-210987654321',
        libraryItemId: '11111111-2222-3333-4444-555555555555',
        startTime: 10.5,
        endTime: 25.8,
        title: 'Test'
      })

      expect(clip.getDuration()).to.be.closeTo(15.3, 0.01)
    })
  })

  describe('isValidTimeRange', () => {
    it('should return true for valid time range', async () => {
      const clip = await AudioClip.create({
        userId: '87654321-4321-4321-4321-210987654321',
        libraryItemId: '11111111-2222-3333-4444-555555555555',
        startTime: 10,
        endTime: 20,
        title: 'Test'
      })

      expect(clip.isValidTimeRange()).to.be.true
    })

    it('should return false for negative start time', async () => {
      const clip = AudioClip.build({
        userId: '87654321-4321-4321-4321-210987654321',
        libraryItemId: '11111111-2222-3333-4444-555555555555',
        startTime: -5,
        endTime: 20,
        title: 'Test'
      })

      expect(clip.isValidTimeRange()).to.be.false
    })

    it('should return false when endTime <= startTime', async () => {
      const clip = AudioClip.build({
        userId: '87654321-4321-4321-4321-210987654321',
        libraryItemId: '11111111-2222-3333-4444-555555555555',
        startTime: 20,
        endTime: 20,
        title: 'Test'
      })

      expect(clip.isValidTimeRange()).to.be.false
    })
  })

  describe('createClip', () => {
    it('should create a clip with valid data', async () => {
      const clip = await AudioClip.createClip('87654321-4321-4321-4321-210987654321', '11111111-2222-3333-4444-555555555555', 10, 20, 'Test Clip', 'Test note')

      expect(clip).to.exist
      expect(clip.startTime).to.equal(10)
      expect(clip.endTime).to.equal(20)
      expect(clip.title).to.equal('Test Clip')
      expect(clip.note).to.equal('Test note')
      expect(loggerStub.info.calledWith(sinon.match(/Created clip/))).to.be.true
    })

    it('should throw error for negative start time', async () => {
      try {
        await AudioClip.createClip('87654321-4321-4321-4321-210987654321', '11111111-2222-3333-4444-555555555555', -5, 20, 'Test')
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.message).to.include('Start time must be non-negative')
      }
    })

    it('should throw error when endTime <= startTime', async () => {
      try {
        await AudioClip.createClip('87654321-4321-4321-4321-210987654321', '11111111-2222-3333-4444-555555555555', 20, 15, 'Test')
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.message).to.include('End time must be greater than start time')
      }
    })

    it('should warn for clips longer than 10 minutes', async () => {
      await AudioClip.createClip('87654321-4321-4321-4321-210987654321', '11111111-2222-3333-4444-555555555555', 0, 700, 'Long Clip')

      expect(loggerStub.warn.calledWith(sinon.match(/long duration/))).to.be.true
    })
  })

  describe('updateClip', () => {
    it('should update an existing clip', async () => {
      const clip = await AudioClip.createClip('87654321-4321-4321-4321-210987654321', '11111111-2222-3333-4444-555555555555', 10, 20, 'Original Title')

      const updated = await AudioClip.updateClip(clip.id, {
        title: 'Updated Title',
        note: 'Updated note'
      })

      expect(updated.title).to.equal('Updated Title')
      expect(updated.note).to.equal('Updated note')
      expect(updated.startTime).to.equal(10)
      expect(updated.endTime).to.equal(20)
    })

    it('should update time range', async () => {
      const clip = await AudioClip.createClip('87654321-4321-4321-4321-210987654321', '11111111-2222-3333-4444-555555555555', 10, 20, 'Test')

      const updated = await AudioClip.updateClip(clip.id, {
        startTime: 15,
        endTime: 25
      })

      expect(updated.startTime).to.equal(15)
      expect(updated.endTime).to.equal(25)
    })

    it('should throw error for invalid clip id', async () => {
      try {
        await AudioClip.updateClip('nonexistent-id', { title: 'Test' })
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.message).to.include('Clip not found')
      }
    })

    it('should validate time range on update', async () => {
      const clip = await AudioClip.createClip('87654321-4321-4321-4321-210987654321', '11111111-2222-3333-4444-555555555555', 10, 20, 'Test')

      try {
        await AudioClip.updateClip(clip.id, {
          endTime: 5
        })
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.message).to.include('End time must be greater than start time')
      }
    })
  })

  describe('deleteClip', () => {
    it('should delete a clip', async () => {
      const clip = await AudioClip.createClip('87654321-4321-4321-4321-210987654321', '11111111-2222-3333-4444-555555555555', 10, 20, 'Test')

      const deleted = await AudioClip.deleteClip(clip.id)
      expect(deleted).to.be.true

      const found = await AudioClip.findByPk(clip.id)
      expect(found).to.be.null
    })

    it('should return false for nonexistent clip', async () => {
      const deleted = await AudioClip.deleteClip('nonexistent-id')
      expect(deleted).to.be.false
    })
  })

  describe('getClipsForItem', () => {
    it('should return clips for a library item', async () => {
      await AudioClip.createClip('user1', 'item1', 10, 20, 'Clip 1')
      await AudioClip.createClip('user1', 'item1', 30, 40, 'Clip 2')
      await AudioClip.createClip('user1', 'item2', 50, 60, 'Clip 3')

      const clips = await AudioClip.getClipsForItem('user1', 'item1')
      expect(clips).to.have.lengthOf(2)
      const startTimes = clips.map(c => c.startTime).sort((a, b) => a - b)
      expect(startTimes).to.deep.equal([10, 30])
    })

    it('should filter by episodeId', async () => {
      await AudioClip.createClip('user1', 'item1', 10, 20, 'Clip 1', null, 'episode1')
      await AudioClip.createClip('user1', 'item1', 30, 40, 'Clip 2', null, 'episode2')

      const clips = await AudioClip.getClipsForItem('user1', 'item1', 'episode1')
      expect(clips).to.have.lengthOf(1)
      expect(clips[0].episodeId).to.equal('episode1')
    })

    it('should return all clips for item', async () => {
      await AudioClip.createClip('user1', 'item1', 30, 40, 'Clip 2')
      await AudioClip.createClip('user1', 'item1', 10, 20, 'Clip 1')
      await AudioClip.createClip('user1', 'item1', 50, 60, 'Clip 3')

      const clips = await AudioClip.getClipsForItem('user1', 'item1')
      expect(clips).to.have.lengthOf(3)
      const startTimes = clips.map(c => c.startTime).sort((a, b) => a - b)
      expect(startTimes).to.deep.equal([10, 30, 50])
    })

    it('should only return clips for the specified user', async () => {
      await AudioClip.createClip('user1', 'item1', 10, 20, 'User 1 Clip')
      await AudioClip.createClip('user2', 'item1', 30, 40, 'User 2 Clip')
      await AudioClip.createClip('user1', 'item1', 50, 60, 'User 1 Clip 2')

      const user1Clips = await AudioClip.getClipsForItem('user1', 'item1')
      expect(user1Clips).to.have.lengthOf(2)
      expect(user1Clips.every((c) => c.userId === 'user1')).to.be.true

      const user2Clips = await AudioClip.getClipsForItem('user2', 'item1')
      expect(user2Clips).to.have.lengthOf(1)
      expect(user2Clips[0].userId).to.equal('user2')
    })

    it('should not return other users clips for the same item', async () => {
      // Create clips from multiple users on the same item
      await AudioClip.createClip('user1', 'item1', 5, 15, 'User 1 First Clip')
      await AudioClip.createClip('user2', 'item1', 10, 20, 'User 2 First Clip')
      await AudioClip.createClip('user3', 'item1', 15, 25, 'User 3 First Clip')
      await AudioClip.createClip('user1', 'item1', 20, 30, 'User 1 Second Clip')
      await AudioClip.createClip('user2', 'item1', 25, 35, 'User 2 Second Clip')

      // Each user should only see their own clips
      const user1Clips = await AudioClip.getClipsForItem('user1', 'item1')
      expect(user1Clips).to.have.lengthOf(2)
      expect(user1Clips.every((c) => c.userId === 'user1')).to.be.true
      expect(user1Clips.some((c) => c.title.includes('User 2'))).to.be.false
      expect(user1Clips.some((c) => c.title.includes('User 3'))).to.be.false

      const user2Clips = await AudioClip.getClipsForItem('user2', 'item1')
      expect(user2Clips).to.have.lengthOf(2)
      expect(user2Clips.every((c) => c.userId === 'user2')).to.be.true
      expect(user2Clips.some((c) => c.title.includes('User 1'))).to.be.false
      expect(user2Clips.some((c) => c.title.includes('User 3'))).to.be.false

      const user3Clips = await AudioClip.getClipsForItem('user3', 'item1')
      expect(user3Clips).to.have.lengthOf(1)
      expect(user3Clips[0].userId).to.equal('user3')
      expect(user3Clips.some((c) => c.title.includes('User 1'))).to.be.false
      expect(user3Clips.some((c) => c.title.includes('User 2'))).to.be.false
    })

    it('should return empty array when user has no clips for item', async () => {
      await AudioClip.createClip('user1', 'item1', 10, 20, 'User 1 Clip')
      await AudioClip.createClip('user2', 'item1', 30, 40, 'User 2 Clip')

      // user3 has no clips for item1
      const user3Clips = await AudioClip.getClipsForItem('user3', 'item1')
      expect(user3Clips).to.have.lengthOf(0)
    })

    it('should filter by both user and episode', async () => {
      await AudioClip.createClip('user1', 'item1', 10, 20, 'User 1 Episode 1', null, 'episode1')
      await AudioClip.createClip('user1', 'item1', 30, 40, 'User 1 Episode 2', null, 'episode2')
      await AudioClip.createClip('user2', 'item1', 50, 60, 'User 2 Episode 1', null, 'episode1')

      const user1Episode1Clips = await AudioClip.getClipsForItem('user1', 'item1', 'episode1')
      expect(user1Episode1Clips).to.have.lengthOf(1)
      expect(user1Episode1Clips[0].userId).to.equal('user1')
      expect(user1Episode1Clips[0].episodeId).to.equal('episode1')
      expect(user1Episode1Clips[0].title).to.equal('User 1 Episode 1')
    })
  })

  describe('getClipsForUser', () => {
    it('should return clips for a user', async () => {
      await AudioClip.createClip('user1', 'item1', 10, 20, 'Clip 1')
      await AudioClip.createClip('user1', 'item2', 30, 40, 'Clip 2')
      await AudioClip.createClip('user2', 'item1', 50, 60, 'Clip 3')

      const clips = await AudioClip.getClipsForUser('user1')
      expect(clips).to.have.lengthOf(2)
    })

    it('should sort by creation date descending', async () => {
      const clip1 = await AudioClip.createClip('user1', 'item1', 10, 20, 'Clip 1')
      await new Promise((resolve) => setTimeout(resolve, 10))
      const clip2 = await AudioClip.createClip('user1', 'item2', 30, 40, 'Clip 2')

      const clips = await AudioClip.getClipsForUser('user1')
      expect(clips[0].id).to.equal(clip2.id)
      expect(clips[1].id).to.equal(clip1.id)
    })

    it('should support limit and offset', async () => {
      await AudioClip.createClip('user1', 'item1', 10, 20, 'Clip 1')
      await AudioClip.createClip('user1', 'item2', 30, 40, 'Clip 2')
      await AudioClip.createClip('user1', 'item3', 50, 60, 'Clip 3')

      const clips = await AudioClip.getClipsForUser('user1', { limit: 2, offset: 1 })
      expect(clips).to.have.lengthOf(2)
    })
  })

  describe('toJSON', () => {
    it('should serialize clip to JSON', async () => {
      const clip = await AudioClip.createClip('user1', 'item1', 10.5, 20.8, 'Test Clip', 'Test note')

      const json = clip.toJSON()
      expect(json).to.have.property('id')
      expect(json).to.have.property('userId', 'user1')
      expect(json).to.have.property('libraryItemId', 'item1')
      expect(json).to.have.property('startTime', 10.5)
      expect(json).to.have.property('endTime', 20.8)
      expect(json).to.have.property('title', 'Test Clip')
      expect(json).to.have.property('note', 'Test note')
      expect(json).to.have.property('createdAt')
      expect(json).to.have.property('updatedAt')
    })
  })
})
