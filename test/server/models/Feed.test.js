const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

describe('Feed model', () => {
  let previousSequelize
  let previousSettings
  let library
  let user
  let book
  let item
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    sinon.stub(Logger, 'error')
    library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book' })
    user = await Database.userModel.create({ username: 'test' })
    book = await Database.bookModel.create({ title: 'Book', coverPath: '/cover.jpg', description: '<p>Summary</p>', audioFiles: [audio('one'), audio('two')], chapters: [], tags: [], genres: [], narrators: [] })
    item = await Database.libraryItemModel.create({ libraryId: library.id, mediaType: 'book', mediaId: book.id, libraryFiles: [] })
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })
  function audio(ino) {
    return { ino, duration: 10, mimeType: 'audio/mpeg', metadata: { filename: `${ino}.mp3`, path: `/${ino}.mp3`, size: 123 } }
  }
  async function createBookFeed(options = null) {
    const expanded = await Database.libraryItemModel.getExpandedById(item.id)
    return Database.feedModel.createFeedForLibraryItem(user.id, expanded, 'book', 'https://example.com', options)
  }

  it('creates audiobook feeds, normalizes polymorphic associations and renders XML', async () => {
    const feed = await createBookFeed({ preventIndexing: true, ownerName: 'Owner', ownerEmail: 'owner@example.com' })
    expect(feed.feedEpisodes).to.have.length(2)
    expect(feed.toOldJSON()).to.include({ entityType: 'libraryItem', entityId: item.id, serverAddress: 'https://example.com' })
    expect(feed.toOldJSON().meta).to.include({ preventIndexing: true, ownerName: 'Owner', ownerEmail: 'owner@example.com' })
    expect(feed.getEpisodePath(feed.feedEpisodes[0].id)).to.equal('/one.mp3')
    expect(feed.getEpisodePath('missing')).to.equal(null)
    expect((await feed.getEntity()).id).to.equal(item.id)
    const eager = await Database.feedModel.findByPk(feed.id, { include: Database.libraryItemModel })
    expect(eager.entity.id).to.equal(item.id)
    expect(eager.dataValues).not.to.have.property('libraryItem')
    const xml = feed.buildXml('https://example.com')
    expect(xml).to.include('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).to.include('<itunes:name>Owner</itunes:name>')
    expect(xml).to.include('<itunes:email>owner@example.com</itunes:email>')
    expect(xml).to.include('<itunes:block>yes</itunes:block>')
    expect(xml).to.include('<googleplay:block>yes</googleplay:block>')
    expect(xml).to.include('<![CDATA[<p>Summary</p>]]>')
    expect((xml.match(/<item>/g) || [])).to.have.length(2)
  })

  it('updates an existing feed and removes stale episodes in the transaction', async () => {
    const feed = await createBookFeed()
    const retainedId = feed.feedEpisodes[0].id
    await book.update({ title: 'Updated', audioFiles: [audio('one')] })
    const updated = await feed.updateFeedForEntity()
    expect(updated.title).to.equal('Updated')
    expect(updated.feedEpisodes).to.have.length(1)
    expect(updated.feedEpisodes[0].id).to.equal(retainedId)
    expect(await Database.feedEpisodeModel.count({ where: { feedId: feed.id } })).to.equal(1)
    expect((await Database.feedModel.findByPk(feed.id)).title).to.equal('Updated')
    expect(await Database.feedModel.removeById(feed.id)).to.equal(true)
    expect(await Database.feedModel.removeById(feed.id)).to.equal(false)
    expect(await Database.feedEpisodeModel.count()).to.equal(0)
  })

  it('rolls back feed creation and updates when episode persistence fails', async () => {
    const stub = sinon.stub(Database.feedEpisodeModel, 'createFromAudiobookTracks').rejects(new Error('test failure'))
    expect(await createBookFeed()).to.equal(null)
    expect(await Database.feedModel.count()).to.equal(0)
    stub.restore()
    const feed = await createBookFeed()
    await book.update({ title: 'Updated' })
    sinon.stub(Database.feedEpisodeModel, 'createFromAudiobookTracks').rejects(new Error('test failure'))
    expect(await feed.updateFeedForEntity()).to.equal(null)
    expect((await Database.feedModel.findByPk(feed.id)).title).to.equal('Book')
    expect(await Database.feedEpisodeModel.count()).to.equal(2)
  })

  it('creates podcast, collection and series feeds with their existing metadata', async () => {
    const podcast = await Database.podcastModel.create({ title: 'Podcast', author: 'Podcaster', podcastType: 'episodic' })
    const podcastItem = await Database.libraryItemModel.create({ libraryId: library.id, mediaId: podcast.id, mediaType: 'podcast', libraryFiles: [] })
    await Database.podcastEpisodeModel.create({ title: 'Episode', podcastId: podcast.id, pubDate: '2020-01-01', audioFile: audio('episode') })
    const podcastExpanded = await Database.libraryItemModel.getExpandedById(podcastItem.id)
    const podcastFeed = await Database.feedModel.createFeedForLibraryItem(user.id, podcastExpanded, 'podcast', 'https://example.com')
    expect(podcastFeed).to.include({ author: 'Podcaster', podcastType: 'episodic', imageURL: '/Logo.png' })
    expect(podcastFeed.feedEpisodes).to.have.length(1)
    expect((await podcastFeed.updateFeedForEntity()).feedEpisodes).to.have.length(1)
    const collection = await Database.collectionModel.create({ name: 'Collection', libraryId: library.id })
    await Database.collectionBookModel.create({ collectionId: collection.id, bookId: book.id, order: 1 })
    const collectionExpanded = await Database.collectionModel.getExpandedById(collection.id)
    const collectionFeed = await Database.feedModel.createFeedForCollection(user.id, collectionExpanded, 'collection', 'https://example.com')
    expect(collectionFeed).to.include({ entityType: 'collection', title: 'Collection', siteURL: `/collection/${collection.id}` })
    expect((await collectionFeed.updateFeedForEntity()).feedEpisodes).to.have.length(2)
    const series = await Database.seriesModel.create({ name: 'Series', libraryId: library.id })
    await Database.bookSeriesModel.create({ seriesId: series.id, bookId: book.id, sequence: '1' })
    const seriesExpanded = await Database.seriesModel.getExpandedById(series.id)
    const seriesFeed = await Database.feedModel.createFeedForSeries(user.id, seriesExpanded, 'series', 'https://example.com')
    expect(seriesFeed).to.include({ entityType: 'series', title: 'Series', siteURL: `/library/${library.id}/series/${series.id}` })
    expect((await seriesFeed.updateFeedForEntity()).feedEpisodes).to.have.length(2)
  })

  it('preserves cover cache busting, invalid-entity results and empty serialization defaults', async () => {
    const epoch = new Date(1600000000000)
    expect(Database.feedModel.getFeedImageURL('slug', null, epoch)).to.equal('/Logo.png')
    expect(Database.feedModel.getFeedImageURL('slug', '/cover.jpg', epoch)).to.equal('/feed/slug/cover.jpg?ts=1600000000000')
    const feed = Database.feedModel.build({ entityType: 'unsupported', entityUpdatedAt: new Date(0), createdAt: epoch, updatedAt: epoch })
    expect(await feed.updateFeedForEntity()).to.equal(null)
    expect(feed.toOldJSON().episodes).to.deep.equal([])
    expect(feed.toOldJSON().entityUpdatedAt).to.equal(null)
    feed.entityType = null
    expect(await feed.getEntity()).to.equal(null)
  })
})
