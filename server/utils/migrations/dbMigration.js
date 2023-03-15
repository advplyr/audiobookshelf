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

async function migrateBook(oldLibraryItem, LibraryItem) {
  const oldBook = oldLibraryItem.media

  const Book = await Database.models.Book.create({
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
  })

  oldDbIdMap.books[oldLibraryItem.id] = Book.id

  // TODO: Handle cover image record
  // TODO: Handle EBook record

  Logger.info(`[dbMigration] migrateBook: Book migrated "${Book.title}" (${Book.id})`)

  const oldTags = oldBook.tags || []
  for (const oldTag of oldTags) {
    let tagId = null
    if (oldDbIdMap[oldTag]) {
      tagId = oldDbIdMap[oldTag]
    } else {
      const Tag = await Database.models.Tag.create({
        name: oldTag
      })
      tagId = Tag.id
    }

    const BookTag = await Database.models.BookTag.create({
      BookId: Book.id,
      TagId: tagId
    })
    Logger.info(`[dbMigration] migrateBook: BookTag migrated "${oldTag}" (${BookTag.id})`)
  }

  for (const oldChapter of oldBook.chapters) {
    const BookChapter = await Database.models.BookChapter.create({
      index: oldChapter.id,
      start: oldChapter.start,
      end: oldChapter.end,
      title: oldChapter.title,
      BookId: Book.id
    })
    Logger.info(`[dbMigration] migrateBook: BookChapter migrated "${BookChapter.title}" (${BookChapter.id})`)
  }
}

async function migrateLibraryItems(oldLibraryItems) {
  for (const oldLibraryItem of oldLibraryItems) {
    Logger.info(`[dbMigration] migrateLibraryItems: Migrating library item "${oldLibraryItem.media.metadata.title}" (${oldLibraryItem.id})`)

    const LibraryId = oldDbIdMap.libraryFolders[oldLibraryItem.folderId]
    if (!LibraryId) {
      Logger.error(`[dbMigration] migrateLibraryItems: Old library folder id not found "${oldLibraryItem.folderId}"`)
      continue
    }

    const LibraryItem = await Database.models.LibraryItem.create({
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
    })

    Logger.info(`[dbMigration] migrateLibraryItems: LibraryItem "${LibraryItem.path}" migrated (${LibraryItem.id})`)

    if (oldLibraryItem.mediaType === 'book') {
      await migrateBook(oldLibraryItem, LibraryItem)
    }
  }
}

async function migrateLibraries(oldLibraries) {
  for (const oldLibrary of oldLibraries) {
    Logger.info(`[dbMigration] migrateLibraries: Migrating library "${oldLibrary.name}" (${oldLibrary.id})`)

    const Library = await Database.models.Library.create({
      name: oldLibrary.name,
      displayOrder: oldLibrary.displayOrder,
      icon: oldLibrary.icon || null,
      mediaType: oldLibrary.mediaType || null,
      provider: oldLibrary.provider,
      createdAt: oldLibrary.createdAt,
      updatedAt: oldLibrary.lastUpdate
    })

    oldDbIdMap.libraries[oldLibrary.id] = Library.id

    const oldLibrarySettings = oldLibrary.settings || {}
    for (const oldSettingsKey in oldLibrarySettings) {
      const LibrarySetting = await Database.models.LibrarySetting.create({
        key: oldSettingsKey,
        value: oldLibrarySettings[oldSettingsKey],
        LibraryId: Library.id
      })
      Logger.info(`[dbMigration] migrateLibraries: LibrarySetting "${LibrarySetting.key}" migrated (${LibrarySetting.id})`)
    }

    Logger.info(`[dbMigration] migrateLibraries: Library "${Library.name}" migrated (${Library.id})`)

    for (const oldFolder of oldLibrary.folders) {
      Logger.info(`[dbMigration] migrateLibraries: Migrating folder "${oldFolder.fullPath}" (${oldFolder.id})`)

      const LibraryFolder = await Database.models.LibraryFolder.create({
        path: oldFolder.fullPath,
        LibraryId: Library.id,
        createdAt: oldFolder.addedAt
      })

      oldDbIdMap.libraryFolders[oldFolder.id] = LibraryFolder.id

      Logger.info(`[dbMigration] migrateLibraries: LibraryFolder "${LibraryFolder.path}" migrated (${LibraryFolder.id})`)
    }
  }
}

async function migrateUsers(oldUsers) {
  for (const oldUser of oldUsers) {
    Logger.info(`[dbMigration] migrateUsers: Migrating user "${oldUser.username}" (${oldUser.id})`)

    const User = await Database.models.User.create({
      username: oldUser.username,
      pash: oldUser.pash || null,
      type: oldUser.type || null,
      token: oldUser.token || null,
      isActive: !!oldUser.isActive,
      lastSeen: oldUser.lastSeen || null,
      createdAt: oldUser.createdAt || Date.now()
    })

    oldDbIdMap.users[oldUser.id] = User.id

    Logger.info(`[dbMigration] migrateUsers: User "${User.username}" migrated (${User.id})`)

    // for (const oldMediaProgress of oldUser.mediaProgress) {
    //   const MediaProgress = await Database.models.MediaProgress.create({

    //   })
    // }
  }
}

module.exports.migrate = async () => {
  Logger.info(`[dbMigration] Starting migration`)

  const data = await oldDbFiles.init()

  const start = Date.now()
  await migrateLibraries(data.libraries)
  await migrateLibraryItems(data.libraryItems)
  await migrateUsers(data.users)
  const elapsed = Date.now() - start

  Logger.info(`[dbMigration] Migration complete. Elapsed ${Math.round(elapsed / 1000)}s`)
}