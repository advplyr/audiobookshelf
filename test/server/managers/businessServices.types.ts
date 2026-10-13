import type { Request, Response } from 'express'
import type User from '../../../server/models/User'
import type Feed from '../../../server/models/Feed'
import type MediaItemShare from '../../../server/models/MediaItemShare'
import type { RssPodcastEpisode } from '../../../server/utils/podcastUtils'
import DeviceInfo from '../../../server/objects/DeviceInfo'
import PlaybackSession from '../../../server/objects/PlaybackSession'
import PodcastEpisodeDownload from '../../../server/objects/PodcastEpisodeDownload'
import Task from '../../../server/objects/Task'
import LogManager from '../../../server/managers/LogManager'
import CoverSearchManager from '../../../server/managers/CoverSearchManager'
import EmailManager from '../../../server/managers/EmailManager'
import NotificationManager from '../../../server/managers/NotificationManager'
import CacheManager from '../../../server/managers/CacheManager'
import CoverManager from '../../../server/managers/CoverManager'
import ShareManager from '../../../server/managers/ShareManager'
import RssFeedManager from '../../../server/managers/RssFeedManager'
import BinaryManager from '../../../server/managers/BinaryManager'
import BackupManager from '../../../server/managers/BackupManager'
import AbMergeManager from '../../../server/managers/AbMergeManager'
import AudioMetadataManager from '../../../server/managers/AudioMetadataManager'
import PlaybackSessionManager from '../../../server/managers/PlaybackSessionManager'
import PodcastManager from '../../../server/managers/PodcastManager'
import Stream from '../../../server/objects/Stream'

type IsAny<T> = 0 extends (1 & T) ? true : false
type Assert<T extends true> = T
export type StrictServiceContracts = [
  Assert<IsAny<Awaited<ReturnType<PodcastManager['runEpisodeCheck']>>> extends false ? true : false>,
  Assert<IsAny<ReturnType<PlaybackSessionManager['getSession']>> extends false ? true : false>,
  Assert<IsAny<Parameters<PodcastManager['startPodcastEpisodeDownload']>[0]> extends false ? true : false>,
  Assert<number extends NonNullable<Task['descriptionSubs']>[number] ? true : false>
]

// Compile-only consumer contracts; these functions are never executed by Mocha.
export async function businessServiceContracts(
  req: Request, res: Response, user: User, feed: Feed, share: MediaItemShare,
  playbackItem: Parameters<PlaybackSessionManager['startSession']>[2],
  podcastItem: Parameters<PodcastManager['runEpisodeCheck']>[0], episodes: RssPodcastEpisode[],
  localSession: Parameters<PlaybackSessionManager['syncLocalSession']>[1],
  audioItem: Parameters<AudioMetadataManager['getMetadataObjectForApi']>[0]
) {
  const log = new LogManager()
  const entry: LogManager.LogObject = { timestamp: 'now', source: 'test', message: 'message', levelName: 'INFO', level: 2 }
  await log.logToFile(entry)
  const recent: unknown[] | '' = log.getMostRecentCurrentDailyLogs()
  const timed: number = await CoverSearchManager.executeWithTimeout(() => Promise.resolve(1), 10, new AbortController().signal)
  const covers: string[] = CoverSearchManager.extractCoversFromResults(['cover'])
  const cancelled: boolean = CoverSearchManager.cancelSearch('id')
  await new EmailManager().sendTest(res)
  await NotificationManager.triggerNotification('onBackupFailed', { errorMsg: new Error('failure') })
  const removed: boolean | Promise<boolean> = CacheManager.removeCache(null)
  const cover = await CoverManager.downloadCoverFromUrlNew('url', 'item')
  ShareManager.openMediaItemShare(share)
  const feedClosed: boolean = await RssFeedManager.handleCloseFeed(feed)
  const binary = new BinaryManager.Binary('ffmpeg', 'executable', 'FFMPEG_PATH', ['5.1'], BinaryManager.ffbinaries)
  const binaryPath: string | null | undefined = await binary.find('/main', '/alternate')
  const backupSuccess: boolean = await new BackupManager().runBackup()
  const metadata = new AudioMetadataManager()
  const merge = new AbMergeManager()
  void metadata.updateMetadataForItem('user', audioItem, { backup: true })
  void merge.startAudiobookMerge('user', audioItem, { codec: 'aac', bitrate: '128k' })
  const playback = new PlaybackSessionManager()
  const device: DeviceInfo = await playback.getDeviceInfo(req)
  const session: PlaybackSession = await playback.startSession(user, device, playbackItem, null, { forceDirectPlay: true })
  await playback.syncLocalSession(user, localSession, device)
  await playback.syncSession(user, session, { currentTime: 1, timeListened: '1.5' })
  const stream = new Stream('id', '/streams', user, playbackItem, null, 0, { forceAAC: true })
  const segment: number | false = await stream.checkSegmentNumberRequest(1)
  const podcasts = new PodcastManager()
  const enabled: boolean | null = await podcasts.runEpisodeCheck(podcastItem)
  const download: PodcastEpisodeDownload = new PodcastEpisodeDownload()
  download.setData(episodes[0], podcastItem, false, podcastItem.libraryId)
  // setData narrows the initialized state without caller casts.
  void podcasts.startPodcastEpisodeDownload(download)
  return { recent, timed, covers, cancelled, removed, cover, feedClosed, binaryPath, backupSuccess, session, segment, enabled }
}
