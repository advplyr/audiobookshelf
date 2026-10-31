const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')

describe('author links, providers and sessions', () => {
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

  it('groups author counts and preserves missing-author behavior', async () => {
    const first = await Database.bookModel.create({ title: 'First' })
    const second = await Database.bookModel.create({ title: 'Second' })
    const author = await Database.authorModel.create({ name: 'Author' })
    const other = await Database.authorModel.create({ name: 'Other' })
    await Database.bookAuthorModel.create({ bookId: first.id, authorId: author.id })
    await Database.bookAuthorModel.create({ bookId: second.id, authorId: author.id })
    expect(await Database.bookAuthorModel.getCountsForAuthors([])).to.deep.equal({})
    expect(await Database.bookAuthorModel.getCountsForAuthors([author.id, other.id])).to.deep.equal({ [author.id]: 2 })
    expect(await Database.bookAuthorModel.getCountForAuthor(other.id)).to.equal(0)
    expect(await Database.bookAuthorModel.removeByIds(author.id, first.id)).to.equal(1)
    expect(await Database.bookAuthorModel.getCountForAuthor(author.id)).to.equal(1)
    await author.destroy()
    expect(await Database.bookAuthorModel.count()).to.equal(0)
  })

  it('exposes only the existing client provider fields and round-trips JSON', async () => {
    const provider = await Database.customMetadataProviderModel.create({
      name: 'Provider', mediaType: 'book', url: 'https://example.com', authHeaderValue: 'test-placeholder', extraData: { options: ['one'] }
    })
    const saved = await Database.customMetadataProviderModel.findByPk(provider.id)
    expect(saved.extraData).to.deep.equal({ options: ['one'] })
    expect(await Database.customMetadataProviderModel.getForClientByMediaType('book')).to.deep.equal([
      { id: provider.id, name: 'Provider', mediaType: 'book', slug: `custom-${provider.id}` }
    ])
    expect(await Database.customMetadataProviderModel.getForClientByMediaType('podcast')).to.deep.equal([])
    expect(await Database.customMetadataProviderModel.checkExistsBySlug(provider.getSlug())).to.equal(true)
    expect(await Database.customMetadataProviderModel.checkExistsBySlug(null)).to.equal(false)
    expect(await Database.customMetadataProviderModel.checkExistsBySlug('invalid')).to.equal(false)
  })

  it('cleans expired sessions and preserves live sessions and nullable token fields', async () => {
    const user = await Database.userModel.create({ username: 'test' })
    const expired = await Database.sessionModel.createSession(user.id, null, undefined, 'expired-placeholder', new Date(Date.now() - 60000))
    const live = await Database.sessionModel.createSession(user.id, '127.0.0.1', 'test-agent', 'live-placeholder', new Date(Date.now() + 60000))
    expect(await Database.sessionModel.cleanupExpiredSessions()).to.equal(1)
    expect(await Database.sessionModel.findByPk(expired.id)).to.equal(null)
    const saved = await Database.sessionModel.findByPk(live.id)
    expect(saved.expiresAt).to.be.instanceOf(Date)
    expect(saved.lastRefreshToken).to.equal(null)
    expect(saved.lastRefreshTokenExpiresAt).to.equal(null)
    await user.destroy()
    expect(await Database.sessionModel.count()).to.equal(0)
  })
})
