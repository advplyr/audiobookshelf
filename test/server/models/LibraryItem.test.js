const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const fs = require('fs/promises')
const os = require('os')
const Path = require('path')
const Database = require('../../../server/Database')
const fsExtra = require('../../../server/libs/fsExtra')

describe('LibraryItem', () => {
  let previousSequelize
  let previousSettings
  let previousMetadataPath
  let tempDir
  let library
  let user
  let book
  let item
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    previousMetadataPath = global.MetadataPath
    tempDir = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-library-item-'))
    global.MetadataPath = tempDir
    global.ServerSettings = { metadataFileFormat: 'json', storeMetadataWithItem: false }
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book', settings: {} })
    user = await Database.userModel.create({ username: 'reader', isActive: true, permissions: { accessExplicitContent: true, accessAllTags: true } })
    book = await Database.bookModel.create({ title: 'Book', audioFiles: [], tags: [], genres: [], narrators: [], chapters: [], coverPath: 'cover.jpg' })
    const mediaPath = Path.join(tempDir, 'media')
    await fs.mkdir(mediaPath)
    item = await Database.libraryItemModel.create({ libraryId: library.id, mediaId: book.id, mediaType: 'book', libraryFiles: [], path: mediaPath, size: 10, isFile: false })
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
    global.MetadataPath = previousMetadataPath
    const resolved = Path.resolve(tempDir)
    if (!resolved.startsWith(Path.join(os.tmpdir(), 'abs-library-item-'))) throw new Error('Unexpected test directory')
    await fs.rm(resolved, { recursive: true, force: true })
  })

  it('expands media associations and preserves missing-item and cover lookup behavior', async () => {
    const expanded = await Database.libraryItemModel.getExpandedById(item.id)
    expect(expanded.media.authors).to.deep.equal([])
    expect(expanded.media.series).to.deep.equal([])
    expect(await Database.libraryItemModel.getCoverPath(item.id)).to.equal('cover.jpg')
    expect((await Database.libraryItemModel.findOneExpanded({ id: item.id })).id).to.equal(item.id)
    expect(await Database.libraryItemModel.getExpandedById('missing')).to.equal(null)
    expect(await Database.libraryItemModel.checkExistsById(item.id)).to.equal(true)
    const included = await Database.libraryItemModel.findByPk(item.id, { include: Database.bookModel })
    expect(included.media.id).to.equal(book.id)
    expect(included).not.to.have.property('book')
  })

  it('writes metadata outside media without adding a tracked library file', async () => {
    const expanded = await Database.libraryItemModel.getExpandedById(item.id)
    expect(await expanded.saveMetadataFile()).to.equal(undefined)
    const metadata = JSON.parse(await fs.readFile(Path.join(tempDir, 'items', item.id, 'metadata.json'), 'utf8'))
    expect(metadata).to.include({ title: 'Book', explicit: false, abridged: false })
    expect(metadata.authors).to.deep.equal([])
    expect(expanded.libraryFiles).to.deep.equal([])
  })

  it('tracks in-place metadata and lets Sequelize normalize numeric directory timestamps', async () => {
    global.ServerSettings.storeMetadataWithItem = true
    const expanded = await Database.libraryItemModel.getExpandedById(item.id)
    const file = await expanded.saveMetadataFile()
    expect(file.metadata.filename).to.equal('metadata.json')
    expect(expanded.libraryFiles).to.have.length(1)
    expect(expanded.mtime).to.be.instanceOf(Date)
    expect(expanded.ctime).to.be.instanceOf(Date)
    expect(expanded.size).to.be.greaterThan(0)
    expect(expanded.getLibraryFileWithIno(file.ino).fileType).to.equal('metadata')
    await expanded.saveMetadataFile()
    expect(expanded.libraryFiles).to.have.length(1)
    await expanded.reload()
    expect(expanded.mtime).to.be.instanceOf(Date)
    expect(expanded.toOldJSONMinified().size).to.be.a('number')
  })

  it('preserves failed metadata write handling and missing-media serialization errors', async () => {
    const expanded = await Database.libraryItemModel.getExpandedById(item.id)
    sinon.stub(fsExtra, 'writeFile').rejects(new Error('Test write failure'))
    expect(await expanded.saveMetadataFile()).to.equal(null)
    expect(() => item.toOldJSON()).to.throw('Cannot convert to old JSON without media')
    expect(item.getTrackList()).to.deep.equal([])
  })

  it('builds filtered JSON and personalized shelves using the migrated queries', async () => {
    const result = await Database.libraryItemModel.getByFilterAndSort(library, user, { filterBy: null, sortBy: 'addedAt', sortDesc: false, limit: 10, offset: 0, collapseseries: false, include: [], mediaType: 'book' })
    expect(result.count).to.equal(1)
    expect(result.libraryItems[0]).to.include({ id: item.id })
    expect(result.libraryItems[0].media.size).to.equal(10)
    const shelves = await Database.libraryItemModel.getPersonalizedShelves(library, user, [], 10)
    expect(shelves.map((shelf) => shelf.id)).to.deep.equal(['recently-added', 'discover'])
    expect(shelves[0].entities[0].id).to.equal(item.id)
  })
})
