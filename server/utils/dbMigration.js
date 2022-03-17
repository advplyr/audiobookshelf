const Path = require('path')
const fs = require('fs-extra')
const njodb = require("njodb")

const { SupportedEbookTypes } = require('./globals')
const LegacyAudiobook = require('../objects/legacy/Audiobook')
const UserAudiobookData = require('../objects/legacy/UserAudiobookData')

const LibraryItem = require('../objects/LibraryItem')

const Logger = require('../Logger')
const Book = require('../objects/mediaTypes/Book')

const BookMetadata = require('../objects/metadata/BookMetadata')
const FileMetadata = require('../objects/metadata/FileMetadata')

const AudioFile = require('../objects/files/AudioFile')
const EBookFile = require('../objects/files/EBookFile')
const LibraryFile = require('../objects/files/LibraryFile')
const AudioMetaTags = require('../objects/metadata/AudioMetaTags')

const Author = require('../objects/entities/Author')
const Series = require('../objects/entities/Series')
const Audiobook = require('../objects/entities/Audiobook')
const EBook = require('../objects/entities/EBook')

const LibraryItemProgress = require('../objects/user/LibraryItemProgress')
const PlaybackSession = require('../objects/PlaybackSession')

const { isObject } = require('.')
const User = require('../objects/user/User')

var authorsToAdd = []
var existingDbAuthors = []
var seriesToAdd = []
var existingDbSeries = []

// Load old audiobooks
async function loadAudiobooks() {
  var audiobookPath = Path.join(global.ConfigPath, 'audiobooks')

  var pathExists = await fs.pathExists(audiobookPath)
  if (!pathExists) {
    return []
  }

  var audiobooksDb = new njodb.Database(audiobookPath)
  return audiobooksDb.select(() => true).then((results) => {
    return results.data.map(a => new LegacyAudiobook(a))
  })
}

function makeAuthorsFromOldAb(authorsList) {
  return authorsList.filter(a => !!a).map(authorName => {
    var existingAuthor = authorsToAdd.find(a => a.name.toLowerCase() === authorName.toLowerCase())
    if (existingAuthor) {
      return existingAuthor.toJSONMinimal()
    }
    var existingDbAuthor = existingDbAuthors.find(a => a.name.toLowerCase() === authorName.toLowerCase())
    if (existingDbAuthor) {
      return existingDbAuthor.toJSONMinimal()
    }

    var newAuthor = new Author()
    newAuthor.setData({ name: authorName })
    authorsToAdd.push(newAuthor)
    Logger.info(`>>> Created new author named "${authorName}"`)
    return newAuthor.toJSONMinimal()
  })
}

function makeSeriesFromOldAb({ series, volumeNumber }) {
  var existingSeries = seriesToAdd.find(s => s.name.toLowerCase() === series.toLowerCase())
  if (existingSeries) {
    return [existingSeries.toJSONMinimal(volumeNumber)]
  }
  var existingDbSeriesItem = existingDbSeries.find(s => s.name.toLowerCase() === series.toLowerCase())
  if (existingDbSeriesItem) {
    return [existingDbSeriesItem.toJSONMinimal(volumeNumber)]
  }
  var newSeries = new Series()
  newSeries.setData({ name: series })
  seriesToAdd.push(newSeries)
  Logger.info(`>>> Created new series named "${series}"`)
  return [newSeries.toJSONMinimal(volumeNumber)]
}

function getRelativePath(srcPath, basePath) {
  srcPath = srcPath.replace(/\\/g, '/')
  basePath = basePath.replace(/\\/g, '/')
  return srcPath.replace(basePath, '')
}

function makeFilesFromOldAb(audiobook) {
  var libraryFiles = []
  var ebookFiles = []

  var audioFiles = audiobook._audioFiles.map((af) => {
    var fileMetadata = new FileMetadata(af)
    fileMetadata.path = af.fullPath
    fileMetadata.relPath = getRelativePath(af.fullPath, audiobook.fullPath)

    var newLibraryFile = new LibraryFile()
    newLibraryFile.ino = af.ino
    newLibraryFile.metadata = fileMetadata.clone()
    newLibraryFile.addedAt = af.addedAt
    newLibraryFile.updatedAt = Date.now()
    libraryFiles.push(newLibraryFile)

    var audioMetaTags = new AudioMetaTags(af.metadata || {}) // Old metaTags was named metadata
    delete af.metadata

    var newAudioFile = new AudioFile(af)
    newAudioFile.metadata = fileMetadata
    newAudioFile.metaTags = audioMetaTags
    newAudioFile.updatedAt = Date.now()
    return newAudioFile
  })

  audiobook._otherFiles.forEach((file) => {
    var fileMetadata = new FileMetadata(file)
    fileMetadata.path = file.fullPath
    fileMetadata.relPath = getRelativePath(file.fullPath, audiobook.fullPath)

    var newLibraryFile = new LibraryFile()
    newLibraryFile.ino = file.ino
    newLibraryFile.metadata = fileMetadata.clone()
    newLibraryFile.addedAt = file.addedAt
    newLibraryFile.updatedAt = Date.now()
    libraryFiles.push(newLibraryFile)

    var formatExt = (file.ext || '').slice(1)
    if (SupportedEbookTypes.includes(formatExt)) {
      var newEBookFile = new EBookFile()
      newEBookFile.ino = file.ino
      newEBookFile.metadata = fileMetadata
      newEBookFile.ebookFormat = formatExt
      newEBookFile.addedAt = file.addedAt
      newEBookFile.updatedAt = Date.now()
      ebookFiles.push(newEBookFile)
    }
  })

  return {
    libraryFiles,
    ebookFiles,
    audioFiles
  }
}

function makeLibraryItemFromOldAb(audiobook) {
  var libraryItem = new LibraryItem()
  libraryItem.id = getId('li')
  libraryItem.ino = audiobook.ino
  libraryItem.libraryId = audiobook.libraryId
  libraryItem.folderId = audiobook.folderId
  libraryItem.path = audiobook.fullPath
  libraryItem.relPath = audiobook.path
  libraryItem.mtimeMs = audiobook.mtimeMs || 0
  libraryItem.ctimeMs = audiobook.ctimeMs || 0
  libraryItem.birthtimeMs = audiobook.birthtimeMs || 0
  libraryItem.addedAt = audiobook.addedAt
  libraryItem.updatedAt = audiobook.lastUpdate
  libraryItem.lastScan = audiobook.lastScan
  libraryItem.scanVersion = audiobook.scanVersion
  libraryItem.isMissing = audiobook.isMissing
  libraryItem.mediaType = 'book'

  var bookEntity = new Book()
  var bookMetadata = new BookMetadata(audiobook.book)
  bookMetadata.publishedYear = audiobook.book.publishYear || null
  if (audiobook.book.narrator) {
    bookMetadata.narrators = audiobook.book._narratorsList
  }
  // Returns array of json minimal authors
  bookMetadata.authors = makeAuthorsFromOldAb(audiobook.book._authorsList)

  // Returns array of json minimal series
  if (audiobook.book.series) {
    bookMetadata.series = makeSeriesFromOldAb(audiobook.book)
  }

  bookEntity.metadata = bookMetadata
  bookEntity.coverPath = audiobook.book.coverFullPath
  bookEntity.tags = [...audiobook.tags]

  var payload = makeFilesFromOldAb(audiobook)
  if (payload.audioFiles.length) {
    var newAudiobook = new Audiobook()
    newAudiobook.id = audiobook.id
    newAudiobook.index = 1
    newAudiobook.name = 'default'
    newAudiobook.audioFiles = payload.audioFiles
    if (audiobook.chapters && audiobook.chapters.length) {
      newAudiobook.chapters = audiobook.chapters.map(c => ({ ...c }))
    }
    newAudiobook.missingParts = audiobook.missingParts || []
    newAudiobook.addedAt = audiobook.addedAt
    newAudiobook.updatedAt = audiobook.lastUpdate

    bookEntity.audiobooks.push(newAudiobook)
  }

  var ebookIndex = 1
  payload.ebookFiles.forEach(ebookFile => {
    var newEBook = new EBook()
    newEBook.id = getId('eb')
    newEBook.index = ebookIndex++
    newEBook.name = ebookFile.metadata.filenameNoExt
    newEBook.ebookFile = ebookFile
    newEBook.addedAt = audiobook.addedAt
    newEBook.updatedAt = audiobook.lastUpdate

    bookEntity.ebooks.push(newEBook)
  })

  libraryItem.media = bookEntity
  libraryItem.libraryFiles = payload.libraryFiles
  return libraryItem
}

async function migrateLibraryItems(db) {
  Logger.info(`==== Starting Library Item migration ====`)

  var audiobooks = await loadAudiobooks()
  if (!audiobooks.length) {
    Logger.info(`>>> No audiobooks in db, no migration necessary`)
    return
  }

  Logger.info(`>>> Loaded old audiobook data with ${audiobooks.length} records`)

  if (db.libraryItems.length) {
    Logger.info(`>>> Some library items already loaded ${db.libraryItems.length} items | ${db.series.length} series | ${db.authors.length} authors`)
    return
  }

  if (db.authors && db.authors.length) {
    existingDbAuthors = db.authors
  }
  if (db.series && db.series.length) {
    existingDbSeries = db.series
  }

  var libraryItems = audiobooks.map((ab) => makeLibraryItemFromOldAb(ab))

  Logger.info(`>>> ${libraryItems.length} Library Items made`)
  await db.insertEntities('libraryItem', libraryItems)
  if (authorsToAdd.length) {
    Logger.info(`>>> ${authorsToAdd.length} Authors made`)
    await db.insertEntities('author', authorsToAdd)
  }
  if (seriesToAdd.length) {
    Logger.info(`>>> ${seriesToAdd.length} Series made`)
    await db.insertEntities('series', seriesToAdd)
  }
  existingDbSeries = []
  existingDbAuthors = []
  authorsToAdd = []
  seriesToAdd = []
  Logger.info(`==== Library Item migration complete ====`)
}
module.exports.migrateLibraryItems = migrateLibraryItems


function cleanUserObject(db, userObj) {
  var cleanedUserPayload = {
    ...userObj,
    libraryItemProgress: [],
    bookmarks: []
  }

  // UserAudiobookData is now LibraryItemProgress and AudioBookmarks separated
  if (userObj.audiobooks) {
    for (const audiobookId in userObj.audiobooks) {
      if (isObject(userObj.audiobooks[audiobookId])) {
        // Bookmarks now live on User.js object instead of inside UserAudiobookData
        if (userObj.audiobooks[audiobookId].bookmarks) {
          const cleanedBookmarks = userObj.audiobooks[audiobookId].bookmarks.map((bm) => {
            bm.libraryItemId = audiobookId
            return bm
          })
          cleanedUserPayload.bookmarks = cleanedUserPayload.bookmarks.concat(cleanedBookmarks)
        }

        var userAudiobookData = new UserAudiobookData(userObj.audiobooks[audiobookId]) // Legacy object
        var liProgress = new LibraryItemProgress() // New Progress Object
        liProgress.id = userAudiobookData.audiobookId
        liProgress.libraryItemId = userAudiobookData.audiobookId
        Object.keys(liProgress.toJSON()).forEach((key) => {
          if (userAudiobookData[key] !== undefined) {
            liProgress[key] = userAudiobookData[key]
          }
        })
        cleanedUserPayload.libraryItemProgress.push(liProgress.toJSON())
      }
    }
  }

  const user = new User(cleanedUserPayload)
  return db.usersDb.update((record) => record.id === user.id, () => user).then((results) => {
    Logger.debug(`[dbMigration] Updated User: ${results.updated} | Selected: ${results.selected}`)
    return true
  }).catch((error) => {
    Logger.error(`[dbMigration] Update User Failed: ${error}`)
    return false
  })
}

function cleanSessionObj(db, userListeningSession) {
  var newPlaybackSession = new PlaybackSession(userListeningSession)
  newPlaybackSession.mediaType = 'book'
  newPlaybackSession.updatedAt = userListeningSession.lastUpdate
  newPlaybackSession.libraryItemId = userListeningSession.audiobookId

  // We only have title to transfer over nicely
  var bookMetadata = new BookMetadata()
  bookMetadata.title = userListeningSession.audiobookTitle || ''
  newPlaybackSession.mediaMetadata = bookMetadata

  return db.sessionsDb.update((record) => record.id === newPlaybackSession.id, () => newPlaybackSession).then((results) => true).catch((error) => {
    Logger.error(`[dbMigration] Update Session Failed: ${error}`)
    return false
  })
}

async function migrateUserData(db) {
  Logger.info(`==== Starting User migration ====`)

  const userObjects = await db.usersDb.select((result) => result.audiobooks != undefined).then((results) => results.data)
  if (!userObjects.length) {
    Logger.warn('[dbMigration] No users found needing migration')
    return
  }

  var userCount = 0
  for (const userObj of userObjects) {
    Logger.info(`[dbMigration] Migrating User "${userObj.username}"`)
    var success = await cleanUserObject(db, userObj)
    if (!success) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      Logger.warn(`[dbMigration] Second attempt Migrating User "${userObj.username}"`)
      success = await cleanUserObject(db, userObj)
      if (!success) {
        throw new Error('Db migration failed migrating users')
      }
    }
    userCount++
  }

  var sessionCount = 0
  const userListeningSessions = await db.sessionsDb.select((result) => result.audiobookId != undefined).then((results) => results.data)
  if (userListeningSessions.length) {

    for (const session of userListeningSessions) {
      var success = await cleanSessionObj(db, session)
      if (!success) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        Logger.warn(`[dbMigration] Second attempt Migrating Session "${session.id}"`)
        success = await cleanSessionObj(db, session)
        if (!success) {
          Logger.error(`[dbMigration] Failed to migrate session "${session.id}"`)
        }
      }
      if (success) sessionCount++
    }
  }

  Logger.info(`==== User migration complete (${userCount} Users, ${sessionCount} Sessions) ====`)
}
module.exports.migrateUserData = migrateUserData