const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const ApiRouter = require('../../../server/routers/ApiRouter')
const MeController = require('../../../server/controllers/MeController')
const Auth = require('../../../server/Auth')
const Logger = require('../../../server/Logger')
const SocketAuthority = require('../../../server/SocketAuthority')

describe('MeController - IDOR Security Tests', () => {
  /** @type {ApiRouter} */
  let apiRouter

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    // Create mock server object with required dependencies
    const mockServer = {
      auth: new Auth(),
      playbackSessionManager: { sessions: [] },
      abMergeManager: {},
      backupManager: {},
      podcastManager: {},
      audioMetadataManager: {},
      cronManager: {},
      emailManager: {},
      apiCacheManager: { middleware: (req, res, next) => next() }
    }

    apiRouter = new ApiRouter(mockServer)

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'error')
    sinon.stub(SocketAuthority, 'clientEmitter')
  })

  afterEach(async () => {
    sinon.restore()

    // Clear all tables
    await Database.sequelize.sync({ force: true })
  })

  describe('removeMediaProgress - IDOR Protection', () => {
    let user1, user2
    let mediaProgress1, mediaProgress2

    beforeEach(async () => {
      // Create two users
      user1 = await Database.userModel.create({
        username: 'user1',
        pash: 'hashed_password_1',
        type: 'user',
        isActive: true
      })

      user2 = await Database.userModel.create({
        username: 'user2',
        pash: 'hashed_password_2',
        type: 'user',
        isActive: true
      })

      // Create library and book
      const library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
      const libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
      const book = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
      const libraryItem = await Database.libraryItemModel.create({
        libraryFiles: [],
        mediaId: book.id,
        mediaType: 'book',
        libraryId: library.id,
        libraryFolderId: libraryFolder.id
      })

      // Create media progress for each user
      mediaProgress1 = await Database.mediaProgressModel.create({
        userId: user1.id,
        mediaItemId: book.id,
        mediaItemType: 'book',
        duration: 1000,
        currentTime: 500,
        isFinished: false
      })

      mediaProgress2 = await Database.mediaProgressModel.create({
        userId: user2.id,
        mediaItemId: book.id,
        mediaItemType: 'book',
        duration: 1000,
        currentTime: 300,
        isFinished: false
      })

      // Load media progresses into users
      user1.mediaProgresses = await user1.getMediaProgresses()
      user2.mediaProgresses = await user2.getMediaProgresses()
    })

    it('should allow user to delete their own media progress', async () => {
      const fakeReq = {
        user: user1,
        params: { id: mediaProgress1.id }
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.removeMediaProgress(fakeReq, fakeRes)

      expect(fakeRes.sendStatus.calledWith(200)).to.be.true

      // Verify media progress was deleted
      const deletedProgress = await Database.mediaProgressModel.findByPk(mediaProgress1.id)
      expect(deletedProgress).to.be.null
    })

    it('should prevent user from deleting another users media progress (IDOR)', async () => {
      const fakeReq = {
        user: user1,
        params: { id: mediaProgress2.id } // Trying to delete user2's progress
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.removeMediaProgress(fakeReq, fakeRes)

      expect(fakeRes.sendStatus.calledWith(404)).to.be.true

      // Verify media progress was NOT deleted
      const existingProgress = await Database.mediaProgressModel.findByPk(mediaProgress2.id)
      expect(existingProgress).to.not.be.null
      expect(existingProgress.userId).to.equal(user2.id)
    })

    it('should return 404 for non-existent media progress', async () => {
      const fakeReq = {
        user: user1,
        params: { id: 'non-existent-id' }
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.removeMediaProgress(fakeReq, fakeRes)

      expect(fakeRes.sendStatus.calledWith(404)).to.be.true
    })
  })

  describe('Bookmark Operations - Authorization Checks', () => {
    let user1, user2
    let library1, library2
    let libraryItem1, libraryItem2

    beforeEach(async () => {
      // Create two users with different library access
      user1 = await Database.userModel.create({
        username: 'user1',
        pash: 'hashed_password_1',
        type: 'user',
        isActive: true,
        librariesAccessible: null // Access to all libraries
      })

      user2 = await Database.userModel.create({
        username: 'user2',
        pash: 'hashed_password_2',
        type: 'user',
        isActive: true,
        librariesAccessible: [] // Will be set to specific library
      })

      // Create two libraries
      library1 = await Database.libraryModel.create({ name: 'Library 1', mediaType: 'book' })
      library2 = await Database.libraryModel.create({ name: 'Library 2', mediaType: 'book' })

      // User2 only has access to library1
      user2.librariesAccessible = [library1.id]
      await user2.save()

      const libraryFolder1 = await Database.libraryFolderModel.create({ path: '/test1', libraryId: library1.id })
      const libraryFolder2 = await Database.libraryFolderModel.create({ path: '/test2', libraryId: library2.id })

      const book1 = await Database.bookModel.create({ title: 'Book 1', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
      const book2 = await Database.bookModel.create({ title: 'Book 2', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })

      libraryItem1 = await Database.libraryItemModel.create({
        libraryFiles: [],
        mediaId: book1.id,
        mediaType: 'book',
        libraryId: library1.id,
        libraryFolderId: libraryFolder1.id
      })

      libraryItem2 = await Database.libraryItemModel.create({
        libraryFiles: [],
        mediaId: book2.id,
        mediaType: 'book',
        libraryId: library2.id,
        libraryFolderId: libraryFolder2.id
      })

      // Initialize bookmarks
      user1.bookmarks = []
      user2.bookmarks = []
    })

    describe('createBookmark', () => {
      it('should allow user to create bookmark for accessible library item', async () => {
        const expandedItem = await Database.libraryItemModel.getExpandedById(libraryItem1.id)

        const bookmark = { libraryItemId: libraryItem1.id, time: 100, title: 'Test Bookmark', createdAt: Date.now() }

        const fakeReq = {
          user: {
            ...user2.toJSON(),
            id: user2.id,
            username: user2.username,
            checkCanAccessLibraryItem: () => true,
            createBookmark: sinon.stub().resolves(bookmark),
            toOldJSONForBrowser: () => ({ id: user2.id, username: user2.username })
          },
          params: { id: libraryItem1.id },
          body: { time: 100, title: 'Test Bookmark' }
        }
        const fakeRes = {
          sendStatus: sinon.spy(),
          status: sinon.stub().returnsThis(),
          send: sinon.spy(),
          json: sinon.spy()
        }

        sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(expandedItem)

        await MeController.createBookmark(fakeReq, fakeRes)

        expect(fakeRes.json.calledOnce).to.be.true
        expect(fakeRes.json.calledWith(bookmark)).to.be.true

        Database.libraryItemModel.getExpandedById.restore()
      })

      it('should prevent user from creating bookmark for inaccessible library item (IDOR)', async () => {
        const expandedItem = await Database.libraryItemModel.getExpandedById(libraryItem2.id)

        const fakeReq = {
          user: user2, // user2 doesn't have access to library2
          params: { id: libraryItem2.id },
          body: { time: 100, title: 'Test Bookmark' }
        }
        const fakeRes = {
          sendStatus: sinon.spy(),
          status: sinon.stub().returnsThis(),
          send: sinon.spy(),
          json: sinon.spy()
        }

        // Mock getExpandedById
        sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(expandedItem)

        await MeController.createBookmark(fakeReq, fakeRes)

        expect(fakeRes.sendStatus.calledWith(403)).to.be.true
        expect(fakeRes.json.called).to.be.false

        Database.libraryItemModel.getExpandedById.restore()
      })

      it('should return 404 for non-existent library item', async () => {
        const fakeReq = {
          user: user1,
          params: { id: 'non-existent-id' },
          body: { time: 100, title: 'Test Bookmark' }
        }
        const fakeRes = {
          sendStatus: sinon.spy(),
          status: sinon.stub().returnsThis(),
          send: sinon.spy(),
          json: sinon.spy()
        }

        // Mock getExpandedById to return null
        sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(null)

        await MeController.createBookmark(fakeReq, fakeRes)

        expect(fakeRes.sendStatus.calledWith(404)).to.be.true

        Database.libraryItemModel.getExpandedById.restore()
      })

      it('should validate bookmark time parameter', async () => {
        const expandedItem = await Database.libraryItemModel.getExpandedById(libraryItem1.id)

        const fakeReq = {
          user: {
            ...user1.toJSON(),
            id: user1.id,
            username: user1.username,
            checkCanAccessLibraryItem: () => true
          },
          params: { id: libraryItem1.id },
          body: { time: null, title: 'Test Bookmark' } // null time is invalid
        }
        const fakeRes = {
          sendStatus: sinon.spy(),
          status: sinon.stub().returnsThis(),
          send: sinon.spy(),
          json: sinon.spy()
        }

        sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(expandedItem)

        await MeController.createBookmark(fakeReq, fakeRes)

        expect(fakeRes.status.calledWith(400)).to.be.true
        expect(fakeRes.send.calledWith('Invalid time')).to.be.true

        Database.libraryItemModel.getExpandedById.restore()
      })
    })

    describe('updateBookmark', () => {
      beforeEach(async () => {
        // Add existing bookmark to user1
        user1.bookmarks = [{ libraryItemId: libraryItem1.id, time: 100, title: 'Original Title' }]
        await user1.save()
      })

      it('should allow user to update bookmark for accessible library item', async () => {
        const expandedItem = await Database.libraryItemModel.getExpandedById(libraryItem1.id)

        const bookmark = { libraryItemId: libraryItem1.id, time: 100, title: 'Updated Title' }

        const fakeReq = {
          user: {
            ...user1.toJSON(),
            id: user1.id,
            username: user1.username,
            checkCanAccessLibraryItem: () => true,
            updateBookmark: sinon.stub().resolves(bookmark),
            toOldJSONForBrowser: () => ({ id: user1.id, username: user1.username })
          },
          params: { id: libraryItem1.id },
          body: { time: 100, title: 'Updated Title' }
        }
        const fakeRes = {
          sendStatus: sinon.spy(),
          status: sinon.stub().returnsThis(),
          send: sinon.spy(),
          json: sinon.spy()
        }

        sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(expandedItem)

        await MeController.updateBookmark(fakeReq, fakeRes)

        expect(fakeRes.json.calledOnce).to.be.true
        expect(fakeRes.json.calledWith(bookmark)).to.be.true

        Database.libraryItemModel.getExpandedById.restore()
      })

      it('should prevent user from updating bookmark for inaccessible library item (IDOR)', async () => {
        const expandedItem = await Database.libraryItemModel.getExpandedById(libraryItem2.id)

        const fakeReq = {
          user: user2, // user2 doesn't have access to library2
          params: { id: libraryItem2.id },
          body: { time: 100, title: 'Updated Title' }
        }
        const fakeRes = {
          sendStatus: sinon.spy(),
          status: sinon.stub().returnsThis(),
          send: sinon.spy(),
          json: sinon.spy()
        }

        sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(expandedItem)

        await MeController.updateBookmark(fakeReq, fakeRes)

        expect(fakeRes.sendStatus.calledWith(403)).to.be.true

        Database.libraryItemModel.getExpandedById.restore()
      })
    })

    describe('removeBookmark', () => {
      beforeEach(async () => {
        // Add existing bookmark to user1
        user1.bookmarks = [{ libraryItemId: libraryItem1.id, time: 100, title: 'Test Bookmark' }]
        await user1.save()
      })

      it('should allow user to remove bookmark for accessible library item', async () => {
        const expandedItem = await Database.libraryItemModel.getExpandedById(libraryItem1.id)

        const fakeReq = {
          user: {
            ...user1.toJSON(),
            id: user1.id,
            username: user1.username,
            checkCanAccessLibraryItem: () => true,
            findBookmark: sinon.stub().returns({ libraryItemId: libraryItem1.id, time: 100, title: 'Test Bookmark' }),
            removeBookmark: sinon.stub().resolves(true),
            toOldJSONForBrowser: () => ({ id: user1.id, username: user1.username })
          },
          params: { id: libraryItem1.id, time: '100' }
        }
        const fakeRes = {
          sendStatus: sinon.spy(),
          status: sinon.stub().returnsThis(),
          send: sinon.spy()
        }

        sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(expandedItem)

        await MeController.removeBookmark(fakeReq, fakeRes)

        expect(fakeRes.sendStatus.calledWith(200)).to.be.true

        Database.libraryItemModel.getExpandedById.restore()
      })

      it('should prevent user from removing bookmark for inaccessible library item (IDOR)', async () => {
        const expandedItem = await Database.libraryItemModel.getExpandedById(libraryItem2.id)

        const fakeReq = {
          user: user2, // user2 doesn't have access to library2
          params: { id: libraryItem2.id, time: '100' }
        }
        const fakeRes = {
          sendStatus: sinon.spy(),
          status: sinon.stub().returnsThis(),
          send: sinon.spy()
        }

        sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(expandedItem)

        await MeController.removeBookmark(fakeReq, fakeRes)

        expect(fakeRes.sendStatus.calledWith(403)).to.be.true

        Database.libraryItemModel.getExpandedById.restore()
      })

      it('should validate time parameter is a number', async () => {
        const expandedItem = await Database.libraryItemModel.getExpandedById(libraryItem1.id)

        const fakeReq = {
          user: {
            ...user1.toJSON(),
            id: user1.id,
            username: user1.username,
            checkCanAccessLibraryItem: () => true
          },
          params: { id: libraryItem1.id, time: 'not-a-number' }
        }
        const fakeRes = {
          sendStatus: sinon.spy(),
          status: sinon.stub().returnsThis(),
          send: sinon.spy()
        }

        sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(expandedItem)

        await MeController.removeBookmark(fakeReq, fakeRes)

        expect(fakeRes.status.calledWith(400)).to.be.true
        expect(fakeRes.send.calledWith('Invalid time')).to.be.true

        Database.libraryItemModel.getExpandedById.restore()
      })
    })
  })

  describe('getItemListeningSessions - Authorization Check', () => {
    let user1, user2
    let library1, library2
    let libraryItem1, libraryItem2

    beforeEach(async () => {
      // Create two users with different library access
      user1 = await Database.userModel.create({
        username: 'user1',
        pash: 'hashed_password_1',
        type: 'user',
        isActive: true,
        librariesAccessible: null // Access to all libraries
      })

      user2 = await Database.userModel.create({
        username: 'user2',
        pash: 'hashed_password_2',
        type: 'user',
        isActive: true,
        librariesAccessible: [] // Will be set to specific library
      })

      // Create two libraries
      library1 = await Database.libraryModel.create({ name: 'Library 1', mediaType: 'book' })
      library2 = await Database.libraryModel.create({ name: 'Library 2', mediaType: 'book' })

      // User2 only has access to library1
      user2.librariesAccessible = [library1.id]
      await user2.save()

      const libraryFolder1 = await Database.libraryFolderModel.create({ path: '/test1', libraryId: library1.id })
      const libraryFolder2 = await Database.libraryFolderModel.create({ path: '/test2', libraryId: library2.id })

      const book1 = await Database.bookModel.create({ title: 'Book 1', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
      const book2 = await Database.bookModel.create({ title: 'Book 2', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })

      libraryItem1 = await Database.libraryItemModel.create({
        libraryFiles: [],
        mediaId: book1.id,
        mediaType: 'book',
        libraryId: library1.id,
        libraryFolderId: libraryFolder1.id
      })

      libraryItem2 = await Database.libraryItemModel.create({
        libraryFiles: [],
        mediaId: book2.id,
        mediaType: 'book',
        libraryId: library2.id,
        libraryFolderId: libraryFolder2.id
      })
    })

    it('should allow user to view listening sessions for accessible library item', async () => {
      const expandedItem = await Database.libraryItemModel.getExpandedById(libraryItem1.id)

      // Create mock context with getUserItemListeningSessionsHelper
      const mockContext = {
        getUserItemListeningSessionsHelper: sinon.stub().resolves([
          { id: 'session1', timeListening: 300, startedAt: Date.now() }
        ])
      }

      const fakeReq = {
        user: {
          ...user1.toJSON(),
          id: user1.id,
          username: user1.username,
          checkCanAccessLibraryItem: () => true
        },
        params: { libraryItemId: libraryItem1.id },
        query: {}
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy(),
        json: sinon.spy()
      }

      sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(expandedItem)
      sinon.stub(Database.podcastEpisodeModel, 'findByPk').resolves(null)

      await MeController.getItemListeningSessions.bind(mockContext)(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      expect(fakeRes.sendStatus.called).to.be.false

      // Verify the payload structure
      const payload = fakeRes.json.firstCall.args[0]
      expect(payload).to.have.property('total')
      expect(payload).to.have.property('sessions')

      Database.libraryItemModel.getExpandedById.restore()
      Database.podcastEpisodeModel.findByPk.restore()
    })

    it('should prevent user from viewing listening sessions for inaccessible library item (IDOR)', async () => {
      const expandedItem = await Database.libraryItemModel.getExpandedById(libraryItem2.id)

      const fakeReq = {
        user: user2, // user2 doesn't have access to library2
        params: { libraryItemId: libraryItem2.id },
        query: {}
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy(),
        json: sinon.spy()
      }

      sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(expandedItem)
      sinon.stub(Database.podcastEpisodeModel, 'findByPk').resolves(null)

      await MeController.getItemListeningSessions.bind(apiRouter)(fakeReq, fakeRes)

      expect(fakeRes.sendStatus.calledWith(403)).to.be.true
      expect(fakeRes.json.called).to.be.false

      Database.libraryItemModel.getExpandedById.restore()
      Database.podcastEpisodeModel.findByPk.restore()
    })

    it('should return 404 for non-existent library item', async () => {
      const fakeReq = {
        user: user1,
        params: { libraryItemId: 'non-existent-id' },
        query: {}
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy(),
        json: sinon.spy()
      }

      sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(null)

      await MeController.getItemListeningSessions.bind(apiRouter)(fakeReq, fakeRes)

      expect(fakeRes.sendStatus.calledWith(404)).to.be.true

      Database.libraryItemModel.getExpandedById.restore()
    })
  })
})
