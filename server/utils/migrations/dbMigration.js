const uuidv4 = require("uuid").v4
const package = require('../../../package.json')
const Logger = require('../../Logger')
const Database = require('../../Database')
const oldDbFiles = require('./oldDbFiles')

const oldDbIdMap = {
  users: {},
  libraries: {},
  libraryFolders: {},
  libraryItems: {},
  books: {},
  tags: {}
}
const newRecords = {
  User: [],
  Library: [],
  LibraryFolder: [],
  LibrarySetting: [],
  LibraryItem: [],
  Book: [],
  BookChapter: [],
  Tag: [],
  BookTag: [],
  Podcast: []
}

function migrateBook(oldLibraryItem, LibraryItem) {
  const oldBook = oldLibraryItem.media

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
    LibraryItemId: LibraryItem.id,
    createdAt: LibraryItem.createdAt,
    updatedAt: LibraryItem.updatedAt
  }
  oldDbIdMap.books[oldLibraryItem.id] = Book.id
  newRecords.Book.push(Book)

  // TODO: Handle cover image record
  // TODO: Handle EBook record

  // Logger.info(`[dbMigration] migrateBook: Book migrated "${Book.title}" (${Book.id})`)

  const oldTags = oldBook.tags || []
  for (const oldTag of oldTags) {
    let tagId = null
    if (oldDbIdMap[oldTag]) {
      tagId = oldDbIdMap[oldTag]
    } else {
      const Tag = {
        id: uuidv4(),
        name: oldTag
      }
      tagId = Tag.id

      newRecords.Tag.push(Tag)
    }

    newRecords.BookTag.push({
      id: uuidv4(),
      BookId: Book.id,
      TagId: tagId
    })
  }

  for (const oldChapter of oldBook.chapters) {
    const BookChapter = {
      id: uuidv4(),
      index: oldChapter.id,
      start: oldChapter.start,
      end: oldChapter.end,
      title: oldChapter.title,
      BookId: Book.id
    }
    newRecords.BookChapter.push(BookChapter)
  }
}

function migratePodcast(oldLibraryItem, LibraryItem) {
  // TODO: Migrate podcast
}

function migrateLibraryItems(oldLibraryItems) {

  for (const oldLibraryItem of oldLibraryItems) {
    // Logger.info(`[dbMigration] migrateLibraryItems: Migrating library item "${oldLibraryItem.media.metadata.title}" (${oldLibraryItem.id})`)

    const LibraryId = oldDbIdMap.libraryFolders[oldLibraryItem.folderId]
    if (!LibraryId) {
      Logger.error(`[dbMigration] migrateLibraryItems: Old library folder id not found "${oldLibraryItem.folderId}"`)
      continue
    }

    const LibraryItem = {
      id: uuidv4(),
      ino: oldLibraryItem.ino,
      path: oldLibraryItem.path,
      relPath: oldLibraryItem.relPath,
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
      LibraryId
    }
    oldDbIdMap.libraryItems[oldLibraryItem.id] = LibraryItem.id
    newRecords.LibraryItem.push(LibraryItem)

    // Logger.info(`[dbMigration] migrateLibraryItems: LibraryItem "${LibraryItem.path}" migrated (${LibraryItem.id})`)

    if (oldLibraryItem.mediaType === 'book') {
      migrateBook(oldLibraryItem, LibraryItem)
    } else if (oldLibraryItem.mediaType === 'podcast') {
      migratePodcast(oldLibraryItem, LibraryItem)
    }
  }
}

function migrateLibraries(oldLibraries) {
  for (const oldLibrary of oldLibraries) {
    // Logger.info(`[dbMigration] migrateLibraries: Migrating library "${oldLibrary.name}" (${oldLibrary.id})`)

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
    newRecords.Library.push(Library)

    const oldLibrarySettings = oldLibrary.settings || {}
    for (const oldSettingsKey in oldLibrarySettings) {
      const LibrarySetting = {
        id: uuidv4(),
        key: oldSettingsKey,
        value: oldLibrarySettings[oldSettingsKey],
        LibraryId: Library.id
      }
      newRecords.LibrarySetting.push(LibrarySetting)
      // Logger.info(`[dbMigration] migrateLibraries: LibrarySetting "${LibrarySetting.key}" migrated (${LibrarySetting.id})`)
    }

    // Logger.info(`[dbMigration] migrateLibraries: Library "${Library.name}" migrated (${Library.id})`)

    for (const oldFolder of oldLibrary.folders) {
      // Logger.info(`[dbMigration] migrateLibraries: Migrating folder "${oldFolder.fullPath}" (${oldFolder.id})`)

      const LibraryFolder = {
        id: uuidv4(),
        path: oldFolder.fullPath,
        LibraryId: Library.id,
        createdAt: oldFolder.addedAt
      }
      oldDbIdMap.libraryFolders[oldFolder.id] = LibraryFolder.id
      newRecords.LibraryFolder.push(LibraryFolder)

      // Logger.info(`[dbMigration] migrateLibraries: LibraryFolder "${LibraryFolder.path}" migrated (${LibraryFolder.id})`)
    }
  }
}

function migrateUsers(oldUsers) {
  for (const oldUser of oldUsers) {
    // Logger.info(`[dbMigration] migrateUsers: Migrating user "${oldUser.username}" (${oldUser.id})`)

    const User = {
      id: uuidv4(),
      username: oldUser.username,
      pash: oldUser.pash || null,
      type: oldUser.type || null,
      token: oldUser.token || null,
      isActive: !!oldUser.isActive,
      lastSeen: oldUser.lastSeen || null,
      createdAt: oldUser.createdAt || Date.now()
    }
    oldDbIdMap.users[oldUser.id] = User.id
    newRecords.User.push(User)

    // Logger.info(`[dbMigration] migrateUsers: User "${User.username}" migrated (${User.id})`)

    // for (const oldMediaProgress of oldUser.mediaProgress) {
    //   const MediaProgress = {

    //   }
    // }
  }
}

module.exports.migrate = async () => {
  Logger.info(`[dbMigration] Starting migration`)

  const data = await oldDbFiles.init()

  const start = Date.now()
  migrateLibraries(data.libraries)
  migrateLibraryItems(data.libraryItems)
  migrateUsers(data.users)

  for (const model in newRecords) {
    Logger.info(`[dbMigration] Creating ${newRecords[model].length} ${model} records`)
    await Database.models[model].bulkCreate(newRecords[model])
  }

  const elapsed = Date.now() - start

  Logger.info(`[dbMigration] Migration complete. Elapsed ${(elapsed / 1000).toFixed(2)}s`)
}