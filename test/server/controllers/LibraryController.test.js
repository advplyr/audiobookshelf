const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const LibraryController = require('../../../server/controllers/LibraryController')
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
