const { expect } = require('chai')
const sinon = require('sinon')
const Download = require('../../../server/objects/PodcastEpisodeDownload')
const Database = require('../../../server/Database')
const SocketAuthority = require('../../../server/SocketAuthority')
const Watcher = require('../../../server/Watcher')
const TaskManager = require('../../../server/managers/TaskManager')
const Notification = require('../../../server/managers/NotificationManager')
const ffmpeg = require('../../../server/utils/ffmpegHelpers')
const podcastUtils = require('../../../server/utils/podcastUtils')
// Inject a bridge at module load because the original manager snapshots this export.
// Restore the real export immediately; per-test stubs remain local to the tests.
const originalGetFeed = podcastUtils.getPodcastFeed
let Manager
try {
  podcastUtils.getPodcastFeed = (...args) => podcastUtils.getPodcastFeed(...args)
  delete require.cache[require.resolve('../../../server/managers/PodcastManager')]
  Manager = require('../../../server/managers/PodcastManager')
} finally {
  podcastUtils.getPodcastFeed = originalGetFeed
}
const prober = require('../../../server/utils/prober')
const axios = require('axios')
const { Readable } = require('stream')
const nodeFs = require('fs/promises')
const Path = require('path')
const os = require('os')

describe('PodcastManager compatibility', () => {
  let temporary, manager, item, tasks, ignored, maximum, timeout, ssrf
  beforeEach(async () => {
    temporary = await nodeFs.mkdtemp(Path.join(os.tmpdir(), 'abs-phase5-podcast-'))
    tasks = TaskManager.tasks; ignored = Watcher.ignoreFilePathsDownloading; maximum = global.MaxFailedEpisodeChecks; timeout = global.PodcastDownloadTimeout; ssrf = global.DisableSsrfRequestFilter
    TaskManager.tasks = []; Watcher.ignoreFilePathsDownloading = new Set(); global.MaxFailedEpisodeChecks = 2; global.PodcastDownloadTimeout = 1000; global.DisableSsrfRequestFilter = () => true
    manager = new Manager()
    item = { id: 'item', libraryId: 'library', path: temporary, libraryFiles: [], changed: sinon.spy(), save: sinon.stub().resolves(), toOldJSONExpanded: () => ({ id: 'item' }), media: { id: 'podcast', title: 'Podcast', explicit: false, feedURL: 'https://example.test/feed', podcastEpisodes: [], numEpisodes: 0, maxEpisodesToKeep: 0, lastEpisodeCheck: null, maxNewEpisodesToDownload: 3, autoDownloadEpisodes: true, save: sinon.stub().resolves(), getLatestEpisodePublishedAt: () => 0, checkHasEpisodeByFeedEpisode: () => false } }
    sinon.stub(SocketAuthority, 'emitter'); sinon.stub(SocketAuthority, 'libraryItemEmitter'); sinon.stub(Watcher, 'addIgnoreDir'); sinon.stub(Watcher, 'removeIgnoreDir')
  })
  afterEach(async () => { sinon.restore(); TaskManager.tasks = tasks; Watcher.ignoreFilePathsDownloading = ignored; global.MaxFailedEpisodeChecks = maximum; global.PodcastDownloadTimeout = timeout; global.DisableSsrfRequestFilter = ssrf; await nodeFs.rm(temporary, { recursive: true, force: true }) })
  const episode = (url = 'https://example.test/audio.mp3') => ({ title: 'Episode', enclosure: { url }, publishedAt: 20 })
  const download = (libraryItem = item, url) => { const current = new Download(); current.setData(episode(url), libraryItem, false, libraryItem.libraryId); return current }
  it('deduplicates by URL and item but allows the same URL in another item', async () => {
    manager.currentDownload = download()
    await manager.startPodcastEpisodeDownload(download())
    expect(manager.downloadQueue).to.deep.equal([])
    const other = download({ ...item, id: 'other' })
    await manager.startPodcastEpisodeDownload(other); await manager.startPodcastEpisodeDownload(download({ ...item, id: 'other' }))
    expect(manager.downloadQueue).to.deep.equal([other])
    expect(SocketAuthority.emitter.calledOnceWithExactly('episode_download_queued', other.toJSONForClient())).to.equal(true)
  })
  it('clears matching queued items and keeps the historical silent clear-all behavior', () => {
    const other = download({ ...item, id: 'other', libraryId: 'other-library' })
    manager.downloadQueue = [download(), other]
    manager.clearDownloadQueue('item')
    expect(manager.downloadQueue).to.deep.equal([other])
    expect(manager.getDownloadQueueDetails('library').queue).to.deep.equal([])
    manager.clearDownloadQueue()
    expect(SocketAuthority.emitter.callCount).to.equal(1)
  })
  it('marks request failure, emits finish and clears watcher ignore state', async () => {
    const current = download()
    sinon.stub(ffmpeg, 'downloadPodcastEpisode').resolves({ success: false, isRequestError: true })
    await manager.startPodcastEpisodeDownload(current)
    expect(current.failed).to.equal(true); expect(current.isFinished).to.equal(true)
    expect(manager.currentDownload).to.equal(null)
    expect(TaskManager.tasks).to.deep.equal([])
    expect(Watcher.ignoreFilePathsDownloading.size).to.equal(0)
    expect(Watcher.removeIgnoreDir.calledOnceWithExactly(temporary)).to.equal(true)
    expect(SocketAuthority.emitter.calledWith('episode_download_finished')).to.equal(true)
  })
  it('retries without tags after failed probe and keeps only the successful temporary download', async () => {
    const current = download()
    sinon.stub(ffmpeg, 'downloadPodcastEpisode').callsFake(async dl => { await nodeFs.writeFile(dl.targetPath, 'bad tagged media'); return { success: true } })
    sinon.stub(axios.defaults, 'adapter').value(async config => ({ data: Readable.from(['retry media']), headers: {}, status: 200, statusText: 'OK', config }))
    const scan = sinon.stub(manager, 'scanAddPodcastEpisodeAudioFile').onFirstCall().resolves(false).onSecondCall().resolves(true)
    await manager.startPodcastEpisodeDownload(current)
    expect(scan.calledTwice).to.equal(true)
    expect(current.failed).to.equal(false)
    expect(await nodeFs.readFile(current.targetPath, 'utf8')).to.equal('retry media')
    expect(Watcher.ignoreFilePathsDownloading.size).to.equal(0)
  })
  it('appends a random suffix for an existing filename', async () => {
    const current = download()
    await nodeFs.writeFile(current.targetPath, 'existing fixture')
    sinon.stub(ffmpeg, 'downloadPodcastEpisode').resolves({ success: false, isRequestError: true })
    await manager.startPodcastEpisodeDownload(current)
    expect(current.appendRandomId).to.equal(true)
    expect(current.targetFilename).to.include(current.id)
    expect(await nodeFs.readFile(Path.join(temporary, 'Episode.mp3'), 'utf8')).to.equal('existing fixture')
  })
  it('persists the new episode/file size before emitting and notifying', async () => {
    const current = download(); current.isAutoDownload = true; manager.currentDownload = current
    await nodeFs.writeFile(current.targetPath, 'media fixture')
    const audioFile = { toJSON: () => ({ ino: 'ino' }) }, created = { id: 'episode', toOldJSONExpanded: () => ({ id: 'episode' }) }
    sinon.stub(manager, 'probeAudioFile').resolves(audioFile)
    sinon.stub(Database, 'libraryItemModel').get(() => ({ getExpandedById: sinon.stub().resolves(item) }))
    sinon.stub(Database, 'podcastEpisodeModel').get(() => ({ createFromRssPodcastEpisode: sinon.stub().resolves(created) }))
    const notify = sinon.stub(Notification, 'onPodcastEpisodeDownloaded').resolves()
    expect(await manager.scanAddPodcastEpisodeAudioFile()).to.equal(true)
    expect(item.size).to.equal(13)
    expect(item.libraryFiles).to.have.length(1)
    expect(item.media.podcastEpisodes).to.deep.equal([created])
    expect(item.media.numEpisodes).to.equal(1)
    expect(SocketAuthority.libraryItemEmitter.calledAfter(item.save)).to.equal(true)
    expect(notify.calledAfter(item.media.save)).to.equal(true)
  })
  it('returns false for missing media after probing and preserves probe errors', async () => {
    const current = download(); manager.currentDownload = current
    await nodeFs.writeFile(current.targetPath, 'fixture')
    sinon.stub(manager, 'probeAudioFile').resolves({})
    sinon.stub(Database, 'libraryItemModel').get(() => ({ getExpandedById: sinon.stub().resolves(null) }))
    expect(await manager.scanAddPodcastEpisodeAudioFile()).to.equal(false)
    manager.probeAudioFile.restore()
    sinon.stub(prober, 'probe').resolves({ error: new Error('bad media') })
    expect(await manager.probeAudioFile({ metadata: { path: current.targetPath } })).to.equal(null)
  })
  it('selects the oldest published episode while excluding the newly downloaded one', async () => {
    const oldPath = Path.join(temporary, 'old.mp3'); await nodeFs.writeFile(oldPath, 'fixture')
    const oldest = { id: 'old', publishedAt: new Date(10), audioFile: { metadata: { path: oldPath } } }
    item.media.podcastEpisodes = [{ id: 'new', publishedAt: 1 }, { id: 'undated', publishedAt: null }, oldest, { id: 'later', publishedAt: 20 }]
    expect(await manager.getRemoveOldestEpisode(item, 'new')).to.equal(oldest)
    expect(await nodeFs.stat(oldPath).catch(() => null)).to.equal(null)
  })
  it('disables automatic download at the failure threshold and persists both item and podcast', async () => {
    sinon.stub(manager, 'checkPodcastForNewEpisodes').resolves(null)
    const failed = sinon.stub(Notification, 'onRSSFeedFailed').resolves(), disabled = sinon.stub(Notification, 'onRSSFeedDisabled').resolves()
    expect(await manager.runEpisodeCheck(item)).to.equal(true)
    expect(await manager.runEpisodeCheck(item)).to.equal(false)
    expect(failed.calledOnce).to.equal(true); expect(disabled.calledOnce).to.equal(true)
    expect(manager.failedCheckMap.item).to.equal(undefined)
    expect(item.media.save.calledTwice).to.equal(true); expect(item.save.calledTwice).to.equal(true)
  })
  it('filters feed dates, existing episodes and count limits while retaining the legacy timer', async () => {
    const clock = sinon.useFakeTimers()
    sinon.stub(podcastUtils, 'getPodcastFeed').resolves({ episodes: [{ ...episode(), publishedAt: 5 }, { ...episode(), title: 'Existing', publishedAt: 30 }, { ...episode(), title: 'New', publishedAt: 40 }, { ...episode(), title: 'Later', publishedAt: 50 }] })
    item.media.checkHasEpisodeByFeedEpisode = ep => ep.title === 'Existing'
    expect((await manager.checkPodcastForNewEpisodes(item, 10, 1)).map(ep => ep.title)).to.deep.equal(['New'])
    expect((await manager.checkPodcastForNewEpisodes(item, 10, 0)).map(ep => ep.title)).to.deep.equal(['New', 'Later'])
    expect(clock.countTimers()).to.equal(2)
  })
  it('rolls back failed OPML creation and retains numeric task substitutions', async () => {
    sinon.stub(podcastUtils, 'getPodcastFeed').resolves({ episodes: [], metadata: { title: 'New podcast', categories: [], feedUrl: 'url', image: null } })
    const rollback = sinon.stub().resolves(), commit = sinon.stub().resolves()
    sinon.stub(Database, 'sequelize').value({ transaction: sinon.stub().resolves({ rollback, commit }) })
    sinon.stub(Database, 'libraryItemModel').get(() => ({ count: sinon.stub().resolves(0), create: sinon.stub().rejects(new Error('failed')) }))
    sinon.stub(Database, 'podcastModel').get(() => ({ createFromRequest: sinon.stub().resolves({ id: 'podcast' }) }))
    const finish = sinon.spy(TaskManager, 'taskFinished'), cron = { checkUpdatePodcastCron: sinon.spy() }
    await manager.createPodcastsFromFeedUrls(['url'], { path: temporary, id: 'folder', libraryId: 'library' }, true, cron)
    expect(rollback.calledOnce).to.equal(true); expect(commit.called).to.equal(false)
    expect(cron.checkUpdatePodcastCron.called).to.equal(false)
    expect(finish.firstCall.args[0].descriptionSubs).to.deep.equal([0])
  })
  it('keeps empty OPML and missing feed results without starting a download', async () => {
    expect(await manager.getOPMLFeeds('<opml/>')).to.deep.equal({ error: 'No RSS feeds found in OPML' })
    item.media.feedURL = null
    expect(await manager.checkPodcastForNewEpisodes(item, 0)).to.equal(null)
  })
  it('keeps raw string channels at the existing audio-file boundary', async () => {
    const LibraryFile = require('../../../server/objects/files/LibraryFile'), current = download()
    await nodeFs.writeFile(current.targetPath, 'fixture')
    const file = new LibraryFile(); await file.setDataFromPath(current.targetPath, current.targetFilename)
    sinon.stub(prober, 'probe').resolves({ channels: '2', chapters: [], audioMetaTags: {}, format: 'MP3' })
    expect((await manager.probeAudioFile(file)).channels).to.equal('2')
  })
  it('preserves persistence rejection after the existing in-memory episode update', async () => {
    const current = download(); manager.currentDownload = current
    await nodeFs.writeFile(current.targetPath, 'fixture')
    const created = { id: 'episode', toOldJSONExpanded: () => ({ id: 'episode' }) }
    sinon.stub(manager, 'probeAudioFile').resolves({})
    sinon.stub(Database, 'libraryItemModel').get(() => ({ getExpandedById: sinon.stub().resolves(item) }))
    sinon.stub(Database, 'podcastEpisodeModel').get(() => ({ createFromRssPodcastEpisode: sinon.stub().resolves(created) }))
    item.save.rejects(new Error('persist failed'))
    expect((await manager.scanAddPodcastEpisodeAudioFile().catch(e => e)).message).to.equal('persist failed')
    expect(item.media.podcastEpisodes).to.deep.equal([created])
    expect(SocketAuthority.libraryItemEmitter.called).to.equal(false)
  })

})
