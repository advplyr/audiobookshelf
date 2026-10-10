const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

describe('User', () => {
  let previousSequelize
  let previousSettings
  let user
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    sinon.stub(Logger, 'info')
    user = await Database.userModel.create({ username: `Reader-${Date.now()}`, email: 'reader@example.test', isActive: true, type: 'user', bookmarks: [], permissions: Database.userModel.getDefaultPermissionsForUserType('user'), extraData: {} })
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('retains cached identity and invalidates it after a detached update or deletion', async () => {
    const cached = await Database.userModel.getUserById(user.id)
    expect(await Database.userModel.getUserById(user.id)).to.equal(cached)
    await user.update({ username: 'Changed' })
    const refreshed = await Database.userModel.getUserById(user.id)
    expect(refreshed).not.to.equal(cached)
    expect(refreshed.username).to.equal('Changed')
    expect(await Database.userModel.getUserByUsername('Changed')).to.equal(refreshed)
    expect((await Database.userModel.getUserByUsername('changed')).id).to.equal(user.id)
    await user.destroy()
    expect(await Database.userModel.getUserById(user.id)).to.equal(null)
  })

  it('persists bookmark updates and series visibility without duplicating entries', async () => {
    const bookmark = await user.createBookmark('item', 10, 'First')
    expect(await user.createBookmark('item', 10, 'Renamed')).to.equal(bookmark)
    expect(user.bookmarks).to.have.length(1)
    expect(await user.updateBookmark('item', 10, 'Updated')).to.include({ title: 'Updated' })
    expect(await user.addSeriesToHideFromContinueListening('series')).to.equal(true)
    expect(await user.addSeriesToHideFromContinueListening('series')).to.equal(false)
    await user.reload()
    expect(user.bookmarks[0].title).to.equal('Updated')
    expect(await user.removeSeriesFromHideFromContinueListening('series')).to.equal(true)
    expect(await user.removeBookmark('item', 10)).to.equal(true)
    expect(await user.removeBookmark('item', 10)).to.equal(false)
  })

  it('preserves permission mappings, allow and deny lists and browser serialization', async () => {
    expect(await user.updatePermissionsFromExternalJSON({ canAccessAllLibraries: false, allowedLibraries: ['library'], canAccessAllTags: false, allowedTags: ['Favorite'], canDownload: false })).to.equal(true)
    expect(user.checkCanAccessLibrary('library')).to.equal(true)
    expect(user.checkCanAccessLibrary('other')).to.equal(false)
    expect(user.checkCanAccessLibraryItemWithTags(['Favorite'])).to.equal(true)
    expect(user.checkCanAccessLibraryItemWithTags([])).to.equal(false)
    await user.updatePermissionsFromExternalJSON({ tagsAreDenylist: true })
    expect(user.checkCanAccessLibraryItemWithTags(['Favorite'])).to.equal(false)
    expect(user.checkCanAccessLibraryItemWithTags([])).to.equal(true)
    const json = user.toOldJSONForBrowser(false, true)
    expect(json.librariesAccessible).to.deep.equal(['library'])
    expect(json.permissions).not.to.have.property('librariesAccessible')
    expect(json).not.to.have.property('mediaProgress')
    expect(json).not.to.have.property('bookmarks')
    let error
    try { await user.updatePermissionsFromExternalJSON({ unexpected: true }) } catch (err) { error = err }
    expect(error.message).to.equal('Unexpected permission property: unexpected')
  })

  it('links a verified OpenID email while rejecting unverified or already linked subjects', async () => {
    global.ServerSettings.authOpenIDMatchExistingBy = 'email'
    expect(await Database.userModel.findUserFromOpenIdUserInfo({ sub: 'subject', email: user.email, email_verified: false })).to.deep.equal({ error: 'Email not verified' })
    const linked = await Database.userModel.findUserFromOpenIdUserInfo({ sub: 'subject', email: user.email, email_verified: true })
    expect(linked.id).to.equal(user.id)
    expect(linked.authOpenIDSub).to.equal('subject')
    expect(await Database.userModel.findUserFromOpenIdUserInfo({ sub: 'different', email: user.email })).to.deep.equal({ error: 'User already linked to a different OpenID subject' })
  })

  it('creates and updates book and episode progress and preserves missing-item errors', async () => {
    const book = await Database.bookModel.create({ title: 'Book' })
    const libraryItem = await Database.libraryItemModel.create({ mediaId: book.id, mediaType: 'book' })
    const podcast = await Database.podcastModel.create({ title: 'Podcast' })
    const episode = await Database.podcastEpisodeModel.create({ podcastId: podcast.id, title: 'Episode' })
    await Database.libraryItemModel.create({ mediaId: podcast.id, mediaType: 'podcast' })
    const extended = await Database.userModel.getUserById(user.id)
    const first = await extended.createUpdateMediaProgressFromPayload({ libraryItemId: libraryItem.id, duration: 100, currentTime: 20 })
    expect(first.mediaProgress.mediaItemId).to.equal(book.id)
    expect(first.mediaProgress.getOldMediaProgress().libraryItemId).to.equal(libraryItem.id)
    const updated = await extended.createUpdateMediaProgressFromPayload({ libraryItemId: libraryItem.id, currentTime: 30 })
    expect(updated.mediaProgress.id).to.equal(first.mediaProgress.id)
    expect(updated.mediaProgress.currentTime).to.equal(30)
    const episodeProgress = await extended.createUpdateMediaProgressFromPayload({ libraryItemId: 'podcast', episodeId: episode.id, isFinished: true })
    expect(episodeProgress.mediaProgress).to.include({ mediaItemId: episode.id, podcastId: podcast.id, isFinished: true })
    expect(extended.mediaProgresses).to.have.length(2)
    expect(await extended.createUpdateMediaProgressFromPayload({ libraryItemId: 'missing' })).to.deep.equal({ error: 'Library item not found', statusCode: 404 })
    expect(await extended.createUpdateMediaProgressFromPayload({ libraryItemId: 'podcast', episodeId: 'missing' })).to.deep.equal({ error: 'Episode not found', statusCode: 404 })
  })

  it('creates root users with the supplied token generator and prevents their deletion', async () => {
    const auth = { generateAccessToken: sinon.stub().returns('test-token') }
    const root = await Database.userModel.createRootUser('root', 'hash', auth)
    expect(root).to.include({ type: 'root', token: 'test-token', isActive: true })
    expect(root.canDelete).to.equal(true)
    expect(root.toOldJSONForBrowser(true).token).to.equal('')
    let error
    try { await root.destroy() } catch (err) { error = err }
    expect(error.message).to.equal('Root user cannot be deleted')
    expect(await Database.userModel.getHasRootUser()).to.equal(true)
  })
})
