const { expect } = require('chai')
const sinon = require('sinon')
const fs = require('fs/promises')
const os = require('os')
const Path = require('path')
const Database = require('../../server/Database')
const packageJson = require('../../package.json')

describe('Database', () => {
  let previousState
  let previousGlobals
  let previousEnvironment
  let tempDir
  beforeEach(async () => {
    previousState = { ...Database }
    previousGlobals = { ConfigPath: global.ConfigPath, MetadataPath: global.MetadataPath, ServerSettings: global.ServerSettings }
    const envKeys = ['QUERY_LOGGING', 'NUSQLITE3_PATH', 'SQLITE_MMAP_SIZE', 'SQLITE_CACHE_SIZE', 'SQLITE_TEMP_STORE']
    previousEnvironment = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
    envKeys.forEach((key) => delete process.env[key])
    tempDir = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-database-'))
    global.ConfigPath = tempDir
    global.MetadataPath = tempDir
    global.ServerSettings = { sortingPrefixes: [], sortingIgnorePrefix: false }
    Database.dbPath = ':memory:'
    Database.isNew = false
    Database.hasRootUser = false
    Database.libraryFilterData = {}
    Database.supportsUnaccent = false
    Database.supportsUnicodeFoldings = false
    expect(await Database.connect()).to.equal(true)
    await Database.buildModels()
  })
  afterEach(async () => {
    sinon.restore()
    await Database.disconnect()
    Object.assign(Database, previousState)
    Object.assign(global, previousGlobals)
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    const resolved = Path.resolve(tempDir)
    if (!resolved.startsWith(Path.join(os.tmpdir(), 'abs-database-'))) throw new Error('Unexpected test directory')
    await fs.rm(resolved, { recursive: true, force: true })
  })

  it('initializes and reopens an isolated database with settings and migration metadata', async () => {
    await Database.disconnect()
    await Database.init()
    expect(Database.isNew).to.equal(true)
    expect(Object.keys(Database.models)).to.have.length(25)
    expect(Database.serverSettings.version).to.equal(packageJson.version)
    expect(Database.serverSettings.buildNumber).to.equal(packageJson.buildNumber)
    Database.serverSettings.sortingIgnorePrefix = true
    await Database.updateServerSettings()
    await Database.disconnect()
    await Database.reconnect()
    expect(Database.isNew).to.equal(false)
    expect(Database.serverSettings.sortingIgnorePrefix).to.equal(true)
    expect(global.ServerSettings.sortingIgnorePrefix).to.equal(true)
    expect(Database.hasRootUser).to.equal(false)
    expect(await Database.checkHasDb()).to.equal(true)
  })

  it('keeps title and author triggers idempotent and synchronizes library item columns', async () => {
    await Database.addTriggers()
    await Database.addTriggers()
    const library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book' })
    const book = await Database.bookModel.create({ title: 'Original' })
    const item = await Database.libraryItemModel.create({ libraryId: library.id, mediaId: book.id, mediaType: 'book' })
    await book.update({ title: 'The New Title', titleIgnorePrefix: 'New Title' })
    await item.reload()
    expect(item.title).to.equal('The New Title')
    expect(item.titleIgnorePrefix).to.equal('New Title')
    const author = await Database.authorModel.create({ name: 'First Last', lastFirst: 'Last, First', libraryId: library.id })
    const join = await Database.bookAuthorModel.create({ bookId: book.id, authorId: author.id })
    await item.reload()
    expect(item.authorNamesFirstLast).to.equal('First Last')
    expect(item.authorNamesLastFirst).to.equal('Last, First')
    await author.update({ name: 'Other Writer', lastFirst: 'Writer, Other' })
    await item.reload()
    expect(item.authorNamesFirstLast).to.equal('Other Writer')
    await join.destroy()
    await item.reload()
    expect(item.authorNamesFirstLast).to.equal(null)
    const podcast = await Database.podcastModel.create({ title: 'Podcast' })
    const podcastItem = await Database.libraryItemModel.create({ libraryId: library.id, mediaId: podcast.id, mediaType: 'podcast' })
    await podcast.update({ title: 'Renamed Podcast', titleIgnorePrefix: 'Renamed Podcast' })
    await podcastItem.reload()
    expect(podcastItem.title).to.equal('Renamed Podcast')
    expect(podcastItem.titleIgnorePrefix).to.equal('Renamed Podcast')
  })

  it('commits root creation once and rolls back a failed creation', async () => {
    const auth = { generateAccessToken: sinon.stub().returns('test-token') }
    sinon.stub(Database.userModel, 'createRootUser').rejects(new Error('Test root failure'))
    try {
      await Database.createRootUser('root', 'test-hash', auth)
      throw new Error('Expected root creation to fail')
    } catch (error) {
      expect(error.message).to.equal('Test root failure')
    }
    expect(await Database.userModel.count()).to.equal(0)
    expect(Database.hasRootUser).to.equal(false)
    Database.userModel.createRootUser.restore()
    expect(await Database.createRootUser('root', 'test-hash', auth)).to.equal(true)
    expect(await Database.createRootUser('another', 'test-hash', auth)).to.equal(false)
    expect(Database.hasRootUser).to.equal(true)
    expect(await Database.userModel.count()).to.equal(1)
  })

  it('cleans orphan media, empty series, short playback, duplicate progress and expired authentication', async () => {
    const user = await Database.userModel.create({ username: 'reader' })
    await Database.bookModel.create({ title: 'Orphan book' })
    await Database.podcastModel.create({ title: 'Orphan podcast' })
    await Database.seriesModel.create({ name: 'Empty series' })
    const book = await Database.bookModel.create({ title: 'Valid book' })
    const library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book' })
    await Database.libraryItemModel.create({ libraryId: library.id, mediaId: book.id, mediaType: 'book' })
    await Database.playbackSessionModel.bulkCreate([{ timeListening: 3 }, { timeListening: 4 }])
    const oldProgress = await Database.mediaProgressModel.create({ userId: user.id, mediaItemId: book.id, mediaItemType: 'book', updatedAt: new Date(2020, 0, 1) })
    const newProgress = await Database.mediaProgressModel.create({ userId: user.id, mediaItemId: book.id, mediaItemType: 'book', updatedAt: new Date(2021, 0, 1) })
    await Database.sessionModel.createSession(user.id, null, null, 'test-expired-token', new Date(2000, 0, 1))
    await Database.sessionModel.createSession(user.id, null, null, 'test-current-token', new Date(2100, 0, 1))
    const apiKey = await Database.apiKeyModel.create({ name: 'Expired test key', isActive: true, expiresAt: new Date(2000, 0, 1), userId: user.id })
    await Database.cleanDatabase()
    expect(await Database.bookModel.count()).to.equal(1)
    expect(await Database.podcastModel.count()).to.equal(0)
    expect(await Database.seriesModel.count()).to.equal(0)
    expect(await Database.playbackSessionModel.count()).to.equal(1)
    expect(await Database.mediaProgressModel.findByPk(oldProgress.id)).to.equal(null)
    expect(await Database.mediaProgressModel.findByPk(newProgress.id)).not.to.equal(null)
    expect(await Database.sessionModel.count()).to.equal(1)
    await apiKey.reload()
    expect(apiKey.isActive).to.equal(false)
  })

  it('preserves SQL escaping and accent-sensitive search expression selection', async () => {
    const plain = await Database.createTextSearchQuery("O'Brien")
    expect(plain.matchExpression('title')).to.equal("title LIKE '%O''Brien%'")
    Database.supportsUnaccent = true
    const query = sinon.stub(Database.sequelize, 'query').resolves([[{ normalized_query: 'cafe' }], {}])
    const accented = await Database.createTextSearchQuery('café')
    expect(accented.hasAccents).to.equal(true)
    expect(accented.matchExpression('title')).to.equal("title LIKE '%café%'")
    const normalized = await Database.createTextSearchQuery('cafe')
    expect(normalized.matchExpression('title')).to.equal("unaccent(title) LIKE '%cafe%'")
    expect(query.firstCall.args[0]).to.equal("SELECT unaccent('café') as normalized_query")
  })
})
