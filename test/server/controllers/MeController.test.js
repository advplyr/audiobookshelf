const { expect } = require('chai')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const MeController = require('../../../server/controllers/MeController')
const { Sequelize } = require('sequelize')

describe('MeController - bookmarks', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
  })

  function makeResponse() {
    const response = {
      sendStatus: sinon.spy(),
      status: sinon.stub()
    }
    response.status.returns({ send: sinon.spy() })
    return response
  }

  it('allows removing a bookmark when its library item no longer exists', async () => {
    sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(null)
    const user = {
      id: 'user-id',
      findBookmark: sinon.stub().returns({ libraryItemId: 'deleted-item', time: 10 }),
      removeBookmark: sinon.stub().resolves(true),
      toOldJSONForBrowser: sinon.stub().returns({ id: 'user-id' })
    }
    const res = makeResponse()

    await MeController.removeBookmark({ user, params: { id: 'deleted-item', time: '10' } }, res)

    expect(user.removeBookmark.calledOnceWith('deleted-item', 10)).to.be.true
    expect(res.sendStatus.calledWith(200)).to.be.true
  })

  it('returns 404 when the user does not own the orphaned bookmark', async () => {
    sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves(null)
    const user = {
      id: 'user-id',
      findBookmark: sinon.stub().returns(null),
      removeBookmark: sinon.stub()
    }
    const res = makeResponse()

    await MeController.removeBookmark({ user, params: { id: 'deleted-item', time: '10' } }, res)

    expect(user.removeBookmark.called).to.be.false
    expect(res.sendStatus.calledWith(404)).to.be.true
  })

  it('keeps access checks for existing library items', async () => {
    sinon.stub(Database.libraryItemModel, 'getExpandedById').resolves({ id: 'item', libraryId: 'library' })
    const user = {
      id: 'user-id',
      findBookmark: sinon.stub().returns({ libraryItemId: 'item', time: 10 }),
      removeBookmark: sinon.stub(),
      checkCanAccessLibraryItem: sinon.stub().returns(false)
    }
    const res = makeResponse()

    await MeController.removeBookmark({ user, params: { id: 'item', time: '10' } }, res)

    expect(user.removeBookmark.called).to.be.false
    expect(res.sendStatus.calledWith(403)).to.be.true
  })
})
