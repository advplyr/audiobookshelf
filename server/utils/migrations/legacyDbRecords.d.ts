import type Book from '../../models/Book'
import type DeviceInfo from '../../objects/DeviceInfo'
import type Library from '../../models/Library'
import type LibraryItem from '../../models/LibraryItem'
import type PlaybackSession from '../../models/PlaybackSession'
import type Setting from '../../models/Setting'
import type User from '../../models/User'

// The pre-SQLite JSON stores used millisecond timestamps and their own field names.
type Timestamp = number | null
type Text = string | null
type AudioFile = NonNullable<Book['audioFiles']>[number] & { invalid?: boolean }
type NamedEntity = { id: string; name: Text }
type SeriesReference = NamedEntity & { sequence: Text }
type MediaMetadata = {
  title: Text
  description: Text
  language: Text
  explicit: boolean
  genres: string[]
}
type BookMetadata = MediaMetadata & {
  authors: NamedEntity[]
  series: SeriesReference[]
  subtitle: Text
  publishedYear: Text
  publishedDate: Text
  publisher: Text
  isbn: Text
  asin: Text
  abridged?: boolean
  narrators: string[]
}
type PodcastMetadata = MediaMetadata & {
  author: Text
  releaseDate: Text
  feedUrl: Text
  imageUrl: Text
  itunesPageUrl: Text
  itunesId: Text
  itunesArtistId: Text
  type: Text
  authors?: never
  series?: never
}
type Media = {
  coverPath: Text
  tags: string[]
  lastCoverSearchQuery?: Text
  lastCoverSearch?: Timestamp
}
type LegacyBook = Media & {
  metadata: BookMetadata
  audioFiles: AudioFile[]
  ebookFile: Book['ebookFile']
  chapters: Book['chapters']
  episodes?: never
}
type LegacyPodcast = Media & {
  metadata: PodcastMetadata
  episodes: PodcastEpisode[]
  autoDownloadEpisodes: boolean
  autoDownloadSchedule: Text
  lastEpisodeCheck: Timestamp
  maxEpisodesToKeep: number
  maxNewEpisodesToDownload: number
}
type PodcastEpisode = {
  id: string
  index: number | null
  season: Text
  episode: Text
  episodeType: Text
  title: Text
  subtitle: Text
  description: Text
  pubDate: Text
  enclosure?: { url: Text; length: string | number | null; type: Text } | null
  publishedAt: Timestamp
  addedAt: Timestamp
  updatedAt: Timestamp
  audioFile: AudioFile
  chapters: Book['chapters']
}

type LegacyLibraryItem = {
  id: string
  ino: Text
  libraryId: string
  folderId: string
  path: Text
  relPath: Text
  isFile: boolean
  isMissing: boolean
  isInvalid: boolean
  mtimeMs: Timestamp
  ctimeMs: Timestamp
  birthtimeMs: Timestamp
  lastScan: Timestamp
  scanVersion: Text
  addedAt: Timestamp
  updatedAt: Timestamp
  libraryFiles: NonNullable<LibraryItem['libraryFiles']>
} & (
  | { mediaType: 'book'; media: LegacyBook }
  | { mediaType: 'podcast'; media: LegacyPodcast }
  | {
      mediaType: 'music' | 'video' | null
      media: { metadata: { authors?: NamedEntity[]; series?: SeriesReference[] }; episodes?: never }
    }
)

type LegacyLibrary = NamedEntity & {
  displayOrder: number
  icon: Text
  mediaType: Text
  provider: Text
  settings: Library['settings']
  createdAt: Timestamp
  lastUpdate: Timestamp
  folders: { id: string; fullPath: Text; addedAt: Timestamp }[]
}
type LegacyAuthor = NamedEntity & {
  asin: Text
  description: Text
  imagePath: Text
  addedAt: Timestamp
  updatedAt: Timestamp
}
type LegacySeries = Pick<LegacyAuthor, 'id' | 'name' | 'description' | 'addedAt' | 'updatedAt'>

type MediaReference = { libraryItemId: string; episodeId?: Text }
type LegacyMediaProgress = MediaReference & {
  id: string
  duration: number | null
  currentTime: number | null
  ebookLocation: Text
  ebookProgress: number | null
  isFinished: boolean
  hideFromContinueListening: boolean
  progress: number
  finishedAt: Timestamp
  startedAt: Timestamp
  lastUpdate: Timestamp
}
type LegacyUser = {
  id: string
  username: Text
  pash: Text
  token: Text
  type: Text
  isActive: boolean
  lastSeen: Timestamp
  createdAt: Timestamp
  permissions?: User.UserPermissions | null
  bookmarks?: User.AudioBookmarkObject[] | null
  librariesAccessible?: string[] | null
  itemTagsSelected?: string[] | null
  seriesHideFromContinueListening?: string[] | null
  mediaProgress: LegacyMediaProgress[]
}

export type LegacyDeviceInfo = Pick<DeviceInfo, 'deviceId' | 'ipAddress' | 'browserName' | 'browserVersion' | 'osName' | 'osVersion' | 'clientVersion' | 'manufacturer' | 'model'> & {
  sdkVersion?: string | number | null
  serverVersion?: Text
}
type LegacySession = MediaReference & Pick<PlaybackSession, 'displayTitle' | 'displayAuthor' | 'duration' | 'playMethod' | 'mediaPlayer' | 'startTime' | 'currentTime' | 'timeListening' | 'coverPath' | 'mediaMetadata' | 'date' | 'dayOfWeek'> & {
  id: string
  userId: string
  libraryId: Text
  mediaType: Text
  deviceInfo: LegacyDeviceInfo | null
  startedAt: Timestamp
  updatedAt: Timestamp
}

type LegacyCollection = NamedEntity & {
  libraryId: string
  description: Text
  books: string[]
  createdAt: Timestamp
  lastUpdate: Timestamp
}
type LegacyPlaylist = Omit<LegacyCollection, 'books'> & { userId: string; items: MediaReference[] }

type FeedEpisode = {
  title: Text
  author: Text
  description: Text
  link: Text
  enclosure?: { url: Text; type: Text; size: string | number | null } | null
  pubDate: Text
  season: Text
  episode: Text
  episodeType: Text
  duration: number | null
  fullPath: Text
  explicit: boolean | null
}
type LegacyFeed = {
  slug: Text
  entityType: Text
  entityId: string
  userId: string
  entityUpdatedAt?: Timestamp
  serverAddress: Text
  feedUrl: Text
  coverPath: Text
  createdAt: Timestamp
  updatedAt: Timestamp
  meta: {
    imageUrl: Text
    link: Text
    title: Text
    description: Text
    author: Text
    type: Text
    language: Text
    ownerName: Text
    ownerEmail: Text
    explicit: boolean | null
    preventIndexing: boolean | null
  }
  episodes?: FeedEpisode[] | null
}

export interface LegacyDbRecords {
  libraryItems: LegacyLibraryItem
  libraries: LegacyLibrary
  settings: Setting['value']
  authors: LegacyAuthor
  series: LegacySeries
  users: LegacyUser
  sessions: LegacySession
  collections: LegacyCollection
  playlists: LegacyPlaylist
  feeds: LegacyFeed
}
