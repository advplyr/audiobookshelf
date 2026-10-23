const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

describe('Podcast model', () => {
  let previousSequelize
  let previousSettings
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = { sortingPrefixes: ['the'], podcastEpisodeSchedule: '0 * * * *' }
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    sinon.stub(Logger, 'error')
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('validates request arrays, converts metadata numbers and sanitizes descriptions', async () => {
    const payload = { metadata: { title: 'The Podcast', author: 123, description: '<p>Safe<script>alert(1)</script></p>', genres: ['news', ''], explicit: 1 }, tags: ['valid', 4], autoDownloadEpisodes: true }
    const row = await Database.podcastModel.createFromRequest(payload)
    expect(row).to.include({ title: 'The Podcast', titleIgnorePrefix: 'Podcast', author: '123', description: '<p>Safe</p>', explicit: true, autoDownloadEpisodes: true, autoDownloadSchedule: '0 * * * *', maxNewEpisodesToDownload: 3, maxEpisodesToKeep: 0 })
    expect(row.genres).to.deep.equal([])
    expect(row.tags).to.deep.equal([])
    expect(payload.metadata.author).to.equal('123')
    // Title is captured before numeric metadata conversion in the legacy implementation.
    const numeric = { metadata: { title: 123 } }
    const untitled = await Database.podcastModel.createFromRequest(numeric)
    expect(untitled.title).to.equal(null)
    expect(untitled.titleIgnorePrefix).to.equal('')
    expect(numeric.metadata.title).to.equal('123')
  })

  it('updates aliases and timestamps while rejecting malformed arrays', async () => {
    const row = await Database.podcastModel.createFromRequest({ metadata: { title: 'Original' } })
    const payload = { metadata: { title: 'The Updated', feedUrl: 123, type: 'serial', description: '<b>Safe</b><script>bad()</script>', genres: ['news'] }, tags: ['tag'], lastEpisodeCheck: 1600000000000, maxEpisodesToKeep: 4, autoDownloadSchedule: '*/5 * * * *' }
    expect(await row.updateFromRequest(payload)).to.equal(true)
    await row.reload()
    expect(row).to.include({ title: 'The Updated', titleIgnorePrefix: 'Updated', feedURL: '123', podcastType: 'serial', description: '<b>Safe</b>', maxEpisodesToKeep: 4 })
    expect(row.lastEpisodeCheck.valueOf()).to.equal(1600000000000)
    expect(row.tags).to.deep.equal(['tag'])
    expect(row.genres).to.deep.equal(['news'])
    expect(payload.metadata.description).to.equal('<b>Safe</b>')
    expect(await row.updateFromRequest({ metadata: { genres: [1], title: 'The Updated' }, tags: [1] })).to.equal(false)
    expect(await row.updateFromRequest(null)).to.equal(false)
  })

  it('exposes expanded playback data and legacy JSON without sharing chapter arrays', async () => {
    const row = await Database.podcastModel.create({ title: 'The Podcast', author: 'Author', tags: ['tag'], genres: [] })
    const episode = await Database.podcastEpisodeModel.create({ podcastId: row.id, title: 'Episode', publishedAt: 1600000000000, audioFile: { ino: 'file', metadata: { filename: 'episode.mp3', size: 123 }, mimeType: 'audio/mpeg', duration: 60 }, chapters: [{ id: 0, start: 0, end: 60, title: 'Chapter' }] })
    await row.reload({ include: Database.podcastEpisodeModel })
    expect(row.hasMediaFiles).to.equal(true)
    expect(row.hasAudioTracks).to.equal(true)
    expect(row.size).to.equal(123)
    expect(row.checkCanDirectPlay(['audio/mpeg'], episode.id)).to.equal(true)
    expect(row.getTracklist('item', episode.id)[0].contentUrl).to.equal('/api/items/item/file/file')
    expect(row.getPlaybackTitle(episode.id)).to.equal('Episode')
    expect(row.getPlaybackAuthor()).to.equal('Author')
    expect(row.getPlaybackDuration(episode.id)).to.equal(60)
    expect(row.getLatestEpisodePublishedAt()).to.equal(1600000000000)
    expect(row.checkHasEpisodeByFeedEpisode({ guid: null, enclosure: { url: 'missing' } })).to.equal(false)
    const chapters = row.getChapters(episode.id)
    chapters[0].title = 'Changed'
    expect(row.podcastEpisodes[0].chapters[0].title).to.equal('Chapter')
    const minified = row.toOldJSONMinified()
    const expanded = row.toOldJSONExpanded('item')
    expect(expanded).to.deep.include(minified)
    expect(expanded.episodes).to.have.length(1)
    expect(expanded.metadata.titleIgnorePrefix).to.equal('Podcast, The')
    expect(row.toOldJSON('item').episodes).to.have.length(1)
  })

  it('preserves missing-episode defaults and missing-expansion errors', () => {
    const row = Database.podcastModel.build({ title: null })
    expect(row.hasMediaFiles).to.equal(false)
    expect(row.size).to.equal(0)
    expect(row.toOldJSONMinified().metadata.titleIgnorePrefix).to.equal(null)
    expect(() => row.toOldJSON('item')).to.throw('episodes are not provided')
    expect(() => row.toOldJSONExpanded('')).to.throw('libraryItemId is not provided')
    row.podcastEpisodes = []
    expect(row.checkCanDirectPlay(null, 'missing')).to.equal(false)
    expect(row.checkCanDirectPlay([], 'missing')).to.equal(false)
    expect(row.getTracklist('item', 'missing')).to.deep.equal([])
    expect(row.getChapters('missing')).to.deep.equal([])
    expect(row.getPlaybackTitle('missing')).to.equal('')
    expect(row.getPlaybackDuration('missing')).to.equal(0)
    expect(row.getLatestEpisodePublishedAt()).to.equal(0)
  })
})
