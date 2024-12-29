const { DataTypes, QueryInterface } = require('sequelize')
const Path = require('path')
const uuidv4 = require('uuid').v4
const Logger = require('../../Logger')
const fs = require('../../libs/fsExtra')
const oldDbFiles = require('./oldDbFiles')
const parseNameString = require('../parsers/parseNameString')

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

let prefixesToIgnore = ['the']
function getTitleIgnorePrefix(title) {
  if (!title?.trim()) return title
  for (const prefix of prefixesToIgnore) {
    // e.g. for prefix "the". If title is "The Book" return "Book"
    if (title.toLowerCase().startsWith(`${prefix} `)) {
      return title.substring(prefix.length).trim()
    }
  }
  return title
}

function getDeviceInfoString(deviceInfo, UserId) {
  if (!deviceInfo) return null
  if (deviceInfo.deviceId) return deviceInfo.deviceId

  const keys = [UserId, deviceInfo.browserName || null, deviceInfo.browserVersion || null, deviceInfo.osName || null, deviceInfo.osVersion || null, deviceInfo.clientVersion || null, deviceInfo.manufacturer || null, deviceInfo.model || null, deviceInfo.sdkVersion || null, deviceInfo.ipAddress || null].map((k) => k || '')
  return 'temp-' + Buffer.from(keys.join('-'), 'utf-8').toString('base64')
}

/**
 * Migrate oldLibraryItem.media to Book model
 * Migrate BookSeries and BookAuthor
 * @param {objects.LibraryItem} oldLibraryItem
 * @param {object} LibraryItem models.LibraryItem object
 * @returns {object} { book: object, bookSeries: [], bookAuthor: [] }
 */
function migrateBook(oldLibraryItem, LibraryItem) {
  const oldBook = oldLibraryItem.media

  const _newRecords = {
    book: null,
    bookSeries: [],
    bookAuthor: []
  }

  const tracks = (oldBook.audioFiles || []).filter((af) => !af.exclude && !af.invalid)
  let duration = 0
  for (const track of tracks) {
    if (track.duration !== null && !isNaN(track.duration)) {
      duration += track.duration
    }
  }

  //
  // Migrate Book
  //
  const Book = {
    id: uuidv4(),
    title: oldBook.metadata.title,
    titleIgnorePrefix: getTitleIgnorePrefix(oldBook.metadata.title),
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
    duration,
    audioFiles: oldBook.audioFiles,
    chapters: oldBook.chapters,
    tags: oldBook.tags,
    genres: oldBook.metadata.genres
  }
  _newRecords.book = Book
  oldDbIdMap.books[oldLibraryItem.id] = Book.id

  //
  // Migrate BookAuthors
  //
  const bookAuthorsInserted = []
  for (const oldBookAuthor of oldBook.metadata.authors) {
    if (oldDbIdMap.authors[LibraryItem.libraryId][oldBookAuthor.id]) {
      const authorId = oldDbIdMap.authors[LibraryItem.libraryId][oldBookAuthor.id]

      if (bookAuthorsInserted.includes(authorId)) continue // Duplicate prevention
      bookAuthorsInserted.push(authorId)

      _newRecords.bookAuthor.push({
        id: uuidv4(),
        authorId,
        bookId: Book.id
      })
    } else {
      Logger.warn(`[dbMigration] migrateBook: Book author not found "${oldBookAuthor.name}"`)
    }
  }

  //
  // Migrate BookSeries
  //
  const bookSeriesInserted = []
  for (const oldBookSeries of oldBook.metadata.series) {
    if (oldDbIdMap.series[LibraryItem.libraryId][oldBookSeries.id]) {
      const seriesId = oldDbIdMap.series[LibraryItem.libraryId][oldBookSeries.id]

      if (bookSeriesInserted.includes(seriesId)) continue // Duplicate prevention
      bookSeriesInserted.push(seriesId)

      _newRecords.bookSeries.push({
        id: uuidv4(),
        sequence: oldBookSeries.sequence,
        seriesId: oldDbIdMap.series[LibraryItem.libraryId][oldBookSeries.id],
        bookId: Book.id
      })
    } else {
      Logger.warn(`[dbMigration] migrateBook: Series not found "${oldBookSeries.name}"`)
    }
  }
  return _newRecords
}

/**
 * Migrate oldLibraryItem.media to Podcast model
 * Migrate PodcastEpisode
 * @param {objects.LibraryItem} oldLibraryItem
 * @param {object} LibraryItem models.LibraryItem object
 * @returns {object} { podcast: object, podcastEpisode: [] }
 */
function migratePodcast(oldLibraryItem, LibraryItem) {
  const _newRecords = {
    podcast: null,
    podcastEpisode: []
  }

  const oldPodcast = oldLibraryItem.media
  const oldPodcastMetadata = oldPodcast.metadata

  //
  // Migrate Podcast
  //
  const Podcast = {
    id: uuidv4(),
    title: oldPodcastMetadata.title,
    titleIgnorePrefix: getTitleIgnorePrefix(oldPodcastMetadata.title),
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
  _newRecords.podcast = Podcast
  oldDbIdMap.podcasts[oldLibraryItem.id] = Podcast.id

  //
  // Migrate PodcastEpisodes
  //
  const oldEpisodes = oldPodcast.episodes || []
  for (const oldEpisode of oldEpisodes) {
    oldEpisode.audioFile.index = 1

    const PodcastEpisode = {
      id: uuidv4(),
      oldEpisodeId: oldEpisode.id,
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
    _newRecords.podcastEpisode.push(PodcastEpisode)
    oldDbIdMap.podcastEpisodes[oldEpisode.id] = PodcastEpisode.id
  }
  return _newRecords
}

/**
 * Migrate libraryItems to LibraryItem, Book, Podcast models
 * @param {Array<objects.LibraryItem>} oldLibraryItems
 * @returns {object} { libraryItem: [], book: [], podcast: [], podcastEpisode: [], bookSeries: [], bookAuthor: [] }
 */
function migrateLibraryItems(oldLibraryItems) {
  const _newRecords = {
    book: [],
    podcast: [],
    podcastEpisode: [],
    bookSeries: [],
    bookAuthor: [],
    libraryItem: []
  }
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

    let size = 0
    for (const libraryFile of oldLibraryItem.libraryFiles) {
      if (libraryFile.metadata?.size && !isNaN(libraryFile.metadata?.size)) {
        size += libraryFile.metadata.size
      }
    }

    //
    // Migrate LibraryItem
    //
    const LibraryItem = {
      id: uuidv4(),
      oldLibraryItemId: oldLibraryItem.id,
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
      size,
      lastScan: oldLibraryItem.lastScan,
      lastScanVersion: oldLibraryItem.scanVersion,
      createdAt: oldLibraryItem.addedAt,
      updatedAt: oldLibraryItem.updatedAt,
      libraryId,
      libraryFolderId,
      libraryFiles: oldLibraryItem.libraryFiles.map((lf) => {
        if (lf.isSupplementary === undefined) lf.isSupplementary = null
        return lf
      })
    }
    oldDbIdMap.libraryItems[oldLibraryItem.id] = LibraryItem.id
    _newRecords.libraryItem.push(LibraryItem)

    //
    // Migrate Book/Podcast
    //
    if (oldLibraryItem.mediaType === 'book') {
      const bookRecords = migrateBook(oldLibraryItem, LibraryItem)
      _newRecords.book.push(bookRecords.book)
      _newRecords.bookAuthor.push(...bookRecords.bookAuthor)
      _newRecords.bookSeries.push(...bookRecords.bookSeries)

      LibraryItem.mediaId = oldDbIdMap.books[oldLibraryItem.id]
    } else if (oldLibraryItem.mediaType === 'podcast') {
      const podcastRecords = migratePodcast(oldLibraryItem, LibraryItem)
      _newRecords.podcast.push(podcastRecords.podcast)
      _newRecords.podcastEpisode.push(...podcastRecords.podcastEpisode)

      LibraryItem.mediaId = oldDbIdMap.podcasts[oldLibraryItem.id]
    }
  }
  return _newRecords
}

/**
 * Migrate Library and LibraryFolder
 * @param {Array<objects.Library>} oldLibraries
 * @returns {object} { library: [], libraryFolder: [] }
 */
function migrateLibraries(oldLibraries) {
  const _newRecords = {
    library: [],
    libraryFolder: []
  }
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
      oldLibraryId: oldLibrary.id,
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
    _newRecords.library.push(Library)

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
      _newRecords.libraryFolder.push(LibraryFolder)
    }
  }
  return _newRecords
}

/**
 * Migrate Author
 * Previously Authors were shared between libraries, this will ensure every author has one library
 * @param {Array<objects.entities.Author>} oldAuthors
 * @param {Array<objects.LibraryItem>} oldLibraryItems
 * @returns {Array<object>} Array of Author model objs
 */
function migrateAuthors(oldAuthors, oldLibraryItems) {
  const _newRecords = []
  for (const oldAuthor of oldAuthors) {
    // Get an array of NEW library ids that have this author
    const librariesWithThisAuthor = [
      ...new Set(
        oldLibraryItems
          .map((li) => {
            if (!li.media.metadata.authors?.some((au) => au.id === oldAuthor.id)) return null
            if (!oldDbIdMap.libraries[li.libraryId]) {
              Logger.warn(`[dbMigration] Authors library id ${li.libraryId} was not migrated`)
            }
            return oldDbIdMap.libraries[li.libraryId]
          })
          .filter((lid) => lid)
      )
    ]

    if (!librariesWithThisAuthor.length) {
      Logger.error(`[dbMigration] Author ${oldAuthor.name} was not found in any libraries`)
    }

    for (const libraryId of librariesWithThisAuthor) {
      const lastFirst = oldAuthor.name ? parseNameString.nameToLastFirst(oldAuthor.name) : ''
      const Author = {
        id: uuidv4(),
        name: oldAuthor.name,
        lastFirst,
        asin: oldAuthor.asin || null,
        description: oldAuthor.description,
        imagePath: oldAuthor.imagePath,
        createdAt: oldAuthor.addedAt || Date.now(),
        updatedAt: oldAuthor.updatedAt || Date.now(),
        libraryId
      }
      if (!oldDbIdMap.authors[libraryId]) oldDbIdMap.authors[libraryId] = {}
      oldDbIdMap.authors[libraryId][oldAuthor.id] = Author.id
      _newRecords.push(Author)
    }
  }
  return _newRecords
}

/**
 * Migrate Series
 * Previously Series were shared between libraries, this will ensure every series has one library
 * @param {Array<objects.entities.Series>} oldSerieses
 * @param {Array<objects.LibraryItem>} oldLibraryItems
 * @returns {Array<object>} Array of Series model objs
 */
function migrateSeries(oldSerieses, oldLibraryItems) {
  const _newRecords = []
  // Originaly series were shared between libraries if they had the same name
  // Series will be separate between libraries
  for (const oldSeries of oldSerieses) {
    // Get an array of NEW library ids that have this series
    const librariesWithThisSeries = [
      ...new Set(
        oldLibraryItems
          .map((li) => {
            if (!li.media.metadata.series?.some((se) => se.id === oldSeries.id)) return null
            return oldDbIdMap.libraries[li.libraryId]
          })
          .filter((lid) => lid)
      )
    ]

    if (!librariesWithThisSeries.length) {
      Logger.error(`[dbMigration] Series ${oldSeries.name} was not found in any libraries`)
    }

    for (const libraryId of librariesWithThisSeries) {
      const Series = {
        id: uuidv4(),
        name: oldSeries.name,
        nameIgnorePrefix: getTitleIgnorePrefix(oldSeries.name),
        description: oldSeries.description || null,
        createdAt: oldSeries.addedAt || Date.now(),
        updatedAt: oldSeries.updatedAt || Date.now(),
        libraryId
      }
      if (!oldDbIdMap.series[libraryId]) oldDbIdMap.series[libraryId] = {}
      oldDbIdMap.series[libraryId][oldSeries.id] = Series.id
      _newRecords.push(Series)
    }
  }
  return _newRecords
}

/**
 * Migrate users to User and MediaProgress models
 * @param {Array<objects.User>} oldUsers
 * @returns {object} { user: [], mediaProgress: [] }
 */
function migrateUsers(oldUsers) {
  const _newRecords = {
    user: [],
    mediaProgress: []
  }
  for (const oldUser of oldUsers) {
    //
    // Migrate User
    //
    // Convert old library ids to new ids
    const librariesAccessible = (oldUser.librariesAccessible || []).map((lid) => oldDbIdMap.libraries[lid]).filter((li) => li)

    // Convert old library item ids to new ids
    const bookmarks = (oldUser.bookmarks || [])
      .map((bm) => {
        bm.libraryItemId = oldDbIdMap.libraryItems[bm.libraryItemId]
        return bm
      })
      .filter((bm) => bm.libraryItemId)

    // Convert old series ids to new
    const seriesHideFromContinueListening = (oldUser.seriesHideFromContinueListening || [])
      .map((oldSeriesId) => {
        // Series were split to be per library
        // This will use the first series it finds
        for (const libraryId in oldDbIdMap.series) {
          if (oldDbIdMap.series[libraryId][oldSeriesId]) {
            return oldDbIdMap.series[libraryId][oldSeriesId]
          }
        }
        return null
      })
      .filter((se) => se)

    const User = {
      id: uuidv4(),
      username: oldUser.username,
      pash: oldUser.pash || null,
      type: oldUser.type || null,
      token: oldUser.token || null,
      isActive: !!oldUser.isActive,
      lastSeen: oldUser.lastSeen || null,
      extraData: {
        seriesHideFromContinueListening,
        oldUserId: oldUser.id // Used to keep old tokens
      },
      createdAt: oldUser.createdAt || Date.now(),
      permissions: {
        ...oldUser.permissions,
        librariesAccessible,
        itemTagsSelected: oldUser.itemTagsSelected || []
      },
      bookmarks
    }
    oldDbIdMap.users[oldUser.id] = User.id
    _newRecords.user.push(User)

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
      _newRecords.mediaProgress.push(MediaProgress)
    }
  }
  return _newRecords
}

/**
 * Migrate playbackSessions to PlaybackSession and Device models
 * @param {Array<objects.PlaybackSession>} oldSessions
 * @returns {object} { playbackSession: [], device: [] }
 */
function migrateSessions(oldSessions) {
  const _newRecords = {
    device: [],
    playbackSession: []
  }

  for (const oldSession of oldSessions) {
    const userId = oldDbIdMap.users[oldSession.userId]
    if (!userId) {
      Logger.info(`[dbMigration] Not migrating playback session ${oldSession.id} because user was not found`)
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
        deviceId = Device.id
        _newRecords.device.push(Device)
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
      userId,
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
    _newRecords.playbackSession.push(PlaybackSession)
  }
  return _newRecords
}

/**
 * Migrate collections to Collection & CollectionBook
 * @param {Array<objects.Collection>} oldCollections
 * @returns {object} { collection: [], collectionBook: [] }
 */
function migrateCollections(oldCollections) {
  const _newRecords = {
    collection: [],
    collectionBook: []
  }
  for (const oldCollection of oldCollections) {
    const libraryId = oldDbIdMap.libraries[oldCollection.libraryId]
    if (!libraryId) {
      Logger.warn(`[dbMigration] migrateCollections: Library not found for collection "${oldCollection.name}" (id:${oldCollection.libraryId})`)
      continue
    }

    const BookIds = oldCollection.books.map((lid) => oldDbIdMap.books[lid]).filter((bid) => bid)
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
    _newRecords.collection.push(Collection)

    let order = 1
    BookIds.forEach((bookId) => {
      const CollectionBook = {
        id: uuidv4(),
        createdAt: Collection.createdAt,
        bookId,
        collectionId: Collection.id,
        order: order++
      }
      _newRecords.collectionBook.push(CollectionBook)
    })
  }
  return _newRecords
}

/**
 * Migrate playlists to Playlist and PlaylistMediaItem
 * @param {Array<objects.Playlist>} oldPlaylists
 * @returns {object} { playlist: [], playlistMediaItem: [] }
 */
function migratePlaylists(oldPlaylists) {
  const _newRecords = {
    playlist: [],
    playlistMediaItem: []
  }
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
    _newRecords.playlist.push(Playlist)

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
      _newRecords.playlistMediaItem.push(PlaylistMediaItem)
    })
  }
  return _newRecords
}

/**
 * Migrate feeds to Feed and FeedEpisode models
 * @param {Array<objects.Feed>} oldFeeds
 * @returns {object} { feed: [], feedEpisode: [] }
 */
function migrateFeeds(oldFeeds) {
  const _newRecords = {
    feed: [],
    feedEpisode: []
  }
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
      coverPath: oldFeed.coverPath || null,
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
    _newRecords.feed.push(Feed)

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
      _newRecords.feedEpisode.push(FeedEpisode)
    }
  }
  return _newRecords
}

/**
 * Migrate ServerSettings, NotificationSettings and EmailSettings to Setting model
 * @param {Array<objects.settings.*>} oldSettings
 * @returns {Array<object>} Array of Setting model objs
 */
function migrateSettings(oldSettings) {
  const _newRecords = []
  const serverSettings = oldSettings.find((s) => s.id === 'server-settings')
  const notificationSettings = oldSettings.find((s) => s.id === 'notification-settings')
  const emailSettings = oldSettings.find((s) => s.id === 'email-settings')

  if (serverSettings) {
    _newRecords.push({
      key: 'server-settings',
      value: serverSettings
    })

    if (serverSettings.sortingPrefixes?.length) {
      // Used for migrating titles/names
      prefixesToIgnore = serverSettings.sortingPrefixes
    }
  }

  if (notificationSettings) {
    _newRecords.push({
      key: 'notification-settings',
      value: notificationSettings
    })
  }

  if (emailSettings) {
    _newRecords.push({
      key: 'email-settings',
      value: emailSettings
    })
  }
  return _newRecords
}

/**
 * Load old libraries and bulkCreate new Library and LibraryFolder rows
 * @param {Map<string,Model>} DatabaseModels
 */
async function handleMigrateLibraries(DatabaseModels) {
  const oldLibraries = await oldDbFiles.loadOldData('libraries')
  const newLibraryRecords = migrateLibraries(oldLibraries)
  for (const model in newLibraryRecords) {
    Logger.info(`[dbMigration] Inserting ${newLibraryRecords[model].length} ${model} rows`)
    await DatabaseModels[model].bulkCreate(newLibraryRecords[model])
  }
}

/**
 * Load old EmailSettings, NotificationSettings and ServerSettings and bulkCreate new Setting rows
 * @param {Map<string,Model>} DatabaseModels
 */
async function handleMigrateSettings(DatabaseModels) {
  const oldSettings = await oldDbFiles.loadOldData('settings')
  const newSettings = migrateSettings(oldSettings)
  Logger.info(`[dbMigration] Inserting ${newSettings.length} setting rows`)
  await DatabaseModels.setting.bulkCreate(newSettings)
}

/**
 * Load old authors and bulkCreate new Author rows
 * @param {Map<string,Model>} DatabaseModels
 * @param {Array<objects.LibraryItem>} oldLibraryItems
 */
async function handleMigrateAuthors(DatabaseModels, oldLibraryItems) {
  const oldAuthors = await oldDbFiles.loadOldData('authors')
  const newAuthors = migrateAuthors(oldAuthors, oldLibraryItems)
  Logger.info(`[dbMigration] Inserting ${newAuthors.length} author rows`)
  await DatabaseModels.author.bulkCreate(newAuthors)
}

/**
 * Load old series and bulkCreate new Series rows
 * @param {Map<string,Model>} DatabaseModels
 * @param {Array<objects.LibraryItem>} oldLibraryItems
 */
async function handleMigrateSeries(DatabaseModels, oldLibraryItems) {
  const oldSeries = await oldDbFiles.loadOldData('series')
  const newSeries = migrateSeries(oldSeries, oldLibraryItems)
  Logger.info(`[dbMigration] Inserting ${newSeries.length} series rows`)
  await DatabaseModels.series.bulkCreate(newSeries)
}

/**
 * bulkCreate new LibraryItem, Book and Podcast rows
 * @param {Map<string,Model>} DatabaseModels
 * @param {Array<objects.LibraryItem>} oldLibraryItems
 */
async function handleMigrateLibraryItems(DatabaseModels, oldLibraryItems) {
  const newItemsBooksPodcasts = migrateLibraryItems(oldLibraryItems)
  for (const model in newItemsBooksPodcasts) {
    Logger.info(`[dbMigration] Inserting ${newItemsBooksPodcasts[model].length} ${model} rows`)
    await DatabaseModels[model].bulkCreate(newItemsBooksPodcasts[model])
  }
}

/**
 * Migrate authors, series then library items in chunks
 * Authors and series require old library items loaded first
 * @param {Map<string,Model>} DatabaseModels
 */
async function handleMigrateAuthorsSeriesAndLibraryItems(DatabaseModels) {
  const oldLibraryItems = await oldDbFiles.loadOldData('libraryItems')
  await handleMigrateAuthors(DatabaseModels, oldLibraryItems)

  await handleMigrateSeries(DatabaseModels, oldLibraryItems)

  // Migrate library items in chunks of 1000
  const numChunks = Math.ceil(oldLibraryItems.length / 1000)
  for (let i = 0; i < numChunks; i++) {
    let start = i * 1000
    await handleMigrateLibraryItems(DatabaseModels, oldLibraryItems.slice(start, start + 1000))
  }
}

/**
 * Load old users and bulkCreate new User rows
 * @param {Map<string,Model>} DatabaseModels
 */
async function handleMigrateUsers(DatabaseModels) {
  const oldUsers = await oldDbFiles.loadOldData('users')
  const newUserRecords = migrateUsers(oldUsers)
  for (const model in newUserRecords) {
    Logger.info(`[dbMigration] Inserting ${newUserRecords[model].length} ${model} rows`)
    await DatabaseModels[model].bulkCreate(newUserRecords[model])
  }
}

/**
 * Load old sessions and bulkCreate new PlaybackSession & Device rows
 * @param {Map<string,Model>} DatabaseModels
 */
async function handleMigrateSessions(DatabaseModels) {
  const oldSessions = await oldDbFiles.loadOldData('sessions')

  let chunkSize = 1000
  let numChunks = Math.ceil(oldSessions.length / chunkSize)

  for (let i = 0; i < numChunks; i++) {
    let start = i * chunkSize
    const newSessionRecords = migrateSessions(oldSessions.slice(start, start + chunkSize))
    for (const model in newSessionRecords) {
      Logger.info(`[dbMigration] Inserting ${newSessionRecords[model].length} ${model} rows`)
      await DatabaseModels[model].bulkCreate(newSessionRecords[model])
    }
  }
}

/**
 * Load old collections and bulkCreate new Collection, CollectionBook models
 * @param {Map<string,Model>} DatabaseModels
 */
async function handleMigrateCollections(DatabaseModels) {
  const oldCollections = await oldDbFiles.loadOldData('collections')
  const newCollectionRecords = migrateCollections(oldCollections)
  for (const model in newCollectionRecords) {
    Logger.info(`[dbMigration] Inserting ${newCollectionRecords[model].length} ${model} rows`)
    await DatabaseModels[model].bulkCreate(newCollectionRecords[model])
  }
}

/**
 * Load old playlists and bulkCreate new Playlist, PlaylistMediaItem models
 * @param {Map<string,Model>} DatabaseModels
 */
async function handleMigratePlaylists(DatabaseModels) {
  const oldPlaylists = await oldDbFiles.loadOldData('playlists')
  const newPlaylistRecords = migratePlaylists(oldPlaylists)
  for (const model in newPlaylistRecords) {
    Logger.info(`[dbMigration] Inserting ${newPlaylistRecords[model].length} ${model} rows`)
    await DatabaseModels[model].bulkCreate(newPlaylistRecords[model])
  }
}

/**
 * Load old feeds and bulkCreate new Feed, FeedEpisode models
 * @param {Map<string,Model>} DatabaseModels
 */
async function handleMigrateFeeds(DatabaseModels) {
  const oldFeeds = await oldDbFiles.loadOldData('feeds')
  const newFeedRecords = migrateFeeds(oldFeeds)
  for (const model in newFeedRecords) {
    Logger.info(`[dbMigration] Inserting ${newFeedRecords[model].length} ${model} rows`)
    await DatabaseModels[model].bulkCreate(newFeedRecords[model])
  }
}

module.exports.migrate = async (DatabaseModels) => {
  Logger.info(`[dbMigration] Starting migration`)

  const start = Date.now()

  // Migrate to Library and LibraryFolder models
  await handleMigrateLibraries(DatabaseModels)

  // Migrate EmailSettings, NotificationSettings and ServerSettings to Setting model
  await handleMigrateSettings(DatabaseModels)

  // Migrate Series, Author, LibraryItem, Book, Podcast
  await handleMigrateAuthorsSeriesAndLibraryItems(DatabaseModels)

  // Migrate User, MediaProgress
  await handleMigrateUsers(DatabaseModels)

  // Migrate PlaybackSession, Device
  await handleMigrateSessions(DatabaseModels)

  // Migrate Collection, CollectionBook
  await handleMigrateCollections(DatabaseModels)

  // Migrate Playlist, PlaylistMediaItem
  await handleMigratePlaylists(DatabaseModels)

  // Migrate Feed, FeedEpisode
  await handleMigrateFeeds(DatabaseModels)

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

  const elapsed = Date.now() - start
  Logger.info(`[dbMigration] Migration complete. Elapsed ${(elapsed / 1000).toFixed(2)}s`)
}

/**
 * @returns {boolean} true if old database exists
 */
module.exports.checkShouldMigrate = async () => {
  if (await oldDbFiles.checkHasOldDb()) return true
  return oldDbFiles.checkHasOldDbZip()
}

/**
 * Migration from 2.3.0 to 2.3.1 - create extraData columns in LibraryItem and PodcastEpisode
 * @param {QueryInterface} queryInterface
 */
async function migrationPatchNewColumns(queryInterface) {
  try {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn(
          'libraryItems',
          'extraData',
          {
            type: DataTypes.JSON
          },
          { transaction: t }
        ),
        queryInterface.addColumn(
          'podcastEpisodes',
          'extraData',
          {
            type: DataTypes.JSON
          },
          { transaction: t }
        ),
        queryInterface.addColumn(
          'libraries',
          'extraData',
          {
            type: DataTypes.JSON
          },
          { transaction: t }
        )
      ])
    })
  } catch (error) {
    Logger.error(`[dbMigration] Migration from 2.3.0+ column creation failed`, error)
    return false
  }
}

/**
 * Migration from 2.3.0 to 2.3.1 - old library item ids
 * @param {/src/Database} ctx
 */
async function handleOldLibraryItems(ctx) {
  const oldLibraryItems = await oldDbFiles.loadOldData('libraryItems')
  const libraryItems = await ctx.models.libraryItem.getAllOldLibraryItems()

  const bulkUpdateItems = []
  const bulkUpdateEpisodes = []

  for (const libraryItem of libraryItems) {
    // Find matching old library item by ino
    const matchingOldLibraryItem = oldLibraryItems.find((oli) => oli.ino === libraryItem.ino)
    if (matchingOldLibraryItem) {
      oldDbIdMap.libraryItems[matchingOldLibraryItem.id] = libraryItem.id

      bulkUpdateItems.push({
        id: libraryItem.id,
        extraData: {
          oldLibraryItemId: matchingOldLibraryItem.id
        }
      })

      if (libraryItem.media.episodes?.length && matchingOldLibraryItem.media.episodes?.length) {
        for (const podcastEpisode of libraryItem.media.episodes) {
          // Find matching old episode by audio file ino
          const matchingOldPodcastEpisode = matchingOldLibraryItem.media.episodes.find((oep) => oep.audioFile?.ino && oep.audioFile.ino === podcastEpisode.audioFile?.ino)
          if (matchingOldPodcastEpisode) {
            oldDbIdMap.podcastEpisodes[matchingOldPodcastEpisode.id] = podcastEpisode.id

            bulkUpdateEpisodes.push({
              id: podcastEpisode.id,
              extraData: {
                oldEpisodeId: matchingOldPodcastEpisode.id
              }
            })
          }
        }
      }
    }
  }

  if (bulkUpdateEpisodes.length) {
    await ctx.models.podcastEpisode.bulkCreate(bulkUpdateEpisodes, {
      updateOnDuplicate: ['extraData']
    })
  }

  if (bulkUpdateItems.length) {
    await ctx.models.libraryItem.bulkCreate(bulkUpdateItems, {
      updateOnDuplicate: ['extraData']
    })
  }

  Logger.info(`[dbMigration] Migration 2.3.0+: Updated ${bulkUpdateItems.length} library items & ${bulkUpdateEpisodes.length} episodes`)
}

/**
 * Migration from 2.3.0 to 2.3.1 - updating oldLibraryId
 * @param {/src/Database} ctx
 */
async function handleOldLibraries(ctx) {
  const oldLibraries = await oldDbFiles.loadOldData('libraries')
  const libraries = await ctx.models.library.getAllWithFolders()

  let librariesUpdated = 0
  for (const library of libraries) {
    // Find matching old library using exact match on folder paths, exact match on library name
    const matchingOldLibrary = oldLibraries.find((ol) => {
      if (ol.name !== library.name) {
        return false
      }
      const folderPaths = ol.folders?.map((f) => f.fullPath) || []
      return folderPaths.join(',') === library.libraryFolders.map((f) => f.path).join(',')
    })

    if (matchingOldLibrary) {
      const newExtraData = library.extraData || {}
      newExtraData.oldLibraryId = matchingOldLibrary.id
      library.extraData = newExtraData
      library.changed('extraData', true)

      oldDbIdMap.libraries[library.oldLibraryId] = library.id
      await library.save()
      librariesUpdated++
    }
  }
  Logger.info(`[dbMigration] Migration 2.3.0+: Updated ${librariesUpdated} libraries`)
}

/**
 * Migration from 2.3.0 to 2.3.1 - fixing librariesAccessible and bookmarks
 * @param {import('../../Database')} ctx
 */
async function handleOldUsers(ctx) {
  const usersNew = await ctx.userModel.findAll({
    include: ctx.models.mediaProgress
  })

  let usersUpdated = 0
  for (const user of usersNew) {
    let hasUpdates = false
    if (user.bookmarks?.length) {
      user.bookmarks = user.bookmarks
        .map((bm) => {
          // Only update if this is not the old id format
          if (!bm.libraryItemId.startsWith('li_')) return bm

          bm.libraryItemId = oldDbIdMap.libraryItems[bm.libraryItemId]
          hasUpdates = true
          return bm
        })
        .filter((bm) => bm.libraryItemId)
      if (hasUpdates) {
        user.changed('bookmarks', true)
      }
    }

    const librariesAccessible = user.permissions?.librariesAccessible || []

    // Convert old library ids to new library ids
    if (librariesAccessible.length) {
      user.permissions.librariesAccessible = librariesAccessible
        .map((lid) => {
          if (!lid.startsWith('lib_') && lid !== 'main') return lid // Already not an old library id so dont change
          hasUpdates = true
          return oldDbIdMap.libraries[lid]
        })
        .filter((lid) => lid)
      if (hasUpdates) {
        user.changed('permissions', true)
      }
    }

    const seriesHideFromContinueListening = user.extraData?.seriesHideFromContinueListening || []

    if (seriesHideFromContinueListening.length) {
      user.extraData.seriesHideFromContinueListening = seriesHideFromContinueListening
        .map((seriesId) => {
          if (seriesId.startsWith('se_')) {
            hasUpdates = true
            return null // Filter out old series ids
          }
          return seriesId
        })
        .filter((se) => se)
      if (hasUpdates) {
        user.changed('extraData', true)
      }
    }

    if (hasUpdates) {
      await user.save()
      usersUpdated++
    }
  }
  Logger.info(`[dbMigration] Migration 2.3.0+: Updated ${usersUpdated} users`)
}

/**
 * Migration from 2.3.0 to 2.3.1
 * @param {/src/Database} ctx
 */
module.exports.migrationPatch = async (ctx) => {
  const queryInterface = ctx.sequelize.getQueryInterface()
  const librariesTableDescription = await queryInterface.describeTable('libraries')

  if (librariesTableDescription?.extraData) {
    Logger.info(`[dbMigration] Migration patch 2.3.0+ - extraData columns already on model`)
  } else {
    const migrationResult = await migrationPatchNewColumns(queryInterface)
    if (migrationResult === false) {
      return
    }
  }

  const oldDbPath = Path.join(global.ConfigPath, 'oldDb.zip')
  if (!(await fs.pathExists(oldDbPath))) {
    Logger.info(`[dbMigration] Migration patch 2.3.0+ unnecessary - no oldDb.zip found`)
    return
  }

  const migrationStart = Date.now()
  Logger.info(`[dbMigration] Applying migration patch from 2.3.0+`)

  // Extract from oldDb.zip
  if (!(await oldDbFiles.checkExtractItemsUsersAndLibraries())) {
    return
  }

  await handleOldLibraryItems(ctx)
  await handleOldLibraries(ctx)
  await handleOldUsers(ctx)

  await oldDbFiles.removeOldItemsUsersAndLibrariesFolders()

  const elapsed = Date.now() - migrationStart
  Logger.info(`[dbMigration] Migration patch 2.3.0+ finished. Elapsed ${(elapsed / 1000).toFixed(2)}s`)
}

/**
 * Migration from 2.3.3 to 2.3.4
 * Populating the size column on libraryItem
 * @param {/src/Database} ctx
 * @param {number} offset
 */
async function migrationPatch2LibraryItems(ctx, offset = 0) {
  const libraryItems = await ctx.models.libraryItem.findAll({
    limit: 500,
    offset
  })
  if (!libraryItems.length) return

  const bulkUpdateItems = []
  for (const libraryItem of libraryItems) {
    if (libraryItem.libraryFiles?.length) {
      let size = 0
      libraryItem.libraryFiles.forEach((lf) => {
        if (!isNaN(lf.metadata?.size)) {
          size += Number(lf.metadata.size)
        }
      })
      bulkUpdateItems.push({
        id: libraryItem.id,
        size
      })
    }
  }

  if (bulkUpdateItems.length) {
    Logger.info(`[dbMigration] Migration patch 2.3.3+ - patching ${bulkUpdateItems.length} library items`)
    await ctx.models.libraryItem.bulkCreate(bulkUpdateItems, {
      updateOnDuplicate: ['size']
    })
  }

  if (libraryItems.length < 500) {
    return
  }
  return migrationPatch2LibraryItems(ctx, offset + libraryItems.length)
}

/**
 * Migration from 2.3.3 to 2.3.4
 * Populating the duration & titleIgnorePrefix column on book
 * @param {/src/Database} ctx
 * @param {number} offset
 */
async function migrationPatch2Books(ctx, offset = 0) {
  const books = await ctx.models.book.findAll({
    limit: 500,
    offset
  })
  if (!books.length) return

  const bulkUpdateItems = []
  for (const book of books) {
    let duration = 0

    if (book.audioFiles?.length) {
      const tracks = book.audioFiles.filter((af) => !af.exclude && !af.invalid)
      for (const track of tracks) {
        if (track.duration !== null && !isNaN(track.duration)) {
          duration += track.duration
        }
      }
    }

    bulkUpdateItems.push({
      id: book.id,
      titleIgnorePrefix: getTitleIgnorePrefix(book.title),
      duration
    })
  }

  if (bulkUpdateItems.length) {
    Logger.info(`[dbMigration] Migration patch 2.3.3+ - patching ${bulkUpdateItems.length} books`)
    await ctx.models.book.bulkCreate(bulkUpdateItems, {
      updateOnDuplicate: ['duration', 'titleIgnorePrefix']
    })
  }

  if (books.length < 500) {
    return
  }
  return migrationPatch2Books(ctx, offset + books.length)
}

/**
 * Migration from 2.3.3 to 2.3.4
 * Populating the titleIgnorePrefix column on podcast
 * @param {/src/Database} ctx
 * @param {number} offset
 */
async function migrationPatch2Podcasts(ctx, offset = 0) {
  const podcasts = await ctx.models.podcast.findAll({
    limit: 500,
    offset
  })
  if (!podcasts.length) return

  const bulkUpdateItems = []
  for (const podcast of podcasts) {
    bulkUpdateItems.push({
      id: podcast.id,
      titleIgnorePrefix: getTitleIgnorePrefix(podcast.title)
    })
  }

  if (bulkUpdateItems.length) {
    Logger.info(`[dbMigration] Migration patch 2.3.3+ - patching ${bulkUpdateItems.length} podcasts`)
    await ctx.models.podcast.bulkCreate(bulkUpdateItems, {
      updateOnDuplicate: ['titleIgnorePrefix']
    })
  }

  if (podcasts.length < 500) {
    return
  }
  return migrationPatch2Podcasts(ctx, offset + podcasts.length)
}

/**
 * Migration from 2.3.3 to 2.3.4
 * Populating the nameIgnorePrefix column on series
 * @param {/src/Database} ctx
 * @param {number} offset
 */
async function migrationPatch2Series(ctx, offset = 0) {
  const allSeries = await ctx.models.series.findAll({
    limit: 500,
    offset
  })
  if (!allSeries.length) return

  const bulkUpdateItems = []
  for (const series of allSeries) {
    bulkUpdateItems.push({
      id: series.id,
      nameIgnorePrefix: getTitleIgnorePrefix(series.name)
    })
  }

  if (bulkUpdateItems.length) {
    Logger.info(`[dbMigration] Migration patch 2.3.3+ - patching ${bulkUpdateItems.length} series`)
    await ctx.models.series.bulkCreate(bulkUpdateItems, {
      updateOnDuplicate: ['nameIgnorePrefix']
    })
  }

  if (allSeries.length < 500) {
    return
  }
  return migrationPatch2Series(ctx, offset + allSeries.length)
}

/**
 * Migration from 2.3.3 to 2.3.4
 * Populating the lastFirst column on author
 * @param {/src/Database} ctx
 * @param {number} offset
 */
async function migrationPatch2Authors(ctx, offset = 0) {
  const authors = await ctx.models.author.findAll({
    limit: 500,
    offset
  })
  if (!authors.length) return

  const bulkUpdateItems = []
  for (const author of authors) {
    if (author.name?.trim()) {
      bulkUpdateItems.push({
        id: author.id,
        lastFirst: parseNameString.nameToLastFirst(author.name)
      })
    }
  }

  if (bulkUpdateItems.length) {
    Logger.info(`[dbMigration] Migration patch 2.3.3+ - patching ${bulkUpdateItems.length} authors`)
    await ctx.models.author.bulkCreate(bulkUpdateItems, {
      updateOnDuplicate: ['lastFirst']
    })
  }

  if (authors.length < 500) {
    return
  }
  return migrationPatch2Authors(ctx, offset + authors.length)
}

/**
 * Migration from 2.3.3 to 2.3.4
 * Populating the createdAt column on bookAuthor
 * @param {/src/Database} ctx
 * @param {number} offset
 */
async function migrationPatch2BookAuthors(ctx, offset = 0) {
  const bookAuthors = await ctx.models.bookAuthor.findAll({
    include: {
      model: ctx.models.author
    },
    limit: 500,
    offset
  })
  if (!bookAuthors.length) return

  const bulkUpdateItems = []
  for (const bookAuthor of bookAuthors) {
    if (bookAuthor.author?.createdAt) {
      const dateString = bookAuthor.author.createdAt.toISOString().replace('T', ' ').replace('Z', '')
      bulkUpdateItems.push(`("${bookAuthor.id}","${dateString}")`)
    }
  }

  if (bulkUpdateItems.length) {
    Logger.info(`[dbMigration] Migration patch 2.3.3+ - patching ${bulkUpdateItems.length} bookAuthors`)
    await ctx.sequelize.query(`INSERT INTO bookAuthors ('id','createdAt') VALUES ${bulkUpdateItems.join(',')} ON CONFLICT(id) DO UPDATE SET 'createdAt' = EXCLUDED.createdAt;`)
  }

  if (bookAuthors.length < 500) {
    return
  }
  return migrationPatch2BookAuthors(ctx, offset + bookAuthors.length)
}

/**
 * Migration from 2.3.3 to 2.3.4
 * Populating the createdAt column on bookSeries
 * @param {/src/Database} ctx
 * @param {number} offset
 */
async function migrationPatch2BookSeries(ctx, offset = 0) {
  const allBookSeries = await ctx.models.bookSeries.findAll({
    include: {
      model: ctx.models.series
    },
    limit: 500,
    offset
  })
  if (!allBookSeries.length) return

  const bulkUpdateItems = []
  for (const bookSeries of allBookSeries) {
    if (bookSeries.series?.createdAt) {
      const dateString = bookSeries.series.createdAt.toISOString().replace('T', ' ').replace('Z', '')
      bulkUpdateItems.push(`("${bookSeries.id}","${dateString}")`)
    }
  }

  if (bulkUpdateItems.length) {
    Logger.info(`[dbMigration] Migration patch 2.3.3+ - patching ${bulkUpdateItems.length} bookSeries`)
    await ctx.sequelize.query(`INSERT INTO bookSeries ('id','createdAt') VALUES ${bulkUpdateItems.join(',')} ON CONFLICT(id) DO UPDATE SET 'createdAt' = EXCLUDED.createdAt;`)
  }

  if (allBookSeries.length < 500) {
    return
  }
  return migrationPatch2BookSeries(ctx, offset + allBookSeries.length)
}

/**
 * Migration from 2.3.3 to 2.3.4
 * Adding coverPath column to Feed model
 * @param {/src/Database} ctx
 */
module.exports.migrationPatch2 = async (ctx) => {
  const queryInterface = ctx.sequelize.getQueryInterface()
  const feedTableDescription = await queryInterface.describeTable('feeds')
  const authorsTableDescription = await queryInterface.describeTable('authors')
  const bookAuthorsTableDescription = await queryInterface.describeTable('bookAuthors')

  if (feedTableDescription?.coverPath && authorsTableDescription?.lastFirst && bookAuthorsTableDescription?.createdAt) {
    Logger.info(`[dbMigration] Migration patch 2.3.3+ - columns already on model`)
    return false
  }
  Logger.info(`[dbMigration] Applying migration patch from 2.3.3+`)

  try {
    await queryInterface.sequelize.transaction((t) => {
      const queries = []
      if (!bookAuthorsTableDescription?.createdAt) {
        queries.push(
          ...[
            queryInterface.addColumn(
              'bookAuthors',
              'createdAt',
              {
                type: DataTypes.DATE
              },
              { transaction: t }
            ),
            queryInterface.addColumn(
              'bookSeries',
              'createdAt',
              {
                type: DataTypes.DATE
              },
              { transaction: t }
            )
          ]
        )
      }
      if (!authorsTableDescription?.lastFirst) {
        queries.push(
          ...[
            queryInterface.addColumn(
              'authors',
              'lastFirst',
              {
                type: DataTypes.STRING
              },
              { transaction: t }
            ),
            queryInterface.addColumn(
              'libraryItems',
              'size',
              {
                type: DataTypes.BIGINT
              },
              { transaction: t }
            ),
            queryInterface.addColumn(
              'books',
              'duration',
              {
                type: DataTypes.FLOAT
              },
              { transaction: t }
            ),
            queryInterface.addColumn(
              'books',
              'titleIgnorePrefix',
              {
                type: DataTypes.STRING
              },
              { transaction: t }
            ),
            queryInterface.addColumn(
              'podcasts',
              'titleIgnorePrefix',
              {
                type: DataTypes.STRING
              },
              { transaction: t }
            ),
            queryInterface.addColumn(
              'series',
              'nameIgnorePrefix',
              {
                type: DataTypes.STRING
              },
              { transaction: t }
            )
          ]
        )
      }
      if (!feedTableDescription?.coverPath) {
        queries.push(
          queryInterface.addColumn(
            'feeds',
            'coverPath',
            {
              type: DataTypes.STRING
            },
            { transaction: t }
          )
        )
      }
      return Promise.all(queries)
    })

    if (!authorsTableDescription?.lastFirst) {
      if (global.ServerSettings.sortingPrefixes?.length) {
        prefixesToIgnore = global.ServerSettings.sortingPrefixes
      }

      // Patch library items size column
      await migrationPatch2LibraryItems(ctx, 0)

      // Patch books duration & titleIgnorePrefix column
      await migrationPatch2Books(ctx, 0)

      // Patch podcasts titleIgnorePrefix column
      await migrationPatch2Podcasts(ctx, 0)

      // Patch authors lastFirst column
      await migrationPatch2Authors(ctx, 0)

      // Patch series nameIgnorePrefix column
      await migrationPatch2Series(ctx, 0)
    }

    if (!bookAuthorsTableDescription?.createdAt) {
      // Patch bookAuthors createdAt column
      await migrationPatch2BookAuthors(ctx, 0)

      // Patch bookSeries createdAt column
      await migrationPatch2BookSeries(ctx, 0)
    }

    Logger.info(`[dbMigration] Migration patch 2.3.3+ finished`)
    return true
  } catch (error) {
    Logger.error(`[dbMigration] Migration from 2.3.3+ column creation failed`, error)
    throw new Error('Migration 2.3.3+ failed ' + error)
  }
}
