const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const LibraryController = require('../../../server/controllers/LibraryController')
const libraryHelpers = require('../../../server/utils/libraryHelpers')
const zipHelpers = require('../../../server/utils/zipHelpers')
const Logger = require('../../../server/Logger')

describe('LibraryController.downloadMultiple', () => {
  let library
  let libraryFolder
  let allowedItemId
  let explicitItemId
  let taggedItemId
  let restrictedUser
  let libraryRecord

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    libraryFolder = await Database.libraryFolderModel.create({ path: '/test-lib', libraryId: library.id })
    libraryRecord = await Database.libraryModel.findByIdWithFolders(library.id)

    const allowedBook = await Database.bookModel.create({
      title: 'Allowed Book',
      explicit: false,
      audioFiles: [],
      tags: ['allowed-tag'],
      narrators: [],
      genres: [],
      chapters: []
    })
    const allowedItem = await Database.libraryItemModel.create({
      path: '/test-lib/allowed',
      isFile: false,
      libraryFiles: [],
      mediaId: allowedBook.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })
    allowedItemId = allowedItem.id

    const explicitBook = await Database.bookModel.create({
      title: 'Explicit Book',
      explicit: true,
      audioFiles: [],
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })
    const explicitItem = await Database.libraryItemModel.create({
      path: '/test-lib/explicit',
      isFile: false,
      libraryFiles: [],
      mediaId: explicitBook.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })
    explicitItemId = explicitItem.id

    const taggedBook = await Database.bookModel.create({
      title: 'Tagged Book',
      explicit: false,
      audioFiles: [],
      tags: ['restricted-tag'],
      narrators: [],
      genres: [],
      chapters: []
    })
    const taggedItem = await Database.libraryItemModel.create({
      path: '/test-lib/tagged',
      isFile: false,
      libraryFiles: [],
      mediaId: taggedBook.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })
    taggedItemId = taggedItem.id

    const permissions = Database.userModel.getDefaultPermissionsForUserType('user')
    permissions.download = true
    permissions.accessExplicitContent = false
    permissions.accessAllLibraries = false
    permissions.accessAllTags = false
    permissions.librariesAccessible = [library.id]
    permissions.itemTagsSelected = ['allowed-tag']
    permissions.selectedTagsNotAccessible = false

    restrictedUser = await Database.userModel.create({
      username: 'restricted',
      pash: 'hash',
      token: 'token',
      type: 'user',
      isActive: true,
      permissions,
      bookmarks: [],
      extraData: {}
    })

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
    sinon.stub(zipHelpers, 'zipDirectoriesPipe').resolves()
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  function makeReq(ids) {
    return {
      query: { ids: ids.join(',') },
      user: restrictedUser,
      library: libraryRecord
    }
  }

  function makeRes() {
    return {
      sendStatus: sinon.spy(),
      status: sinon.stub().returnsThis(),
      send: sinon.spy()
    }
  }

  it('returns 403 for bulk download of an explicit item', async () => {
    const req = makeReq([explicitItemId])
    const res = makeRes()

    await LibraryController.downloadMultiple(req, res)

    expect(res.sendStatus.calledWith(403)).to.be.true
    expect(zipHelpers.zipDirectoriesPipe.called).to.be.false
  })

  it('returns 403 for bulk download of a tag-restricted item', async () => {
    const req = makeReq([taggedItemId])
    const res = makeRes()

    await LibraryController.downloadMultiple(req, res)

    expect(res.sendStatus.calledWith(403)).to.be.true
    expect(zipHelpers.zipDirectoriesPipe.called).to.be.false
  })

  it('returns 403 when bulk download includes both allowed and forbidden items', async () => {
    const req = makeReq([allowedItemId, explicitItemId])
    const res = makeRes()

    await LibraryController.downloadMultiple(req, res)

    expect(res.sendStatus.calledWith(403)).to.be.true
    expect(zipHelpers.zipDirectoriesPipe.called).to.be.false
  })

  it('starts zip download for allowed items only', async () => {
    const req = makeReq([allowedItemId])
    const res = makeRes()

    await LibraryController.downloadMultiple(req, res)

    expect(res.sendStatus.called).to.be.false
    expect(zipHelpers.zipDirectoriesPipe.calledOnce).to.be.true
    const pathObjects = zipHelpers.zipDirectoriesPipe.firstCall.args[0]
    expect(pathObjects).to.have.length(1)
    expect(pathObjects[0].path).to.equal('/test-lib/allowed')
  })
})

describe('LibraryController.getLibraryItems', () => {
  let library
  let filteredSeries
  let user

  beforeEach(async () => {
    global.ServerSettings = { sortingIgnorePrefix: false }
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    library = await Database.libraryModel.create({
      name: 'Test Library',
      mediaType: 'book',
      settings: { hideSingleBookSeries: false }
    })
    filteredSeries = await Database.seriesModel.create({ name: 'Filtered Series', libraryId: library.id })
    user = {}
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
  })

  function getSeriesFilter() {
    return `series.${encodeURIComponent(Buffer.from(filteredSeries.id).toString('base64'))}`
  }

  it('uses the collapse helper for a specific series filter', async () => {
    const collapseStub = sinon.stub(libraryHelpers, 'handleCollapseSubseries').callsFake(async (payload) => {
      payload.total = 1
      return [{ id: 'collapsed-item' }]
    })
    const res = { json: sinon.spy() }

    await LibraryController.getLibraryItems(
      {
        query: {
          filter: getSeriesFilter(),
          collapseseries: '1',
          sort: 'media.metadata.authorName',
          desc: '0'
        },
        user,
        library
      },
      res
    )

    expect(collapseStub.calledOnce).to.be.true
    expect(collapseStub.firstCall.args[1]).to.equal(filteredSeries.id)
    expect(res.json.calledOnce).to.be.true
    expect(res.json.firstCall.args[0]).to.include({ total: 1, collapseseries: true })
    expect(res.json.firstCall.args[0].results).to.deep.equal([{ id: 'collapsed-item' }])
  })

  it('uses the normal query path when series collapsing is disabled', async () => {
    const collapseStub = sinon.stub(libraryHelpers, 'handleCollapseSubseries')
    const queryStub = sinon.stub(Database.libraryItemModel, 'getByFilterAndSort').resolves({
      libraryItems: [{ id: 'regular-item' }],
      count: 1
    })
    const res = { json: sinon.spy() }

    await LibraryController.getLibraryItems(
      {
        query: {
          filter: getSeriesFilter(),
          collapseseries: '0',
          sort: 'media.metadata.authorName',
          desc: '0'
        },
        user,
        library
      },
      res
    )

    expect(collapseStub.called).to.be.false
    expect(queryStub.calledOnce).to.be.true
    expect(queryStub.firstCall.args[2].collapseseries).to.equal(false)
    expect(res.json.firstCall.args[0]).to.include({ total: 1, collapseseries: false })
    expect(res.json.firstCall.args[0].results).to.deep.equal([{ id: 'regular-item' }])
  })
})
