const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')
const AudioFile = require('../../../server/objects/files/AudioFile')

describe('PodcastEpisode model', () => {
  let previousSequelize
  let previousSettings
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })
  afterEach(async () => {
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  function rss(chapters) {
    return { title: 'Episode', season: '1', episode: '2', episodeType: 'full', subtitle: '', description: '', pubDate: 'Sun, 13 Sep 2020 12:26:40 GMT', enclosure: { url: 'https://example.com/episode.mp3', type: 'audio/mpeg', length: '123' }, publishedAt: 1600000000000, guid: 'guid', chapters }
  }
  function audio(chapters) {
    return new AudioFile({ ino: 'file', metadata: { filename: 'episode.mp3', size: 123 }, duration: 60, chapters })
  }

  it('imports RSS metadata and prefers embedded chapters without sharing references', async () => {
    const podcast = await Database.podcastModel.create({ title: 'Podcast' })
    const embedded = [{ id: 0, start: 0, end: 60, title: 'Embedded' }]
    const file = audio(embedded)
    const row = await Database.podcastEpisodeModel.createFromRssPodcastEpisode(rss([{ id: 1, start: 0, end: 60, title: 'RSS' }]), podcast.id, file)
    expect(row.chapters).to.deep.equal(embedded)
    expect(row.chapters[0]).not.to.equal(file.chapters[0])
    const stored = await Database.podcastEpisodeModel.findByPk(row.id)
    expect(stored.publishedAt.valueOf()).to.equal(1600000000000)
    expect(stored.extraData.guid).to.equal('guid')
    expect(stored.checkMatchesGuidOrEnclosureUrl('guid', null)).to.equal(true)
    expect(stored.checkMatchesGuidOrEnclosureUrl(null, 'https://example.com/episode.mp3')).to.equal(true)
    expect(stored.checkMatchesGuidOrEnclosureUrl('other', 'other')).to.equal(false)
    const json = stored.toOldJSONExpanded('item')
    expect(json.enclosure).to.deep.equal({ url: 'https://example.com/episode.mp3', type: 'audio/mpeg', length: '123' })
    expect(json).to.include({ size: 123, duration: 60, publishedAt: 1600000000000 })
    expect(json.audioTrack).to.include({ index: 1, startOffset: 0, title: 'episode.mp3', contentUrl: '/api/items/item/file/file' })
    json.audioFile.metadata.filename = 'changed'
    json.chapters[0].title = 'changed'
    expect(stored.audioFile.metadata.filename).to.equal('episode.mp3')
    expect(stored.chapters[0].title).to.equal('Embedded')
  })

  it('falls back to RSS chapters and handles absent enclosure metadata', async () => {
    const podcast = await Database.podcastModel.create({ title: 'Podcast' })
    const chapters = [{ id: 1, start: 0, end: 60, title: 'RSS' }]
    const feedEpisode = { ...rss(chapters), guid: null, enclosure: null, publishedAt: null }
    const row = await Database.podcastEpisodeModel.createFromRssPodcastEpisode(feedEpisode, podcast.id, audio([]))
    expect(row.chapters).to.deep.equal(chapters)
    expect(row.chapters[0]).not.to.equal(chapters[0])
    expect(row.toOldJSON('item')).to.include({ guid: null, enclosure: null, publishedAt: null })
    expect(() => row.toOldJSON()).to.throw('libraryItemId is not provided')
    await podcast.destroy()
    expect(await Database.podcastEpisodeModel.findByPk(row.id)).to.equal(null)
  })

  it('keeps empty size and duration defaults and the missing-audio playback error', () => {
    const row = Database.podcastEpisodeModel.build({ audioFile: null })
    expect(row.size).to.equal(0)
    expect(row.duration).to.equal(0)
    expect(() => row.getAudioTrack('item')).to.throw(TypeError)
  })
})
