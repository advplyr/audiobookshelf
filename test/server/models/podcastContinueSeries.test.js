const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const libraryFilters = require('../../../server/utils/queries/libraryFilters')
const libraryItemsPodcastFilters = require('../../../server/utils/queries/libraryItemsPodcastFilters')

// exercise podcast continue-series queries
describe('podcast continue series', () => {
  let sequence
  let user
  let otherUser
  let library
  let libraryFolder
  let otherLibrary
  let otherLibraryFolder

  // create a user with explicit permissions
  async function createUser(permissionOverrides = {}) {
    sequence += 1
    return Database.userModel.create({
      username: `user-${sequence}`,
      pash: 'hash',
      token: `token-${sequence}`,
      type: 'user',
      isActive: true,
      permissions: {
        ...Database.userModel.getDefaultPermissionsForUserType('user'),
        accessExplicitContent: true,
        ...permissionOverrides
      },
      bookmarks: [],
      extraData: {}
    })
  }

  // create a podcast library and folder
  async function createLibrary(name) {
    const createdLibrary = await Database.libraryModel.create({ name, mediaType: 'podcast' })
    const folder = await Database.libraryFolderModel.create({ path: `/${name}`, libraryId: createdLibrary.id })
    return { library: createdLibrary, folder }
  }

  // create a podcast and its library item
  async function createPodcast(targetLibrary, targetFolder, options) {
    const podcast = await Database.podcastModel.create({
      title: options.title,
      podcastType: options.podcastType,
      explicit: options.explicit || false,
      tags: options.tags || [],
      genres: [],
      autoDownloadEpisodes: false
    })
    const libraryItem = await Database.libraryItemModel.create({
      path: `${targetFolder.path}/${options.title}`,
      relPath: options.title,
      isFile: false,
      libraryFiles: [],
      mediaId: podcast.id,
      mediaType: 'podcast',
      libraryId: targetLibrary.id,
      libraryFolderId: targetFolder.id
    })
    return { podcast, libraryItem }
  }

  // create a dated podcast episode
  async function createEpisode(podcast, title, publishedAt, id) {
    return Database.podcastEpisodeModel.create({
      id,
      podcastId: podcast.id,
      title,
      publishedAt,
      audioFile: {
        ino: title,
        duration: 60,
        metadata: { filename: `${title}.mp3`, size: 100 }
      },
      chapters: [],
      extraData: {}
    })
  }

  // create user progress for an episode
  async function createProgress(progressUser, episode, options = {}) {
    return Database.mediaProgressModel.create({
      userId: progressUser.id,
      mediaItemId: episode.id,
      mediaItemType: 'podcastEpisode',
      podcastId: episode.podcastId,
      duration: 60,
      currentTime: options.isFinished ? 60 : 10,
      isFinished: options.isFinished || false,
      hideFromContinueListening: options.hideFromContinueListening || false,
      extraData: {}
    })
  }

  // initialize isolated sqlite models
  beforeEach(async () => {
    sequence = 0
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    // match sequelize model naming
    Database.sequelize.uppercaseFirst = (value) => (value ? `${value[0].toUpperCase()}${value.slice(1)}` : '')
    await Database.buildModels()

    user = await createUser()
    otherUser = await createUser()
    ;({ library, folder: libraryFolder } = await createLibrary('podcasts'))
    ;({ library: otherLibrary, folder: otherLibraryFolder } = await createLibrary('other-podcasts'))
  })

  // restore stubs and release sqlite
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
  })

  // verify both podcast ordering modes
  it('selects the oldest serial and newest episodic unfinished episodes', async () => {
    const serial = await createPodcast(library, libraryFolder, { title: 'serial', podcastType: 'serial' })
    const serialFinished = await createEpisode(serial.podcast, 'serial-1', new Date('2025-01-01'))
    const serialNext = await createEpisode(serial.podcast, 'serial-2', new Date('2025-01-02'))
    await createEpisode(serial.podcast, 'serial-3', new Date('2025-01-03'))
    await createProgress(user, serialFinished, { isFinished: true })

    const episodic = await createPodcast(library, libraryFolder, { title: 'episodic', podcastType: 'episodic' })
    const episodicFinished = await createEpisode(episodic.podcast, 'episodic-1', new Date('2025-02-01'))
    await createEpisode(episodic.podcast, 'episodic-2', new Date('2025-02-02'))
    const episodicNext = await createEpisode(episodic.podcast, 'episodic-3', new Date('2025-02-03'))
    await createProgress(user, episodicFinished, { isFinished: true })

    const result = await libraryItemsPodcastFilters.getContinueSeriesPodcastEpisodes(user, library, 10, 0)

    expect(result.count).to.equal(2)
    expect(result.libraryItems).to.have.length(2)
    expect(result.libraryItems[0].recentEpisode.id).to.equal(serialNext.id)
    expect(result.libraryItems[1].recentEpisode.id).to.equal(episodicNext.id)
  })

  // verify eligibility and isolation boundaries
  it('omits unstarted, finished, hidden-only, other-user, and other-library podcasts', async () => {
    const eligible = await createPodcast(library, libraryFolder, { title: 'eligible', podcastType: 'serial' })
    const eligibleFinished = await createEpisode(eligible.podcast, 'eligible-1', new Date('2025-01-01'))
    const eligibleNext = await createEpisode(eligible.podcast, 'eligible-2', new Date('2025-01-02'))
    await createProgress(user, eligibleFinished, { isFinished: true })

    const unstarted = await createPodcast(library, libraryFolder, { title: 'unstarted', podcastType: 'serial' })
    await createEpisode(unstarted.podcast, 'unstarted-1', new Date('2025-02-01'))
    await createEpisode(unstarted.podcast, 'unstarted-2', new Date('2025-02-02'))

    const finished = await createPodcast(library, libraryFolder, { title: 'finished', podcastType: 'serial' })
    const finishedFirst = await createEpisode(finished.podcast, 'finished-1', new Date('2025-03-01'))
    const finishedSecond = await createEpisode(finished.podcast, 'finished-2', new Date('2025-03-02'))
    await createProgress(user, finishedFirst, { isFinished: true })
    await createProgress(user, finishedSecond, { isFinished: true })

    const hiddenOnly = await createPodcast(library, libraryFolder, { title: 'hidden-only', podcastType: 'serial' })
    const hiddenFinished = await createEpisode(hiddenOnly.podcast, 'hidden-finished', new Date('2025-04-01'))
    const hiddenNext = await createEpisode(hiddenOnly.podcast, 'hidden-next', new Date('2025-04-02'))
    await createProgress(user, hiddenFinished, { isFinished: true })
    await createProgress(user, hiddenNext, { hideFromContinueListening: true })

    const otherUserOnly = await createPodcast(library, libraryFolder, { title: 'other-user', podcastType: 'serial' })
    const otherUserFinished = await createEpisode(otherUserOnly.podcast, 'other-user-1', new Date('2025-05-01'))
    await createEpisode(otherUserOnly.podcast, 'other-user-2', new Date('2025-05-02'))
    await createProgress(otherUser, otherUserFinished, { isFinished: true })

    const outsideLibrary = await createPodcast(otherLibrary, otherLibraryFolder, { title: 'outside-library', podcastType: 'serial' })
    const outsideFinished = await createEpisode(outsideLibrary.podcast, 'outside-1', new Date('2025-06-01'))
    await createEpisode(outsideLibrary.podcast, 'outside-2', new Date('2025-06-02'))
    await createProgress(user, outsideFinished, { isFinished: true })

    const result = await libraryItemsPodcastFilters.getContinueSeriesPodcastEpisodes(user, library, 10, 0)

    expect(result.count).to.equal(1)
    expect(result.libraryItems).to.have.length(1)
    expect(result.libraryItems[0].id).to.equal(eligible.libraryItem.id)
    expect(result.libraryItems[0].recentEpisode.id).to.equal(eligibleNext.id)
  })

  // verify explicit and tag permission filtering
  it('applies explicit-content and tag permissions', async () => {
    const restrictedUser = await createUser({
      accessExplicitContent: false,
      accessAllTags: false,
      itemTagsSelected: ['allowed'],
      selectedTagsNotAccessible: false
    })

    const podcastOptions = [
      { title: 'allowed', tags: ['allowed'] },
      { title: 'explicit', tags: ['allowed'], explicit: true },
      { title: 'denied', tags: ['denied'] },
      { title: 'untagged', tags: [] }
    ]

    // create each permission scenario
    for (const options of podcastOptions) {
      const created = await createPodcast(library, libraryFolder, { ...options, podcastType: 'serial' })
      const first = await createEpisode(created.podcast, `${options.title}-1`, new Date('2025-01-01'))
      await createEpisode(created.podcast, `${options.title}-2`, new Date('2025-01-02'))
      await createProgress(restrictedUser, first, { isFinished: true })
    }

    const result = await libraryItemsPodcastFilters.getContinueSeriesPodcastEpisodes(restrictedUser, library, 10, 0)

    expect(result.count).to.equal(1)
    expect(result.libraryItems).to.have.length(1)
    expect(result.libraryItems[0].media.title).to.equal('allowed')
  })

  // verify eligible tie-breaking
  it('does not select finished or hidden episodes when publication dates tie', async () => {
    const expectedEpisodeIds = new Map()

    // exercise both podcast ordering modes
    for (const podcastType of ['serial', 'episodic']) {
      // keep deterministic ids unique by type
      const typeId = podcastType === 'serial' ? '1' : '2'
      const finishedTie = await createPodcast(library, libraryFolder, { title: `${podcastType}-finished-tie`, podcastType })
      const finishedCandidate = await createEpisode(finishedTie.podcast, `${podcastType}-finished-candidate`, new Date('2025-01-01'), `00000000-0000-4000-8000-00000000${typeId}101`)
      const unfinishedCandidate = await createEpisode(finishedTie.podcast, `${podcastType}-unfinished-candidate`, new Date('2025-01-01'), `00000000-0000-4000-8000-00000000${typeId}102`)
      await createProgress(user, finishedCandidate, { isFinished: true })
      expectedEpisodeIds.set(finishedTie.libraryItem.id, unfinishedCandidate.id)

      const hiddenTie = await createPodcast(library, libraryFolder, { title: `${podcastType}-hidden-tie`, podcastType })
      const earlierFinished = await createEpisode(hiddenTie.podcast, `${podcastType}-earlier-finished`, new Date('2024-12-31'), `00000000-0000-4000-8000-00000000${typeId}200`)
      const hiddenCandidate = await createEpisode(hiddenTie.podcast, `${podcastType}-hidden-candidate`, new Date('2025-01-01'), `00000000-0000-4000-8000-00000000${typeId}201`)
      const visibleCandidate = await createEpisode(hiddenTie.podcast, `${podcastType}-visible-candidate`, new Date('2025-01-01'), `00000000-0000-4000-8000-00000000${typeId}202`)
      await createProgress(user, earlierFinished, { isFinished: true })
      await createProgress(user, hiddenCandidate, { hideFromContinueListening: true })
      expectedEpisodeIds.set(hiddenTie.libraryItem.id, visibleCandidate.id)
    }

    const result = await libraryItemsPodcastFilters.getContinueSeriesPodcastEpisodes(user, library, 10, 0)

    expect(result.count).to.equal(4)
    expect(result.libraryItems).to.have.length(4)
    // index selections by their library items
    const episodeIdByLibraryItemId = Object.fromEntries(result.libraryItems.map((item) => [item.id, item.recentEpisode.id]))
    // verify every type and exclusion mode
    for (const [libraryItemId, episodeId] of expectedEpisodeIds) {
      expect(episodeIdByLibraryItemId[libraryItemId]).to.equal(episodeId)
    }
  })

  // group personalized shelf behavior
  describe('personalized shelves', () => {
    // stub shared shelf loaders
    function stubCommonShelves() {
      sinon.stub(libraryFilters, 'getMediaItemsInProgress').resolves({ items: [], count: 0 })
      sinon.stub(libraryFilters, 'getLibraryItemsMostRecentlyAdded').resolves({ libraryItems: [], count: 0 })
      sinon.stub(libraryFilters, 'getMediaFinished').resolves({ items: [], count: 0 })
    }

    // verify podcast shelf order
    it('places continue series before newest episodes', async () => {
      stubCommonShelves()
      sinon.stub(libraryFilters, 'getPodcastEpisodesContinueSeries').resolves({ libraryItems: [{ id: 'continue' }], count: 1 })
      sinon.stub(libraryFilters, 'getNewestPodcastEpisodes').resolves({ libraryItems: [{ id: 'newest' }], count: 1 })

      const shelves = await Database.libraryItemModel.getPersonalizedShelves(library, user, [], 10)

      // collect the ordered shelf ids
      expect(shelves.map((shelf) => shelf.id)).to.deep.equal(['continue-series', 'newest-episodes'])
      expect(shelves[0]).to.include({ type: 'episode', total: 1 })
      expect(shelves[0].entities).to.deep.equal([{ id: 'continue' }])
    })

    // verify empty shelf omission
    it('omits an empty continue series shelf', async () => {
      stubCommonShelves()
      sinon.stub(libraryFilters, 'getPodcastEpisodesContinueSeries').resolves({ libraryItems: [], count: 0 })
      sinon.stub(libraryFilters, 'getNewestPodcastEpisodes').resolves({ libraryItems: [{ id: 'newest' }], count: 1 })

      const shelves = await Database.libraryItemModel.getPersonalizedShelves(library, user, [], 10)

      // collect the remaining shelf ids
      expect(shelves.map((shelf) => shelf.id)).to.deep.equal(['newest-episodes'])
    })

    // verify the book shelf branch remains intact
    it('preserves existing book shelves', async () => {
      stubCommonShelves()
      sinon.stub(libraryFilters, 'getLibraryItemsContinueSeries').resolves({ libraryItems: [{ id: 'book-next' }], count: 1 })
      libraryFilters.getLibraryItemsMostRecentlyAdded.resolves({ libraryItems: [{ id: 'book-recent' }], count: 1 })
      sinon.stub(libraryFilters, 'getSeriesMostRecentlyAdded').resolves({ series: [{ id: 'series' }], count: 1 })
      sinon.stub(libraryFilters, 'getLibraryItemsToDiscover').resolves({ libraryItems: [{ id: 'discover' }], count: 1 })
      libraryFilters.getMediaFinished.resolves({ items: [{ id: 'finished', media: { numTracks: 1 } }], count: 1 })
      sinon.stub(libraryFilters, 'getNewestAuthors').resolves({ authors: [{ id: 'author' }], count: 1 })
      const bookLibrary = { mediaType: 'book', isBook: true, isPodcast: false }

      const shelves = await Database.libraryItemModel.getPersonalizedShelves(bookLibrary, user, [], 10)

      // collect the unchanged book shelf ids
      expect(shelves.map((shelf) => shelf.id)).to.deep.equal(['continue-series', 'recently-added', 'recent-series', 'discover', 'listen-again', 'newest-authors'])
    })
  })
})
