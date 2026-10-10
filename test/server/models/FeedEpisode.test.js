const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')

describe('FeedEpisode model', () => {
  let previousSequelize
  let previousSettings
  let library
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book' })
  })
  afterEach(async () => {
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  function audio(ino, duration = 10) {
    return { ino, duration, mimeType: 'audio/mpeg', metadata: { filename: `${ino}.mp3`, path: `/${ino}.mp3`, size: 123 } }
  }
  async function feed(entityId, podcastType = 'serial') {
    return Database.feedModel.create({ slug: 'test', entityId, entityType: 'libraryItem', author: 'Author', siteURL: '/item/test', podcastType })
  }

  it('orders podcast episodes and reuses existing IDs when upserting media', async () => {
    const podcast = await Database.podcastModel.create({ title: 'Podcast' })
    const item = await Database.libraryItemModel.create({ libraryId: library.id, mediaId: podcast.id, mediaType: 'podcast', libraryFiles: [] })
    await Database.podcastEpisodeModel.create({ podcastId: podcast.id, title: 'Older', pubDate: '2020-01-01', audioFile: audio('older') })
    await Database.podcastEpisodeModel.create({ podcastId: podcast.id, title: 'Newer', pubDate: '2021-01-01', audioFile: audio('newer') })
    const expanded = await Database.libraryItemModel.getExpandedById(item.id)
    const rssFeed = await feed(item.id, 'episodic')
    const rows = await Database.sequelize.transaction((transaction) => Database.feedEpisodeModel.createFromPodcastEpisodes(expanded, rssFeed, 'test', transaction))
    expect(rows.map((row) => row.title)).to.deep.equal(['Newer', 'Older'])
    expect(rows[0].enclosureURL).to.equal(`/feed/test/item/${rows[0].id}/media.mp3`)
    rssFeed.feedEpisodes = rows
    rssFeed.podcastType = 'serial'
    expanded.media.podcastEpisodes[0].title = 'Updated'
    const updated = await Database.feedEpisodeModel.createFromPodcastEpisodes(expanded, rssFeed, 'test')
    expect(updated.map((row) => row.filePath)).to.deep.equal(['/older.mp3', '/newer.mp3'])
    expect(updated[1].id).to.equal(rows[0].id)
    expect((await Database.feedEpisodeModel.findByPk(rows[0].id)).title).to.equal('Updated')
    expect(await Database.feedEpisodeModel.count()).to.equal(2)
    await rssFeed.destroy()
    expect(await Database.feedEpisodeModel.count()).to.equal(0)
  })

  it('uses matching chapter titles and one-minute offsets for audiobook tracks', async () => {
    const book = await Database.bookModel.create({ title: 'Book', audioFiles: [audio('one'), audio('two')], chapters: [{ id: 0, start: 0, end: 10, title: 'First chapter' }, { id: 1, start: 10, end: 20, title: 'Second chapter' }], tags: [], genres: [], narrators: [] })
    const item = await Database.libraryItemModel.create({ libraryId: library.id, mediaId: book.id, mediaType: 'book', libraryFiles: [], createdAt: new Date('2020-01-01T00:00:00Z') })
    const expanded = await Database.libraryItemModel.getExpandedById(item.id)
    const rssFeed = await feed(item.id)
    const rows = await Database.feedEpisodeModel.createFromAudiobookTracks(expanded, rssFeed, 'test')
    expect(rows.map((row) => row.title)).to.deep.equal(['First chapter', 'Second chapter'])
    expect(new Date(rows[1].pubDate).valueOf() - new Date(rows[0].pubDate).valueOf()).to.equal(60000)
    expect(Database.feedEpisodeModel.checkUseChapterTitlesForEpisodes(book.getTracklist(item.id), book)).to.equal(true)
    book.chapters[1].start = 11
    expect(Database.feedEpisodeModel.checkUseChapterTitlesForEpisodes(book.getTracklist(item.id), book)).to.equal(false)
    book.audioFiles = [audio('one')]
    const single = Database.feedEpisodeModel.getFeedEpisodeObjFromAudiobookTrack(book, item.createdAt, rssFeed, 'test', book.getTracklist(item.id)[0], true, 0, 'fixed-id')
    expect(single).to.include({ id: 'fixed-id', title: 'Book', enclosureURL: '/feed/test/item/fixed-id/media.mp3' })
  })

  it('creates collection episodes in book order and handles empty collections', async () => {
    const books = []
    for (const [index, title] of ['First', 'Second'].entries()) {
      const book = await Database.bookModel.create({ title, audioFiles: [audio(title.toLowerCase())], chapters: [] })
      book.libraryItem = await Database.libraryItemModel.create({ libraryId: library.id, mediaId: book.id, mediaType: 'book', libraryFiles: [], createdAt: new Date(1600000000000 + index * 100000) })
      books.push(book)
    }
    const rssFeed = await feed(books[0].libraryItem.id)
    const rows = await Database.feedEpisodeModel.createFromBooks(books.reverse(), rssFeed, 'test')
    expect(rows.map((row) => row.title)).to.deep.equal(['Second', 'First'])
    expect(new Date(rows[1].pubDate).valueOf() - new Date(rows[0].pubDate).valueOf()).to.equal(60000)
    expect(await Database.feedEpisodeModel.createFromBooks([], rssFeed, 'test')).to.deep.equal([])
  })

  it('preserves RSS fields, CDATA, duration rounding and explicit false', () => {
    const row = Database.feedEpisodeModel.build({ id: 'episode', title: 'Episode', description: '<p>Summary</p>', author: null, duration: 60.6, explicit: false, enclosureURL: '/audio.mp3', enclosureType: 'audio/mpeg', enclosureSize: '123', siteURL: '/item/test', pubDate: '2020-01-01' })
    const rss = row.getRSSData('https://example.com')
    expect(rss.guid).to.equal('https://example.com/audio.mp3')
    expect(rss.enclosure).to.deep.equal({ url: 'https://example.com/audio.mp3', type: 'audio/mpeg', size: '123' })
    expect(rss.custom_elements).to.deep.equal([{ 'itunes:duration': 61 }, { 'itunes:explicit': false }, { 'itunes:summary': { _cdata: '<p>Summary</p>' } }])
    expect(row.getOldEpisode()).to.include({ id: 'episode', duration: 60.6, explicit: false })
  })
})
