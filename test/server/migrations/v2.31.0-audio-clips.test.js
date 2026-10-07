const { expect } = require('chai')
const sinon = require('sinon')
const { up, down } = require('../../../server/migrations/v2.31.0-audio-clips')
const { Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

describe('v2.31.0-audio-clips migration', () => {
  let sequelize
  let queryInterface
  let loggerInfoStub

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    loggerInfoStub = sinon.stub(Logger, 'info')

    // Create users table with bookmarks
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      username: Sequelize.STRING,
      bookmarks: Sequelize.JSON,
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    })

    // Create libraryItems table
    await queryInterface.createTable('libraryItems', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      title: Sequelize.STRING,
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    it('should create audioClips table with correct columns', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const tables = await queryInterface.showAllTables()
      expect(tables).to.include('audioClips')

      const tableDescription = await queryInterface.describeTable('audioClips')
      expect(tableDescription).to.have.property('id')
      expect(tableDescription).to.have.property('userId')
      expect(tableDescription).to.have.property('libraryItemId')
      expect(tableDescription).to.have.property('episodeId')
      expect(tableDescription).to.have.property('startTime')
      expect(tableDescription).to.have.property('endTime')
      expect(tableDescription).to.have.property('title')
      expect(tableDescription).to.have.property('note')
      expect(tableDescription).to.have.property('createdAt')
      expect(tableDescription).to.have.property('updatedAt')
    })

    it('should create indexes on audioClips table', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const indexes = await queryInterface.showIndex('audioClips')
      const indexNames = indexes.map((idx) => idx.name)

      expect(indexNames).to.include('audio_clips_user_id')
      expect(indexNames).to.include('audio_clips_library_item_id')
      expect(indexNames).to.include('audio_clips_start_time')
      expect(indexNames).to.include('audio_clips_user_library_item')
    })

    it('should migrate bookmarks to clips', async () => {
      // Insert library items first (for foreign key constraints)
      await queryInterface.bulkInsert('libraryItems', [
        {
          id: '11111111-2222-3333-4444-555555555555',
          title: 'Test Item',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      // Insert a user with bookmarks
      await queryInterface.bulkInsert('users', [
        {
          id: '12345678-1234-1234-1234-123456789012',
          username: 'testuser',
          bookmarks: JSON.stringify([
            {
              libraryItemId: '11111111-2222-3333-4444-555555555555',
              time: 100,
              title: 'Bookmark 1',
              createdAt: new Date('2024-01-01').toISOString()
            },
            {
              libraryItemId: '11111111-2222-3333-4444-555555555555',
              time: 200,
              title: 'Bookmark 2',
              createdAt: new Date('2024-01-02').toISOString()
            }
          ]),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      const [clips] = await queryInterface.sequelize.query('SELECT * FROM audioClips ORDER BY startTime')

      expect(clips).to.have.lengthOf(2)
      expect(clips[0].userId).to.equal('12345678-1234-1234-1234-123456789012')
      expect(clips[0].libraryItemId).to.equal('11111111-2222-3333-4444-555555555555')
      expect(clips[0].startTime).to.equal(100)
      expect(clips[0].endTime).to.equal(110)
      expect(clips[0].title).to.equal('Bookmark 1')

      expect(clips[1].startTime).to.equal(200)
      expect(clips[1].endTime).to.equal(210)
      expect(clips[1].title).to.equal('Bookmark 2')
    })

    it('should skip users with no bookmarks', async () => {
      await queryInterface.bulkInsert('users', [
        {
          id: '12345678-1234-1234-1234-123456789012',
          username: 'testuser',
          bookmarks: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      const [clips] = await queryInterface.sequelize.query('SELECT * FROM audioClips')
      expect(clips).to.have.lengthOf(0)
    })

    it('should skip invalid bookmarks', async () => {
      // Insert library items first (for foreign key constraints)
      await queryInterface.bulkInsert('libraryItems', [
        {
          id: '11111111-2222-3333-4444-555555555555',
          title: 'Test Item',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      await queryInterface.bulkInsert('users', [
        {
          id: '12345678-1234-1234-1234-123456789012',
          username: 'testuser',
          bookmarks: JSON.stringify([
            {
              libraryItemId: '11111111-2222-3333-4444-555555555555',
              time: 100,
              title: 'Valid Bookmark'
            },
            {
              // Missing libraryItemId
              time: 200,
              title: 'Invalid Bookmark 1'
            },
            {
              libraryItemId: '11111111-2222-3333-4444-555555555555',
              // Missing time
              title: 'Invalid Bookmark 2'
            }
          ]),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      const [clips] = await queryInterface.sequelize.query('SELECT * FROM audioClips')
      expect(clips).to.have.lengthOf(1)
      expect(clips[0].title).to.equal('Valid Bookmark')
    })

    it('should set default title for bookmarks without title', async () => {
      // Insert library items first (for foreign key constraints)
      await queryInterface.bulkInsert('libraryItems', [
        {
          id: '11111111-2222-3333-4444-555555555555',
          title: 'Test Item',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      await queryInterface.bulkInsert('users', [
        {
          id: '12345678-1234-1234-1234-123456789012',
          username: 'testuser',
          bookmarks: JSON.stringify([
            {
              libraryItemId: '11111111-2222-3333-4444-555555555555',
              time: 100
            }
          ]),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      const [clips] = await queryInterface.sequelize.query('SELECT * FROM audioClips')
      expect(clips).to.have.lengthOf(1)
      expect(clips[0].title).to.equal('Migrated Bookmark')
    })

    it('should log migration progress', async () => {
      // Insert library items first (for foreign key constraints)
      await queryInterface.bulkInsert('libraryItems', [
        {
          id: '11111111-2222-3333-4444-555555555555',
          title: 'Test Item',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      await queryInterface.bulkInsert('users', [
        {
          id: '12345678-1234-1234-1234-123456789012',
          username: 'testuser',
          bookmarks: JSON.stringify([
            {
              libraryItemId: '11111111-2222-3333-4444-555555555555',
              time: 100,
              title: 'Bookmark 1'
            }
          ]),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.calledWith(sinon.match('UPGRADE BEGIN'))).to.be.true
      expect(loggerInfoStub.calledWith(sinon.match('Creating audioClips table'))).to.be.true
      expect(loggerInfoStub.calledWith(sinon.match('Creating indexes'))).to.be.true
      expect(loggerInfoStub.calledWith(sinon.match('Migrating bookmarks'))).to.be.true
      expect(loggerInfoStub.calledWith(sinon.match('Migrating 1 bookmarks'))).to.be.true
      expect(loggerInfoStub.calledWith(sinon.match('UPGRADE END'))).to.be.true
    })
  })

  describe('down', () => {
    it('should drop audioClips table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const tables = await queryInterface.showAllTables()
      expect(tables).not.to.include('audioClips')
    })

    it('should log downgrade progress', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      // Reset stub to clear previous calls
      loggerInfoStub.resetHistory()

      await down({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.calledWith(sinon.match('DOWNGRADE BEGIN'))).to.be.true
      expect(loggerInfoStub.calledWith(sinon.match('Dropping audioClips table'))).to.be.true
      expect(loggerInfoStub.calledWith(sinon.match('DOWNGRADE END'))).to.be.true
    })
  })
})
