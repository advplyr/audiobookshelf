const Path = require('path')
const uuidv4 = require("uuid").v4
const Logger = require('../../Logger')
const fs = require('../../libs/fsExtra')
const oldDbFiles = require('./oldDbFiles')

const oldDbIdMap = {
  users: {},
  libraries: {},
  libraryFolders: {},
  libraryItems: {},
  authors: {}, // key is (new) library id with another map of author ids
  series: {}, // key is (new) library id with another map of series ids
  collections: {},
  podcastEpisodes: {},
  books: {}, // key is library item id
  podcasts: {}, // key is library item id
  devices: {} // key is a json stringify of the old DeviceInfo data OR deviceId if it exists
}
const newRecords = {
  user: [],
  library: [],
  libraryFolder: [],
  author: [],
  book: [],
  podcast: [],
  libraryItem: [],
  bookAuthor: [],
  series: [],
  bookSeries: [],
  podcastEpisode: [],
  mediaProgress: [],
  device: [],
  playbackSession: [],
  collection: [],
  collectionBook: [],
  playlist: [],
  playlistMediaItem: [],
  feed: [],
  feedEpisode: [],
  setting: []
}

function getDeviceInfoString(deviceInfo, UserId) {
  if (!deviceInfo) return null
  if (deviceInfo.deviceId) return deviceInfo.deviceId

  const keys = [
    UserId,
    deviceInfo.browserName || null,
    deviceInfo.browserVersion || null,
    deviceInfo.osName || null,
    deviceInfo.osVersion || null,
    deviceInfo.clientVersion || null,
    deviceInfo.manufacturer || null,
    deviceInfo.model || null,
    deviceInfo.sdkVersion || null,
    deviceInfo.ipAddress || null
  ].map(k => k || '')
  return 'temp-' + Buffer.from(keys.join('-'), 'utf-8').toString('base64')
}

function migrateBook(oldLibraryItem, LibraryItem) {
  const oldBook = oldLibraryItem.media

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
    abridged: !!oldBook.metadata.abridged,
    lastCoverSearchQuery: oldBook.lastCoverSearchQuery,
    lastCoverSearch: oldBook.lastCoverSearch,
    createdAt: LibraryItem.createdAt,
    updatedAt: LibraryItem.updatedAt,
    narrators: oldBook.metadata.narrators,
    ebookFile: oldBook.ebookFile,
    coverPath: oldBook.coverPath,
    audioFiles: oldBook.audioFiles,
    chapters: oldBook.chapters,
    tags: oldBook.tags,
    genres: oldBook.metadata.genres
  }
  newRecords.book.push(Book)
  oldDbIdMap.books[oldLibraryItem.id] = Book.id

  //
  // Migrate BookAuthors
  //
  for (const oldBookAuthor of oldBook.metadata.authors) {
    if (oldDbIdMap.authors[LibraryItem.libraryId][oldBookAuthor.id]) {
      newRecords.bookAuthor.push({
        id: uuidv4(),
        authorId: oldDbIdMap.authors[LibraryItem.libraryId][oldBookAuthor.id],
        bookId: Book.id
      })
    } else {
      Logger.warn(`[dbMigration] migrateBook: Book author not found "${oldBookAuthor.name}"`)
    }
  }

  //
  // Migrate BookSeries
  //
  for (const oldBookSeries of oldBook.metadata.series) {
    if (oldDbIdMap.series[LibraryItem.libraryId][oldBookSeries.id]) {
      const BookSeries = {
        id: uuidv4(),
        sequence: oldBookSeries.sequence,
        seriesId: oldDbIdMap.series[LibraryItem.libraryId][oldBookSeries.id],
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
    maxEpisodesToKeep: oldPodcast.maxEpisodesToKeep || 0,
    maxNewEpisodesToDownload: oldPodcast.maxNewEpisodesToDownload || 3,
    lastCoverSearchQuery: oldPodcast.lastCoverSearchQuery,
    lastCoverSearch: oldPodcast.lastCoverSearch,
    createdAt: LibraryItem.createdAt,
    updatedAt: LibraryItem.updatedAt,
    coverPath: oldPodcast.coverPath,
    tags: oldPodcast.tags,
    genres: oldPodcastMetadata.genres
  }
  newRecords.podcast.push(Podcast)
  oldDbIdMap.podcasts[oldLibraryItem.id] = Podcast.id

  //
  // Migrate PodcastEpisodes
  //
  const oldEpisodes = oldPodcast.episodes || []
  for (const oldEpisode of oldEpisodes) {
    oldEpisode.audioFile.index = 1

    const PodcastEpisode = {
      id: uuidv4(),
      index: oldEpisode.index,
      season: oldEpisode.season || null,
      episode: oldEpisode.episode || null,
      episodeType: oldEpisode.episodeType || null,
      title: oldEpisode.title,
      subtitle: oldEpisode.subtitle || null,
      description: oldEpisode.description || null,
      pubDate: oldEpisode.pubDate || null,
      enclosureURL: oldEpisode.enclosure?.url || null,
      enclosureSize: oldEpisode.enclosure?.length || null,
      enclosureType: oldEpisode.enclosure?.type || null,
      publishedAt: oldEpisode.publishedAt || null,
      createdAt: oldEpisode.addedAt,
      updatedAt: oldEpisode.updatedAt,
      podcastId: Podcast.id,
      audioFile: oldEpisode.audioFile,
      chapters: oldEpisode.chapters || []
    }
    newRecords.podcastEpisode.push(PodcastEpisode)
    oldDbIdMap.podcastEpisodes[oldEpisode.id] = PodcastEpisode.id
  }
}

function migrateLibraryItems(oldLibraryItems) {
  for (const oldLibraryItem of oldLibraryItems) {
    const libraryFolderId = oldDbIdMap.libraryFolders[oldLibraryItem.folderId]
    if (!libraryFolderId) {
      Logger.error(`[dbMigration] migrateLibraryItems: Old library folder id not found "${oldLibraryItem.folderId}"`)
      continue
    }
    const libraryId = oldDbIdMap.libraries[oldLibraryItem.libraryId]
    if (!libraryId) {
      Logger.error(`[dbMigration] migrateLibraryItems: Old library id not found "${oldLibraryItem.libraryId}"`)
      continue
    }
    if (!['book', 'podcast'].includes(oldLibraryItem.mediaType)) {
      Logger.error(`[dbMigration] migrateLibraryItems: Not migrating library item with mediaType=${oldLibraryItem.mediaType}`)
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
      libraryId,
      libraryFolderId,
      libraryFiles: oldLibraryItem.libraryFiles.map(lf => {
        if (lf.isSupplementary === undefined) lf.isSupplementary = null
        return lf
      })
    }
    oldDbIdMap.libraryItems[oldLibraryItem.id] = LibraryItem.id
    newRecords.libraryItem.push(LibraryItem)

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
    if (!['book', 'podcast'].includes(oldLibrary.mediaType)) {
      Logger.error(`[dbMigration] migrateLibraries: Not migrating library with mediaType=${oldLibrary.mediaType}`)
      continue
    }

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
      settings: oldLibrary.settings || {},
      createdAt: oldLibrary.createdAt,
      updatedAt: oldLibrary.lastUpdate
    }
    oldDbIdMap.libraries[oldLibrary.id] = Library.id
    newRecords.library.push(Library)

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

function migrateAuthors(oldAuthors, oldLibraryItems) {
  for (const oldAuthor of oldAuthors) {
    // Get an array of NEW library ids that have this author
    const librariesWithThisAuthor = [...new Set(oldLibraryItems.map(li => {
      if (!li.media.metadata.authors?.some(au => au.id === oldAuthor.id)) return null
      if (!oldDbIdMap.libraries[li.libraryId]) {
        Logger.warn(`[dbMigration] Authors library id ${li.libraryId} was not migrated`)
      }
      return oldDbIdMap.libraries[li.libraryId]
    }).filter(lid => lid))]

    if (!librariesWithThisAuthor.length) {
      Logger.error(`[dbMigration] Author ${oldAuthor.name} was not found in any libraries`)
    }

    for (const libraryId of librariesWithThisAuthor) {
      const Author = {
        id: uuidv4(),
        name: oldAuthor.name,
        asin: oldAuthor.asin || null,
        description: oldAuthor.description,
        imagePath: oldAuthor.imagePath,
        createdAt: oldAuthor.addedAt || Date.now(),
        updatedAt: oldAuthor.updatedAt || Date.now(),
        libraryId
      }
      if (!oldDbIdMap.authors[libraryId]) oldDbIdMap.authors[libraryId] = {}
      oldDbIdMap.authors[libraryId][oldAuthor.id] = Author.id
      newRecords.author.push(Author)
    }
  }
}

function migrateSeries(oldSerieses, oldLibraryItems) {
  // Originaly series were shared between libraries if they had the same name
  // Series will be separate between libraries
  for (const oldSeries of oldSerieses) {
    // Get an array of NEW library ids that have this series
    const librariesWithThisSeries = [...new Set(oldLibraryItems.map(li => {
      if (!li.media.metadata.series?.some(se => se.id === oldSeries.id)) return null
      return oldDbIdMap.libraries[li.libraryId]
    }).filter(lid => lid))]

    if (!librariesWithThisSeries.length) {
      Logger.error(`[dbMigration] Series ${oldSeries.name} was not found in any libraries`)
    }

    for (const libraryId of librariesWithThisSeries) {
      const Series = {
        id: uuidv4(),
        name: oldSeries.name,
        description: oldSeries.description || null,
        createdAt: oldSeries.addedAt || Date.now(),
        updatedAt: oldSeries.updatedAt || Date.now(),
        libraryId
      }
      if (!oldDbIdMap.series[libraryId]) oldDbIdMap.series[libraryId] = {}
      oldDbIdMap.series[libraryId][oldSeries.id] = Series.id
      newRecords.series.push(Series)
    }
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
        seriesHideFromContinueListening: oldUser.seriesHideFromContinueListening || [],
        oldUserId: oldUser.id // Used to keep old tokens
      },
      createdAt: oldUser.createdAt || Date.now(),
      permissions: {
        ...oldUser.permissions,
        librariesAccessible: oldUser.librariesAccessible || [],
        itemTagsSelected: oldUser.itemTagsSelected || []
      },
      bookmarks: oldUser.bookmarks
    }
    oldDbIdMap.users[oldUser.id] = User.id
    newRecords.user.push(User)

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
        ebookLocation: oldMediaProgress.ebookLocation || null,
        ebookProgress: oldMediaProgress.ebookProgress || null,
        isFinished: !!oldMediaProgress.isFinished,
        hideFromContinueListening: !!oldMediaProgress.hideFromContinueListening,
        finishedAt: oldMediaProgress.finishedAt,
        createdAt: oldMediaProgress.startedAt || oldMediaProgress.lastUpdate,
        updatedAt: oldMediaProgress.lastUpdate,
        userId: User.id,
        extraData: {
          libraryItemId: oldDbIdMap.libraryItems[oldMediaProgress.libraryItemId],
          progress: oldMediaProgress.progress
        }
      }
      newRecords.mediaProgress.push(MediaProgress)
    }
  }
}

function migrateSessions(oldSessions) {
  for (const oldSession of oldSessions) {
    const userId = oldDbIdMap.users[oldSession.userId]
    if (!userId) {
      Logger.debug(`[dbMigration] Not migrating playback session ${oldSession.id} because user was not found`)
      continue
    }

    //
    // Migrate Device
    //
    let deviceId = null
    if (oldSession.deviceInfo) {
      const oldDeviceInfo = oldSession.deviceInfo
      const deviceDeviceId = getDeviceInfoString(oldDeviceInfo, userId)
      deviceId = oldDbIdMap.devices[deviceDeviceId]
      if (!deviceId) {
        let clientName = 'Unknown'
        let clientVersion = null
        let deviceName = null
        let deviceVersion = oldDeviceInfo.browserVersion || null
        let extraData = {}
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

        if (oldDeviceInfo.manufacturer) {
          extraData.manufacturer = oldDeviceInfo.manufacturer
        }
        if (oldDeviceInfo.model) {
          extraData.model = oldDeviceInfo.model
        }
        if (oldDeviceInfo.osName) {
          extraData.osName = oldDeviceInfo.osName
        }
        if (oldDeviceInfo.osVersion) {
          extraData.osVersion = oldDeviceInfo.osVersion
        }
        if (oldDeviceInfo.browserName) {
          extraData.browserName = oldDeviceInfo.browserName
        }

        const id = uuidv4()
        const Device = {
          id,
          deviceId: deviceDeviceId,
          clientName,
          clientVersion,
          ipAddress: oldDeviceInfo.ipAddress,
          deviceName, // e.g. Windows 10 Chrome, Google Pixel 6, Apple iPhone 10,3
          deviceVersion,
          userId,
          extraData
        }
        newRecords.device.push(Device)
        oldDbIdMap.devices[deviceDeviceId] = Device.id
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
      libraryId: oldDbIdMap.libraries[oldSession.libraryId] || null,
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
      deviceId,
      timeListening: oldSession.timeListening,
      coverPath: oldSession.coverPath,
      mediaMetadata: oldSession.mediaMetadata,
      date: oldSession.date,
      dayOfWeek: oldSession.dayOfWeek,
      extraData: {
        libraryItemId: oldDbIdMap.libraryItems[oldSession.libraryItemId]
      }
    }
    newRecords.playbackSession.push(PlaybackSession)
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

    let order = 1
    BookIds.forEach((bookId) => {
      const CollectionBook = {
        id: uuidv4(),
        createdAt: Collection.createdAt,
        bookId,
        collectionId: Collection.id,
        order: order++
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

    let order = 1
    MediaItemIds.forEach((mediaItemId) => {
      const PlaylistMediaItem = {
        id: uuidv4(),
        mediaItemId,
        mediaItemType,
        createdAt: Playlist.createdAt,
        playlistId: Playlist.id,
        order: order++
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
      // Series were split to be per library
      // This will use the first series it finds
      for (const libraryId in oldDbIdMap.series) {
        if (oldDbIdMap.series[libraryId][oldFeed.entityId]) {
          entityId = oldDbIdMap.series[libraryId][oldFeed.entityId]
          break
        }
      }
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
  const emailSettings = oldSettings.find(s => s.id === 'email-settings')

  if (serverSettings) {
    newRecords.setting.push({
      key: 'server-settings',
      value: serverSettings
    })
  }

  if (notificationSettings) {
    newRecords.setting.push({
      key: 'notification-settings',
      value: notificationSettings
    })
  }

  if (emailSettings) {
    newRecords.setting.push({
      key: 'email-settings',
      value: emailSettings
    })
  }
}

module.exports.migrate = async (DatabaseModels) => {
  Logger.info(`[dbMigration] Starting migration`)

  const data = await oldDbFiles.init()

  const start = Date.now()
  migrateSettings(data.settings)
  migrateLibraries(data.libraries)
  migrateAuthors(data.authors, data.libraryItems)
  migrateSeries(data.series, data.libraryItems)
  migrateLibraryItems(data.libraryItems)
  migrateUsers(data.users)
  migrateSessions(data.sessions)
  migrateCollections(data.collections)
  migratePlaylists(data.playlists)
  migrateFeeds(data.feeds)

  let totalRecords = 0
  for (const model in newRecords) {
    Logger.info(`[dbMigration] Inserting ${newRecords[model].length} ${model} rows`)
    if (newRecords[model].length) {
      await DatabaseModels[model].bulkCreate(newRecords[model])
      totalRecords += newRecords[model].length
    }
  }

  const elapsed = Date.now() - start

  // Purge author images and cover images from cache
  try {
    const CachePath = Path.join(global.MetadataPath, 'cache')
    await fs.emptyDir(Path.join(CachePath, 'covers'))
    await fs.emptyDir(Path.join(CachePath, 'images'))
  } catch (error) {
    Logger.error(`[dbMigration] Failed to purge author/cover image cache`, error)
  }

  // Put all old db folders into a zipfile oldDb.zip
  await oldDbFiles.zipWrapOldDb()

  Logger.info(`[dbMigration] Migration complete. ${totalRecords} rows. Elapsed ${(elapsed / 1000).toFixed(2)}s`)
}

/**
 * @returns {boolean} true if old database exists
 */
module.exports.checkShouldMigrate = async () => {
  if (await oldDbFiles.checkHasOldDb()) return true
  return oldDbFiles.checkHasOldDbZip()
}