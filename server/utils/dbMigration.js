const Path = require('path')
const fs = require('fs-extra')
const njodb = require("njodb")

const { SupportedEbookTypes } = require('./globals')
const Audiobook = require('../objects/legacy/Audiobook')
const LibraryItem = require('../objects/LibraryItem')

const Logger = require('../Logger')
const Book = require('../objects/entities/Book')
const BookMetadata = require('../objects/metadata/BookMetadata')
const Author = require('../objects/entities/Author')
const Series = require('../objects/entities/Series')
const AudioFile = require('../objects/files/AudioFile')
const EBookFile = require('../objects/files/EBookFile')
const LibraryFile = require('../objects/files/LibraryFile')
const FileMetadata = require('../objects/metadata/FileMetadata')
const AudioMetaTags = require('../objects/metadata/AudioMetaTags')

var authorsToAdd = []
var seriesToAdd = []

// Load old audiobooks
async function loadAudiobooks() {
  var audiobookPath = Path.join(global.ConfigPath, 'audiobooks')

  var pathExists = await fs.pathExists(audiobookPath)
  if (!pathExists) {
    return []
  }

  var audiobooksDb = new njodb.Database(audiobookPath)
  return audiobooksDb.select(() => true).then((results) => {
    return results.data.map(a => new Audiobook(a))
  })
}

function makeAuthorsFromOldAb(authorsList) {
  return authorsList.filter(a => !!a).map(authorName => {
    var existingAuthor = authorsToAdd.find(a => a.name.toLowerCase() === authorName.toLowerCase())
    if (existingAuthor) {
      return existingAuthor.toJSONMinimal()
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
  var newSeries = new Series()
  newSeries.setData({ name: series })
  seriesToAdd.push(newSeries)
  Logger.info(`>>> Created new series named "${series}"`)
  return [newSeries.toJSONMinimal(volumeNumber)]
}

function getRelativePath(srcPath, basePath) {
  srcPath = srcPath.replace(/\\/g, '/')
  basePath = basePath.replace(/\\/g, '/')
  if (basePath.endsWith('/')) basePath = basePath.slice(0, -1)
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
  libraryItem.id = audiobook.id
  libraryItem.ino = audiobook.ino
  libraryItem.libraryId = audiobook.libraryId
  libraryItem.folderId = audiobook.folderId
  libraryItem.path = audiobook.fullPath
  libraryItem.relPath = audiobook.path
  libraryItem.mtimeMs = audiobook.mtimeMs || 0
  libraryItem.ctimeMs = audiobook.ctimeMs || 0
  libraryItem.birthtimeMs = audiobook.birthtimeMs || 0
  libraryItem.addedAt = audiobook.addedAt
  libraryItem.lastUpdate = audiobook.lastUpdate
  libraryItem.lastScan = audiobook.lastScan
  libraryItem.scanVersion = audiobook.scanVersion
  libraryItem.isMissing = audiobook.isMissing
  libraryItem.mediaType = 'book'

  var bookEntity = new Book()
  var bookMetadata = new BookMetadata(audiobook.book)
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
  bookEntity.audioFiles = payload.audioFiles
  bookEntity.ebookFiles = payload.ebookFiles

  if (audiobook.chapters && audiobook.chapters.length) {
    bookEntity.chapters = audiobook.chapters.map(c => ({ ...c }))
  }

  libraryItem.media = bookEntity
  libraryItem.libraryFiles = payload.libraryFiles
  return libraryItem
}

async function migrateDb(db) {
  Logger.info(`==== Starting DB Migration ====`)

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

  Logger.info(`==== DB Migration Complete ====`)
}
module.exports = migrateDb