const Path = require('path')
const uuidv4 = require("uuid").v4
const { AudioMimeType } = require('../constants')
const Logger = require('../../Logger')
const Database = require('../../Database')
const oldDbFiles = require('./oldDbFiles')
const dateAndTime = require('../../libs/dateAndTime')

const oldDbIdMap = {
  users: {},
  libraries: {},
  libraryFolders: {},
  libraryItems: {},
  tags: {}, // key is tag string
  genres: {}, // key is genre string
  people: {}, // key is author id or narrator name clean
  series: {},
  collections: {},
  files: {}, // key is fullpath
  podcastEpisodes: {},
  books: {}, // key is library item id
  podcasts: {}, // key is library item id
  devices: {} // key is a json stringify of the old DeviceInfo data
}
const newRecords = {
  user: [],
  userPermission: [],
  library: [],
  libraryFolder: [],
  librarySetting: [],
  fileMetadata: [],
  person: [],
  eBookFile: [],
  book: [],
  podcast: [],
  libraryItem: [],
  libraryFile: [],
  bookAuthor: [],
  bookNarrator: [],
  bookChapter: [],
  tag: [],
  bookTag: [],
  genre: [],
  bookGenre: [],
  series: [],
  bookSeries: [],
  podcastTag: [],
  podcastGenre: [],
  podcastEpisode: [],
  mediaProgress: [],
  audioBookmark: [],
  mediaFile: [],
  mediaStream: [],
  audioTrack: [],
  device: [],
  playbackSession: [],
  playbackSessionListenTime: [],
  collection: [],
  collectionBook: [],
  playlist: [],
  playlistMediaItem: [],
  feed: [],
  feedEpisode: [],
  setting: [],
  notification: []
}

function getDeviceInfoString(deviceInfo, UserId) {
  if (!deviceInfo) return null
  const dupe = { ...deviceInfo }
  dupe.UserId = UserId
  delete dupe.serverVersion
  return JSON.stringify(dupe)
}

function getMimeType(formatName) {
  const format = formatName.toUpperCase()
  if (AudioMimeType[format]) {
    return AudioMimeType[format]
  } else {
    return AudioMimeType.MP3
  }
}

function cleanAudioFileMetaTags(metaTags) {
  if (!metaTags) return {}

  const cleaned = {}
  for (const tag in metaTags) {
    if (tag.startsWith('tag') && metaTags[tag]) {
      const tagName = tag.substring(3)
      cleaned[tagName] = metaTags[tag]
    }
  }

  return cleaned
}

function migrateBook(oldLibraryItem, LibraryItem) {
  const oldBook = oldLibraryItem.media

  //
  // Migrate ImageFile
  //
  let imageFileId = null
  if (oldBook.coverPath) {
    imageFileId = oldDbIdMap.files[oldBook.coverPath] || null
    if (!imageFileId) {
      const FileMetadata = {
        id: uuidv4(),
        filename: Path.basename(oldBook.coverPath),
        ext: Path.extname(oldBook.coverPath),
        path: oldBook.coverPath,
        createdAt: LibraryItem.createdAt,
        updatedAt: LibraryItem.updatedAt
      }
      newRecords.fileMetadata.push(FileMetadata)
      oldDbIdMap.files[oldBook.coverPath] = FileMetadata.id
      imageFileId = FileMetadata.id
    }
  }

  //
  // Migrate EBookFile
  //
  let eBookFileId = null
  if (oldBook.ebookFile) {
    if (oldDbIdMap.files[oldBook.ebookFile.metadata?.path]) {
      const ext = oldBook.ebookFile.metadata.ext || ''
      const EBookFile = {
        id: uuidv4(),
        format: ext.toLowerCase().slice(1),
        fileMetadataId: oldDbIdMap.files[oldBook.ebookFile.metadata.path]
      }
      newRecords.eBookFile.push(EBookFile)
      eBookFileId = EBookFile.id
    } else {
      Logger.warn(`[dbMigration] migrateBook: Unable to find ebook file`)
    }
  }

  //
  // Migrate Book
  //
  const Book = {
    id: uuidv4(),
    title: oldBook.metadata.title,
    subtitle: oldBook.metadata.subtitle,
    publishedYear: oldBook.metadata.publishedYear,
    publishedDate: oldBook.metadata.publishedDate,
    publisher: oldBook.metadata.publisher,
    description: oldBook.metadata.description,
    isbn: oldBook.metadata.isbn,
    asin: oldBook.metadata.asin,
    language: oldBook.metadata.language,
    explicit: !!oldBook.metadata.explicit,
    lastCoverSearchQuery: oldBook.lastCoverSearchQuery,
    lastCoverSearch: oldBook.lastCoverSearch,
    createdAt: LibraryItem.createdAt,
    updatedAt: LibraryItem.updatedAt,
    imageFileId,
    eBookFileId
  }
  newRecords.book.push(Book)
  oldDbIdMap.books[oldLibraryItem.id] = Book.id

  //
  // Migrate AudioTracks
  //
  const oldAudioFiles = oldBook.audioFiles
  let startOffset = 0
  for (const oldAudioFile of oldAudioFiles) {
    const fileMetadataId = oldDbIdMap.files[oldAudioFile.metadata.path]
    if (!fileMetadataId) {
      Logger.warn(`[dbMigration] migrateBook: File metadata not found for audio file "${oldAudioFile.metadata.path}"`)
      continue
    }

    const ext = oldAudioFile.metadata.ext || ''

    const MediaFile = {
      id: uuidv4(),
      formatName: ext.slice(1).toLowerCase(),
      formatNameLong: oldAudioFile.format,
      duration: oldAudioFile.duration,
      bitrate: oldAudioFile.bitRate,
      size: oldAudioFile.metadata.size,
      tags: cleanAudioFileMetaTags(oldAudioFile.metaTags),
      createdAt: LibraryItem.createdAt,
      updatedAt: LibraryItem.updatedAt,
      fileMetadataId
    }
    newRecords.mediaFile.push(MediaFile)

    const MediaStream = {
      id: uuidv4(),
      index: null,
      codecType: 'audio',
      codec: oldAudioFile.codec,
      channels: oldAudioFile.channels,
      channelLayout: oldAudioFile.channelLayout,
      bitrate: oldAudioFile.bitRate,
      timeBase: oldAudioFile.timeBase,
      duration: oldAudioFile.duration,
      sampleRate: null,
      language: oldAudioFile.language,
      default: true,
      chapters: oldAudioFile.chapters,
      createdAt: LibraryItem.createdAt,
      updatedAt: LibraryItem.updatedAt,
      mediaFileId: MediaFile.id
    }
    newRecords.mediaStream.push(MediaStream)

    if (oldAudioFile.embeddedCoverArt) {
      const CoverMediaStream = {
        id: uuidv4(),
        index: null,
        codecType: 'video',
        codec: oldAudioFile.embeddedCoverArt,
        default: true,
        createdAt: LibraryItem.createdAt,
        updatedAt: LibraryItem.updatedAt,
        mediaFileId: MediaFile.id
      }
      newRecords.mediaStream.push(CoverMediaStream)
    }

    const include = !oldAudioFile.exclude && !oldAudioFile.invalid

    const AudioTrack = {
      id: uuidv4(),
      mediaItemId: Book.id,
      mediaItemType: 'book',
      index: oldAudioFile.index,
      startOffset: include ? startOffset : null,
      duration: oldAudioFile.duration,
      title: oldAudioFile.metadata.filename,
      mimeType: getMimeType(MediaFile.formatName),
      codec: oldAudioFile.codec,
      trackNumber: oldAudioFile.trackNumFromMeta || oldAudioFile.trackNumFromFilename,
      discNumber: oldAudioFile.discNumFromMeta || oldAudioFile.discNumFromFilename,
      createdAt: LibraryItem.createdAt,
      updatedAt: LibraryItem.updatedAt,
      mediaFileId: MediaFile.id
    }
    newRecords.audioTrack.push(AudioTrack)

    if (include) {
      startOffset += AudioTrack.duration
    }
  }

  //
  // Migrate Tags
  //
  const oldTags = oldBook.tags || []
  for (const oldTag of oldTags) {
    const oldTagCleaned = oldTag.trim().toLowerCase()
    let tagId = oldDbIdMap.tags[oldTagCleaned]

    if (!tagId) {
      const Tag = {
        id: uuidv4(),
        name: oldTag,
        cleanName: oldTagCleaned,
        createdAt: LibraryItem.createdAt,
        updatedAt: LibraryItem.updatedAt
      }
      tagId = Tag.id
      newRecords.tag.push(Tag)
    }

    newRecords.bookTag.push({
      id: uuidv4(),
      bookId: Book.id,
      tagId
    })
  }

  //
  // Migrate BookChapters
  //
  for (const oldChapter of oldBook.chapters) {
    newRecords.bookChapter.push({
      id: uuidv4(),
      index: oldChapter.id,
      start: oldChapter.start,
      end: oldChapter.end,
      title: oldChapter.title,
      createdAt: LibraryItem.createdAt,
      updatedAt: LibraryItem.updatedAt,
      bookId: Book.id
    })
  }


  //
  // Migrate Genres
  //
  const oldGenres = oldBook.metadata.genres || []
  for (const oldGenre of oldGenres) {
    const oldGenreCleaned = oldGenre.trim().toLowerCase()
    let genreId = oldDbIdMap.genres[oldGenreCleaned]

    if (!genreId) {
      const Genre = {
        id: uuidv4(),
        name: oldGenre,
        cleanName: oldGenreCleaned,
        createdAt: LibraryItem.createdAt,
        updatedAt: LibraryItem.updatedAt
      }
      genreId = Genre.id
      newRecords.genre.push(Genre)
    }

    newRecords.bookGenre.push({
      id: uuidv4(),
      bookId: Book.id,
      genreId
    })
  }

  //
  // Migrate BookAuthors
  //
  for (const oldBookAuthor of oldBook.metadata.authors) {
    if (oldDbIdMap.people[oldBookAuthor.id]) {
      newRecords.bookAuthor.push({
        id: uuidv4(),
        authorId: oldDbIdMap.people[oldBookAuthor.id],
        bookId: Book.id
      })
    } else {
      Logger.warn(`[dbMigration] migrateBook: Book author not found "${oldBookAuthor.name}"`)
    }
  }

  //
  // Migrate BookNarrators
  //
  for (const oldBookNarrator of oldBook.metadata.narrators) {
    let personId = oldDbIdMap.people[oldBookNarrator]
    if (!personId) {
      const Person = {
        id: uuidv4(),
        type: 'narrator',
        name: oldBookNarrator,
        createdAt: LibraryItem.createdAt,
        updatedAt: LibraryItem.updatedAt
      }
      newRecords.person.push(Person)
      personId = Person.id
    }

    newRecords.bookNarrator.push({
      id: uuidv4(),
      narratorId: personId,
      bookId: Book.id
    })
  }

  //
  // Migrate BookSeries
  //
  for (const oldBookSeries of oldBook.metadata.series) {
    if (oldDbIdMap.series[oldBookSeries.id]) {
      const BookSeries = {
        id: uuidv4(),
        sequence: oldBookSeries.sequence,
        seriesId: oldDbIdMap.series[oldBookSeries.id],
        bookId: Book.id
      }
      newRecords.bookSeries.push(BookSeries)
    } else {
      Logger.warn(`[dbMigration] migrateBook: Series not found "${oldBookSeries.name}"`)
    }
  }
}

function migratePodcast(oldLibraryItem, LibraryItem) {
  const oldPodcast = oldLibraryItem.media
  const oldPodcastMetadata = oldPodcast.metadata

  //
  // Migrate ImageFile
  //
  let imageFileId = null
  if (oldPodcast.coverPath) {
    imageFileId = oldDbIdMap.files[oldPodcast.coverPath] || null
    if (!imageFileId) {
      const FileMetadata = {
        id: uuidv4(),
        filename: Path.basename(oldPodcast.coverPath),
        ext: Path.extname(oldPodcast.coverPath),
        path: oldPodcast.coverPath,
        createdAt: LibraryItem.createdAt,
        updatedAt: LibraryItem.updatedAt
      }
      newRecords.fileMetadata.push(FileMetadata)
      oldDbIdMap.files[oldPodcast.coverPath] = FileMetadata.id
      imageFileId = FileMetadata.id
    }
  }

  //
  // Migrate Podcast
  //
  const Podcast = {
    id: uuidv4(),
    title: oldPodcastMetadata.title,
    author: oldPodcastMetadata.author,
    releaseDate: oldPodcastMetadata.releaseDate,
    feedURL: oldPodcastMetadata.feedUrl,
    imageURL: oldPodcastMetadata.imageUrl,
    description: oldPodcastMetadata.description,
    itunesPageURL: oldPodcastMetadata.itunesPageUrl,
    itunesId: oldPodcastMetadata.itunesId,
    itunesArtistId: oldPodcastMetadata.itunesArtistId,
    language: oldPodcastMetadata.language,
    podcastType: oldPodcastMetadata.type,
    explicit: !!oldPodcastMetadata.explicit,
    autoDownloadEpisodes: !!oldPodcast.autoDownloadEpisodes,
    autoDownloadSchedule: oldPodcast.autoDownloadSchedule,
    lastEpisodeCheck: oldPodcast.lastEpisodeCheck,
    maxEpisodesToKeep: oldPodcast.maxEpisodesToKeep,
    maxNewEpisodesToDownload: oldPodcast.maxNewEpisodesToDownload,
    lastCoverSearchQuery: oldPodcast.lastCoverSearchQuery,
    lastCoverSearch: oldPodcast.lastCoverSearch,
    createdAt: LibraryItem.createdAt,
    updatedAt: LibraryItem.updatedAt,
    imageFileId,
  }
  newRecords.podcast.push(Podcast)
  oldDbIdMap.podcasts[oldLibraryItem.id] = Podcast.id

  //
  // Migrate Tags
  //
  const oldTags = oldPodcast.tags || []
  for (const oldTag of oldTags) {
    const oldTagCleaned = oldTag.trim().toLowerCase()
    let tagId = oldDbIdMap.tags[oldTagCleaned]

    if (!tagId) {
      const Tag = {
        id: uuidv4(),
        name: oldTag,
        cleanName: oldTagCleaned,
        createdAt: LibraryItem.createdAt,
        updatedAt: LibraryItem.updatedAt
      }
      tagId = Tag.id
      newRecords.tag.push(Tag)
    }

    newRecords.podcastTag.push({
      id: uuidv4(),
      podcastId: Podcast.id,
      tagId
    })
  }

  //
  // Migrate Genres
  //
  const oldGenres = oldPodcastMetadata.genres || []
  for (const oldGenre of oldGenres) {
    const oldGenreCleaned = oldGenre.trim().toLowerCase()
    let genreId = oldDbIdMap.genres[oldGenreCleaned]

    if (!genreId) {
      const Genre = {
        id: uuidv4(),
        name: oldGenre,
        cleanName: oldGenreCleaned,
        createdAt: LibraryItem.createdAt,
        updatedAt: LibraryItem.updatedAt
      }
      genreId = Genre.id
      newRecords.genre.push(Genre)
    }

    newRecords.podcastGenre.push({
      id: uuidv4(),
      podcastId: Podcast.id,
      genreId
    })
  }

  //
  // Migrate PodcastEpisodes
  //
  const oldEpisodes = oldPodcast.episodes || []
  for (const oldEpisode of oldEpisodes) {
    const oldAudioFile = oldEpisode.audioFile
    const fileMetadataId = oldDbIdMap.files[oldAudioFile.metadata.path]
    if (!fileMetadataId) {
      Logger.warn(`[dbMigration] migratePodcast: File metadata not found for audio file "${oldAudioFile.metadata.path}"`)
      continue
    }

    const PodcastEpisode = {
      id: uuidv4(),
      index: oldEpisode.index,
      season: oldEpisode.season,
      episode: oldEpisode.episode,
      episodeType: oldEpisode.episodeType,
      title: oldEpisode.title,
      subtitle: oldEpisode.subtitle,
      description: oldEpisode.description,
      pubDate: oldEpisode.pubDate,
      enclosureURL: oldEpisode.enclosure?.url || null,
      enclosureSize: oldEpisode.enclosure?.length || null,
      enclosureType: oldEpisode.enclosure?.type || null,
      publishedAt: oldEpisode.publishedAt,
      createdAt: oldEpisode.addedAt,
      updatedAt: oldEpisode.updatedAt,
      podcastId: Podcast.id
    }
    newRecords.podcastEpisode.push(PodcastEpisode)
    oldDbIdMap.podcastEpisodes[oldEpisode.id] = PodcastEpisode.id

    //
    // Migrate AudioTrack
    //
    const ext = oldAudioFile.metadata.ext || ''
    const MediaFile = {
      id: uuidv4(),
      formatName: ext.slice(1).toLowerCase(),
      formatNameLong: oldAudioFile.format,
      duration: oldAudioFile.duration,
      bitrate: oldAudioFile.bitRate,
      size: oldAudioFile.metadata.size,
      tags: cleanAudioFileMetaTags(oldAudioFile.metaTags),
      createdAt: LibraryItem.createdAt,
      updatedAt: LibraryItem.updatedAt,
      fileMetadataId
    }
    newRecords.mediaFile.push(MediaFile)

    const MediaStream = {
      id: uuidv4(),
      index: null,
      codecType: 'audio',
      codec: oldAudioFile.codec,
      channels: oldAudioFile.channels,
      channelLayout: oldAudioFile.channelLayout,
      bitrate: oldAudioFile.bitRate,
      timeBase: oldAudioFile.timeBase,
      duration: oldAudioFile.duration,
      sampleRate: null,
      language: oldAudioFile.language,
      default: true,
      chapters: oldAudioFile.chapters,
      createdAt: LibraryItem.createdAt,
      updatedAt: LibraryItem.updatedAt,
      mediaFileId: MediaFile.id
    }
    newRecords.mediaStream.push(MediaStream)

    if (oldAudioFile.embeddedCoverArt) {
      const CoverMediaStream = {
        id: uuidv4(),
        index: null,
        codecType: 'video',
        codec: oldAudioFile.embeddedCoverArt,
        default: true,
        createdAt: LibraryItem.createdAt,
        updatedAt: LibraryItem.updatedAt,
        mediaFileId: MediaFile.id
      }
      newRecords.mediaStream.push(CoverMediaStream)
    }

    const AudioTrack = {
      id: uuidv4(),
      mediaItemId: PodcastEpisode.id,
      mediaItemType: 'podcastEpisode',
      index: oldAudioFile.index,
      startOffset: 0,
      duration: oldAudioFile.duration,
      title: oldAudioFile.metadata.filename,
      mimeType: getMimeType(MediaFile.formatName),
      codec: oldAudioFile.codec,
      trackNumber: oldAudioFile.trackNumFromMeta || oldAudioFile.trackNumFromFilename,
      discNumber: oldAudioFile.discNumFromMeta || oldAudioFile.discNumFromFilename,
      createdAt: LibraryItem.createdAt,
      updatedAt: LibraryItem.updatedAt,
      mediaFileId: MediaFile.id
    }
    newRecords.audioTrack.push(AudioTrack)
  }
}

function migrateLibraryItems(oldLibraryItems) {
  for (const oldLibraryItem of oldLibraryItems) {
    const libraryFolderId = oldDbIdMap.libraryFolders[oldLibraryItem.folderId]
    if (!libraryFolderId) {
      Logger.error(`[dbMigration] migrateLibraryItems: Old library folder id not found "${oldLibraryItem.folderId}"`)
      continue
    }

    //
    // Migrate LibraryItem
    //
    const LibraryItem = {
      id: uuidv4(),
      ino: oldLibraryItem.ino,
      path: oldLibraryItem.path,
      relPath: oldLibraryItem.relPath,
      mediaId: null, // set below
      mediaType: oldLibraryItem.mediaType,
      isFile: !!oldLibraryItem.isFile,
      isMissing: !!oldLibraryItem.isMissing,
      isInvalid: !!oldLibraryItem.isInvalid,
      mtime: oldLibraryItem.mtimeMs,
      ctime: oldLibraryItem.ctimeMs,
      birthtime: oldLibraryItem.birthtimeMs,
      lastScan: oldLibraryItem.lastScan,
      lastScanVersion: oldLibraryItem.scanVersion,
      createdAt: oldLibraryItem.addedAt,
      updatedAt: oldLibraryItem.updatedAt,
      libraryFolderId
    }
    oldDbIdMap.libraryItems[oldLibraryItem.id] = LibraryItem.id
    newRecords.libraryItem.push(LibraryItem)

    //
    // Migrate LibraryFiles
    //
    for (const oldLibraryFile of oldLibraryItem.libraryFiles) {
      const FileMetadata = {
        id: uuidv4(),
        ino: oldLibraryFile.ino,
        filename: oldLibraryFile.metadata.filename,
        ext: oldLibraryFile.metadata.ext,
        path: oldLibraryFile.metadata.path,
        size: oldLibraryFile.metadata.size,
        mtime: oldLibraryFile.metadata.mtimeMs,
        ctime: oldLibraryFile.metadata.ctimeMs,
        birthtime: oldLibraryFile.metadata.birthtimeMs,
        createdAt: oldLibraryFile.addedAt || Date.now(),
        updatedAt: oldLibraryFile.updatedAt || Date.now()
      }
      newRecords.fileMetadata.push(FileMetadata)
      oldDbIdMap.files[FileMetadata.path] = FileMetadata.id

      const LibraryFile = {
        id: uuidv4(),
        createdAt: FileMetadata.createdAt,
        updatedAt: FileMetadata.updatedAt,
        fileMetadataId: FileMetadata.id,
        libraryItemId: LibraryItem.id
      }
      newRecords.libraryFile.push(LibraryFile)
    }

    // 
    // Migrate Book/Podcast
    //
    if (oldLibraryItem.mediaType === 'book') {
      migrateBook(oldLibraryItem, LibraryItem)
      LibraryItem.mediaId = oldDbIdMap.books[oldLibraryItem.id]
    } else if (oldLibraryItem.mediaType === 'podcast') {
      migratePodcast(oldLibraryItem, LibraryItem)
      LibraryItem.mediaId = oldDbIdMap.podcasts[oldLibraryItem.id]
    }
  }
}

function migrateLibraries(oldLibraries) {
  for (const oldLibrary of oldLibraries) {
    // 
    // Migrate Library
    //
    const Library = {
      id: uuidv4(),
      name: oldLibrary.name,
      displayOrder: oldLibrary.displayOrder,
      icon: oldLibrary.icon || null,
      mediaType: oldLibrary.mediaType || null,
      provider: oldLibrary.provider,
      createdAt: oldLibrary.createdAt,
      updatedAt: oldLibrary.lastUpdate
    }
    oldDbIdMap.libraries[oldLibrary.id] = Library.id
    newRecords.library.push(Library)

    // 
    // Migrate LibrarySettings
    //
    const oldLibrarySettings = oldLibrary.settings || {}
    for (const oldSettingsKey in oldLibrarySettings) {
      newRecords.librarySetting.push({
        id: uuidv4(),
        key: oldSettingsKey,
        value: oldLibrarySettings[oldSettingsKey],
        createdAt: oldLibrary.createdAt,
        updatedAt: oldLibrary.lastUpdate,
        libraryId: Library.id
      })
    }

    // 
    // Migrate LibraryFolders
    //
    for (const oldFolder of oldLibrary.folders) {
      const LibraryFolder = {
        id: uuidv4(),
        path: oldFolder.fullPath,
        createdAt: oldFolder.addedAt,
        updatedAt: oldLibrary.lastUpdate,
        libraryId: Library.id
      }
      oldDbIdMap.libraryFolders[oldFolder.id] = LibraryFolder.id
      newRecords.libraryFolder.push(LibraryFolder)
    }
  }
}

function migrateAuthors(oldAuthors) {
  for (const oldAuthor of oldAuthors) {
    let imageFileId = null
    if (oldAuthor.imagePath) {
      const FileMetadata = {
        id: uuidv4(),
        filename: Path.basename(oldAuthor.imagePath),
        ext: Path.extname(oldAuthor.imagePath),
        path: oldAuthor.imagePath,
        createdAt: oldAuthor.addedAt || Date.now(),
        updatedAt: oldAuthor.updatedAt || Date.now()
      }
      newRecords.fileMetadata.push(FileMetadata)
      imageFileId = FileMetadata.id
    }

    const Person = {
      id: uuidv4(),
      type: 'author',
      name: oldAuthor.name,
      asin: oldAuthor.asin || null,
      description: oldAuthor.description,
      createdAt: oldAuthor.addedAt || Date.now(),
      updatedAt: oldAuthor.updatedAt || Date.now(),
      imageFileId
    }
    oldDbIdMap.people[oldAuthor.id] = Person.id
    newRecords.person.push(Person)
  }
}

function migrateSeries(oldSerieses) {
  for (const oldSeries of oldSerieses) {
    const Series = {
      id: uuidv4(),
      name: oldSeries.name,
      description: oldSeries.description || null,
      createdAt: oldSeries.addedAt || Date.now(),
      updatedAt: oldSeries.updatedAt || Date.now()
    }
    oldDbIdMap.series[oldSeries.id] = Series.id
    newRecords.series.push(Series)
  }
}

function migrateUsers(oldUsers) {
  for (const oldUser of oldUsers) {
    // 
    // Migrate User
    //
    const User = {
      id: uuidv4(),
      username: oldUser.username,
      pash: oldUser.pash || null,
      type: oldUser.type || null,
      token: oldUser.token || null,
      isActive: !!oldUser.isActive,
      lastSeen: oldUser.lastSeen || null,
      extraData: {
        seriesHideFromContinueListening: oldUser.seriesHideFromContinueListening || []
      },
      createdAt: oldUser.createdAt || Date.now()
    }
    oldDbIdMap.users[oldUser.id] = User.id
    newRecords.user.push(User)

    // 
    // Migrate UserPermissions
    //
    for (const oldUserPermission in oldUser.permissions) {
      if (!['accessAllLibraries', 'accessAllTags'].includes(oldUserPermission)) {
        const UserPermission = {
          id: uuidv4(),
          key: oldUserPermission,
          value: !!oldUser.permissions[oldUserPermission],
          createdAt: User.createdAt,
          userId: User.id
        }
        newRecords.userPermission.push(UserPermission)
      }
    }
    if (oldUser.librariesAccessible?.length) {
      const UserPermission = {
        id: uuidv4(),
        key: 'librariesAccessible',
        value: JSON.stringify(oldUser.librariesAccessible),
        createdAt: User.createdAt,
        userId: User.id
      }
      newRecords.userPermission.push(UserPermission)
    }
    if (oldUser.itemTagsAccessible?.length) {
      const UserPermission = {
        id: uuidv4(),
        key: 'itemTagsAccessible',
        value: JSON.stringify(oldUser.itemTagsAccessible),
        createdAt: User.createdAt,
        userId: User.id
      }
      newRecords.userPermission.push(UserPermission)
    }

    // 
    // Migrate MediaProgress
    //
    for (const oldMediaProgress of oldUser.mediaProgress) {
      let mediaItemType = 'book'
      let mediaItemId = null
      if (oldMediaProgress.episodeId) {
        mediaItemType = 'podcastEpisode'
        mediaItemId = oldDbIdMap.podcastEpisodes[oldMediaProgress.episodeId]
      } else {
        mediaItemId = oldDbIdMap.books[oldMediaProgress.libraryItemId]
      }

      if (!mediaItemId) {
        Logger.warn(`[dbMigration] migrateUsers: Unable to find media item for media progress "${oldMediaProgress.id}"`)
        continue
      }

      const MediaProgress = {
        id: uuidv4(),
        mediaItemId,
        mediaItemType,
        duration: oldMediaProgress.duration,
        currentTime: oldMediaProgress.currentTime,
        isFinished: !!oldMediaProgress.isFinished,
        hideFromContinueListening: !!oldMediaProgress.hideFromContinueListening,
        finishedAt: oldMediaProgress.finishedAt,
        createdAt: oldMediaProgress.startedAt || oldMediaProgress.lastUpdate,
        updatedAt: oldMediaProgress.lastUpdate,
        userId: User.id
      }
      newRecords.mediaProgress.push(MediaProgress)
    }

    // 
    // Migrate AudioBookmarks
    //
    for (const oldBookmark of oldUser.bookmarks) {
      const mediaItemId = oldDbIdMap.books[oldBookmark.libraryItemId]
      if (!mediaItemId) {
        Logger.warn(`[dbMigration] migrateUsers: Unable to find media item for audio bookmark "${oldBookmark.id}"`)
        continue
      }

      const AudioBookmark = {
        id: uuidv4(),
        mediaItemId,
        mediaItemType: 'book',
        title: oldBookmark.title,
        time: oldBookmark.time,
        createdAt: oldBookmark.createdAt,
        updatedAt: oldBookmark.createdAt,
        userId: User.id
      }
      newRecords.audioBookmark.push(AudioBookmark)
    }
  }
}

function migrateSessions(oldSessions) {
  for (const oldSession of oldSessions) {
    const userId = oldDbIdMap.users[oldSession.userId] || null // Can be null

    //
    // Migrate Device
    //
    let deviceId = null
    if (oldSession.deviceInfo) {
      const oldDeviceInfo = oldSession.deviceInfo
      const deviceInfoStr = getDeviceInfoString(oldDeviceInfo, userId)
      deviceId = oldDbIdMap.devices[deviceInfoStr]
      if (!deviceId) {
        let clientName = 'Unknown'
        let clientVersion = null
        let deviceName = null
        let deviceVersion = oldDeviceInfo.browserVersion || null
        if (oldDeviceInfo.sdkVersion) {
          clientName = 'Abs Android'
          clientVersion = oldDeviceInfo.clientVersion || null
          deviceName = `${oldDeviceInfo.manufacturer} ${oldDeviceInfo.model}`
          deviceVersion = oldDeviceInfo.sdkVersion
        } else if (oldDeviceInfo.model) {
          clientName = 'Abs iOS'
          clientVersion = oldDeviceInfo.clientVersion || null
          deviceName = `${oldDeviceInfo.manufacturer} ${oldDeviceInfo.model}`
        } else if (oldDeviceInfo.osName && oldDeviceInfo.browserName) {
          clientName = 'Abs Web'
          clientVersion = oldDeviceInfo.serverVersion || null
          deviceName = `${oldDeviceInfo.osName} ${oldDeviceInfo.osVersion || 'N/A'} ${oldDeviceInfo.browserName}`
        }

        const id = uuidv4()
        const Device = {
          id,
          identifier: id, // Temp for migration
          clientName,
          clientVersion,
          ipAddress: oldDeviceInfo.ipAddress,
          deviceName, // e.g. Windows 10 Chrome, Google Pixel 6, Apple iPhone 10,3
          deviceVersion,
          userId
        }
        newRecords.device.push(Device)
        oldDbIdMap.devices[deviceInfoStr] = Device.id
      }
    }


    //
    // Migrate PlaybackSession
    //
    let mediaItemId = null
    let mediaItemType = 'book'
    if (oldSession.mediaType === 'podcast') {
      mediaItemId = oldDbIdMap.podcastEpisodes[oldSession.episodeId] || null
      mediaItemType = 'podcastEpisode'
    } else {
      mediaItemId = oldDbIdMap.books[oldSession.libraryItemId] || null
    }

    const PlaybackSession = {
      id: uuidv4(),
      mediaItemId, // Can be null
      mediaItemType,
      displayTitle: oldSession.displayTitle,
      displayAuthor: oldSession.displayAuthor,
      duration: oldSession.duration,
      playMethod: oldSession.playMethod,
      mediaPlayer: oldSession.mediaPlayer,
      startTime: oldSession.startTime,
      currentTime: oldSession.currentTime,
      serverVersion: oldSession.deviceInfo?.serverVersion || null,
      createdAt: oldSession.startedAt,
      updatedAt: oldSession.updatedAt,
      userId, // Can be null
      deviceId
    }
    newRecords.playbackSession.push(PlaybackSession)

    if (oldSession.timeListening) {
      const PlaybackSessionListenTime = {
        id: uuidv4(),
        time: Math.min(Math.round(oldSession.timeListening), 86400), // Max time will be 24 hours,
        date: oldSession.date || dateAndTime.format(new Date(PlaybackSession.createdAt), 'YYYY-MM-DD'),
        createdAt: PlaybackSession.createdAt,
        updatedAt: PlaybackSession.updatedAt,
        playbackSessionId: PlaybackSession.id
      }
      newRecords.playbackSessionListenTime.push(PlaybackSessionListenTime)
    }
  }
}

function migrateCollections(oldCollections) {
  for (const oldCollection of oldCollections) {
    const libraryId = oldDbIdMap.libraries[oldCollection.libraryId]
    if (!libraryId) {
      Logger.warn(`[dbMigration] migrateCollections: Library not found for collection "${oldCollection.name}" (id:${oldCollection.libraryId})`)
      continue
    }

    const BookIds = oldCollection.books.map(lid => oldDbIdMap.books[lid]).filter(bid => bid)
    if (!BookIds.length) {
      Logger.warn(`[dbMigration] migrateCollections: Collection "${oldCollection.name}" has no books`)
      continue
    }

    const Collection = {
      id: uuidv4(),
      name: oldCollection.name,
      description: oldCollection.description,
      createdAt: oldCollection.createdAt,
      updatedAt: oldCollection.lastUpdate,
      libraryId
    }
    oldDbIdMap.collections[oldCollection.id] = Collection.id
    newRecords.collection.push(Collection)

    BookIds.forEach((bookId) => {
      const CollectionBook = {
        id: uuidv4(),
        createdAt: Collection.createdAt,
        bookId,
        collectionId: Collection.id
      }
      newRecords.collectionBook.push(CollectionBook)
    })
  }
}

function migratePlaylists(oldPlaylists) {
  for (const oldPlaylist of oldPlaylists) {
    const libraryId = oldDbIdMap.libraries[oldPlaylist.libraryId]
    if (!libraryId) {
      Logger.warn(`[dbMigration] migratePlaylists: Library not found for playlist "${oldPlaylist.name}" (id:${oldPlaylist.libraryId})`)
      continue
    }

    const userId = oldDbIdMap.users[oldPlaylist.userId]
    if (!userId) {
      Logger.warn(`[dbMigration] migratePlaylists: User not found for playlist "${oldPlaylist.name}" (id:${oldPlaylist.userId})`)
      continue
    }

    let mediaItemType = 'book'
    let MediaItemIds = []
    oldPlaylist.items.forEach((itemObj) => {
      if (itemObj.episodeId) {
        mediaItemType = 'podcastEpisode'
        if (oldDbIdMap.podcastEpisodes[itemObj.episodeId]) {
          MediaItemIds.push(oldDbIdMap.podcastEpisodes[itemObj.episodeId])
        }
      } else if (oldDbIdMap.books[itemObj.libraryItemId]) {
        MediaItemIds.push(oldDbIdMap.books[itemObj.libraryItemId])
      }
    })
    if (!MediaItemIds.length) {
      Logger.warn(`[dbMigration] migratePlaylists: Playlist "${oldPlaylist.name}" has no items`)
      continue
    }

    const Playlist = {
      id: uuidv4(),
      name: oldPlaylist.name,
      description: oldPlaylist.description,
      createdAt: oldPlaylist.createdAt,
      updatedAt: oldPlaylist.lastUpdate,
      userId,
      libraryId
    }
    newRecords.playlist.push(Playlist)

    MediaItemIds.forEach((mediaItemId) => {
      const PlaylistMediaItem = {
        id: uuidv4(),
        mediaItemId,
        mediaItemType,
        createdAt: Playlist.createdAt,
        playlistId: Playlist.id
      }
      newRecords.playlistMediaItem.push(PlaylistMediaItem)
    })
  }
}

function migrateFeeds(oldFeeds) {
  for (const oldFeed of oldFeeds) {
    if (!oldFeed.episodes?.length) {
      continue
    }

    let entityId = null

    if (oldFeed.entityType === 'collection') {
      entityId = oldDbIdMap.collections[oldFeed.entityId]
    } else if (oldFeed.entityType === 'libraryItem') {
      entityId = oldDbIdMap.libraryItems[oldFeed.entityId]
    } else if (oldFeed.entityType === 'series') {
      entityId = oldDbIdMap.series[oldFeed.entityId]
    }

    if (!entityId) {
      Logger.warn(`[dbMigration] migrateFeeds: Entity not found for feed "${oldFeed.entityType}" (id:${oldFeed.entityId})`)
      continue
    }

    const userId = oldDbIdMap.users[oldFeed.userId]
    if (!userId) {
      Logger.warn(`[dbMigration] migrateFeeds: User not found for feed (id:${oldFeed.userId})`)
      continue
    }

    const oldFeedMeta = oldFeed.meta

    const Feed = {
      id: uuidv4(),
      slug: oldFeed.slug,
      entityType: oldFeed.entityType,
      entityId,
      entityUpdatedAt: oldFeed.entityUpdatedAt,
      serverAddress: oldFeed.serverAddress,
      feedURL: oldFeed.feedUrl,
      imageURL: oldFeedMeta.imageUrl,
      siteURL: oldFeedMeta.link,
      title: oldFeedMeta.title,
      description: oldFeedMeta.description,
      author: oldFeedMeta.author,
      podcastType: oldFeedMeta.type || null,
      language: oldFeedMeta.language || null,
      ownerName: oldFeedMeta.ownerName || null,
      ownerEmail: oldFeedMeta.ownerEmail || null,
      explicit: !!oldFeedMeta.explicit,
      preventIndexing: !!oldFeedMeta.preventIndexing,
      createdAt: oldFeed.createdAt,
      updatedAt: oldFeed.updatedAt,
      userId
    }
    newRecords.feed.push(Feed)

    //
    // Migrate FeedEpisodes
    //
    for (const oldFeedEpisode of oldFeed.episodes) {
      const FeedEpisode = {
        id: uuidv4(),
        title: oldFeedEpisode.title,
        author: oldFeedEpisode.author,
        description: oldFeedEpisode.description,
        siteURL: oldFeedEpisode.link,
        enclosureURL: oldFeedEpisode.enclosure?.url || null,
        enclosureType: oldFeedEpisode.enclosure?.type || null,
        enclosureSize: oldFeedEpisode.enclosure?.size || null,
        pubDate: oldFeedEpisode.pubDate,
        season: oldFeedEpisode.season || null,
        episode: oldFeedEpisode.episode || null,
        episodeType: oldFeedEpisode.episodeType || null,
        duration: oldFeedEpisode.duration,
        filePath: oldFeedEpisode.fullPath,
        explicit: !!oldFeedEpisode.explicit,
        createdAt: oldFeed.createdAt,
        updatedAt: oldFeed.updatedAt,
        feedId: Feed.id
      }
      newRecords.feedEpisode.push(FeedEpisode)
    }
  }
}

function migrateSettings(oldSettings) {
  const serverSettings = oldSettings.find(s => s.id === 'server-settings')
  const notificationSettings = oldSettings.find(s => s.id === 'notification-settings')

  if (serverSettings) {
    for (const serverSettingsKey in serverSettings) {
      if (serverSettingsKey === 'id') continue

      let value = serverSettings[serverSettingsKey]
      if (value === undefined) value = null
      else if (serverSettingsKey === 'sortingPrefixes') value = JSON.stringify(value)

      newRecords.setting.push({
        key: serverSettingsKey,
        value,
        type: 0
      })
    }
  }

  if (notificationSettings) {
    const cleanedCopy = {
      appriseApiUrl: notificationSettings.appriseApiUrl || null,
      notificationMaxFailedAttempts: notificationSettings.maxFailedAttempts ?? 5,
      notificationMaxQueue: notificationSettings.maxNotificationQueue ?? 20,
      notificationDelay: notificationSettings.notificationDelay ?? 1000 // ms delay between firing notifications
    }
    for (const notificationSettingKey in cleanedCopy) {
      newRecords.setting.push({
        key: notificationSettingKey,
        value: cleanedCopy[notificationSettingKey],
        type: 1
      })
    }

    //
    // Migrate Notifications
    //
    if (notificationSettings.notifications?.length) {
      for (const oldNotification of notificationSettings.notifications) {

        const Notification = {
          id: uuidv4(),
          eventName: oldNotification.eventName,
          urls: JSON.stringify(oldNotification.urls), // JSON array of urls
          titleTemplate: oldNotification.titleTemplate,
          bodyTemplate: oldNotification.bodyTemplate,
          type: oldNotification.type,
          lastFiredAt: oldNotification.lastFiredAt,
          lastAttemptFailed: oldNotification.lastAttemptFailed,
          numConsecutiveFailedAttempts: oldNotification.numConsecutiveFailedAttempts,
          numTimesFired: oldNotification.numTimesFired,
          enabled: !!oldNotification.enabled,
          createdAt: oldNotification.createdAt,
          updatedAt: oldNotification.createdAt
        }
        newRecords.notification.push(Notification)
      }
    }
  }
}

module.exports.migrate = async () => {
  Logger.info(`[dbMigration] Starting migration`)

  const data = await oldDbFiles.init()

  const start = Date.now()
  migrateAuthors(data.authors)
  migrateSeries(data.series)
  migrateLibraries(data.libraries)
  migrateLibraryItems(data.libraryItems)
  migrateUsers(data.users)
  migrateSessions(data.sessions)
  migrateCollections(data.collections)
  migratePlaylists(data.playlists)
  migrateFeeds(data.feeds)
  migrateSettings(data.settings)

  let totalRecords = 0
  for (const model in newRecords) {
    Logger.info(`[dbMigration] Inserting ${newRecords[model].length} ${model} rows`)
    if (newRecords[model].length) {
      await Database.models[model].bulkCreate(newRecords[model])
      totalRecords += newRecords[model].length
    }
  }

  const elapsed = Date.now() - start

  Logger.info(`[dbMigration] Migration complete. ${totalRecords} rows. Elapsed ${(elapsed / 1000).toFixed(2)}s`)
}