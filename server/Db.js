const Path = require('path')
const njodb = require('./njodb')
const jwt = require('jsonwebtoken')
const Logger = require('./Logger')
const { version } = require('../package.json')
const LibraryItem = require('./objects/LibraryItem')
const User = require('./objects/user/User')
const UserCollection = require('./objects/UserCollection')
const Library = require('./objects/Library')
const Author = require('./objects/entities/Author')
const Series = require('./objects/entities/Series')
const ServerSettings = require('./objects/settings/ServerSettings')
const PlaybackSession = require('./objects/PlaybackSession')

class Db {
  constructor() {
    this.LibraryItemsPath = Path.join(global.ConfigPath, 'libraryItems')
    this.UsersPath = Path.join(global.ConfigPath, 'users')
    this.SessionsPath = Path.join(global.ConfigPath, 'sessions')
    this.LibrariesPath = Path.join(global.ConfigPath, 'libraries')
    this.SettingsPath = Path.join(global.ConfigPath, 'settings')
    this.CollectionsPath = Path.join(global.ConfigPath, 'collections')
    this.AuthorsPath = Path.join(global.ConfigPath, 'authors')
    this.SeriesPath = Path.join(global.ConfigPath, 'series')

    this.libraryItemsDb = new njodb.Database(this.LibraryItemsPath)
    this.usersDb = new njodb.Database(this.UsersPath)
    this.sessionsDb = new njodb.Database(this.SessionsPath)
    this.librariesDb = new njodb.Database(this.LibrariesPath, { datastores: 2 })
    this.settingsDb = new njodb.Database(this.SettingsPath, { datastores: 2 })
    this.collectionsDb = new njodb.Database(this.CollectionsPath, { datastores: 2 })
    this.authorsDb = new njodb.Database(this.AuthorsPath)
    this.seriesDb = new njodb.Database(this.SeriesPath, { datastores: 2 })

    this.libraryItems = []
    this.users = []
    this.libraries = []
    this.settings = []
    this.collections = []
    this.authors = []
    this.series = []

    this.serverSettings = null

    // Stores previous version only if upgraded
    this.previousVersion = null
  }

  getEntityDb(entityName) {
    if (entityName === 'user') return this.usersDb
    else if (entityName === 'session') return this.sessionsDb
    else if (entityName === 'libraryItem') return this.libraryItemsDb
    else if (entityName === 'library') return this.librariesDb
    else if (entityName === 'settings') return this.settingsDb
    else if (entityName === 'collection') return this.collectionsDb
    else if (entityName === 'author') return this.authorsDb
    else if (entityName === 'series') return this.seriesDb
    return null
  }

  getEntityArrayKey(entityName) {
    if (entityName === 'user') return 'users'
    else if (entityName === 'session') return 'sessions'
    else if (entityName === 'libraryItem') return 'libraryItems'
    else if (entityName === 'library') return 'libraries'
    else if (entityName === 'settings') return 'settings'
    else if (entityName === 'collection') return 'collections'
    else if (entityName === 'author') return 'authors'
    else if (entityName === 'series') return 'series'
    return null
  }

  getDefaultUser(token) {
    return new User({
      id: 'root',
      type: 'root',
      username: 'root',
      pash: '',
      stream: null,
      token,
      isActive: true,
      createdAt: Date.now()
    })
  }

  getDefaultLibrary() {
    var defaultLibrary = new Library()
    defaultLibrary.setData({
      id: 'main',
      name: 'Main',
      folder: { // Generates default folder
        id: 'audiobooks',
        fullPath: global.AudiobookPath,
        libraryId: 'main'
      }
    })
    return defaultLibrary
  }

  reinit() {
    this.libraryItemsDb = new njodb.Database(this.LibraryItemsPath)
    this.usersDb = new njodb.Database(this.UsersPath)
    this.sessionsDb = new njodb.Database(this.SessionsPath)
    this.librariesDb = new njodb.Database(this.LibrariesPath, { datastores: 2 })
    this.settingsDb = new njodb.Database(this.SettingsPath, { datastores: 2 })
    this.collectionsDb = new njodb.Database(this.CollectionsPath, { datastores: 2 })
    this.authorsDb = new njodb.Database(this.AuthorsPath)
    this.seriesDb = new njodb.Database(this.SeriesPath, { datastores: 2 })
    return this.init()
  }

  // Get previous server version before loading DB to check whether a db migration is required
  //   returns null if server was not upgraded
  checkPreviousVersion() {
    return this.settingsDb.select(() => true).then((results) => {
      if (results.data && results.data.length) {
        var serverSettings = results.data.find(s => s.id === 'server-settings')
        if (serverSettings && serverSettings.version && serverSettings.version !== version) {
          return serverSettings.version
        }
      }
      return null
    })
  }

  async init() {
    await this.load()

    // Insert Defaults
    var rootUser = this.users.find(u => u.type === 'root')
    if (!rootUser) {
      var token = await jwt.sign({ userId: 'root' }, process.env.TOKEN_SECRET)
      Logger.debug('Generated default token', token)
      Logger.info('[Db] Root user created')
      await this.insertEntity('user', this.getDefaultUser(token))
    } else {
      Logger.info(`[Db] Root user exists, pw: ${rootUser.hasPw}`)
    }

    if (!this.libraries.length) {
      await this.insertEntity('library', this.getDefaultLibrary())
    }

    if (!this.serverSettings) {
      this.serverSettings = new ServerSettings()
      await this.insertEntity('settings', this.serverSettings)
    }
    global.ServerSettings = this.serverSettings.toJSON()
  }

  async load() {
    var p1 = this.libraryItemsDb.select(() => true).then((results) => {
      this.libraryItems = results.data.map(a => new LibraryItem(a))
      Logger.info(`[DB] ${this.libraryItems.length} Library Items Loaded`)
    })
    var p2 = this.usersDb.select(() => true).then((results) => {
      this.users = results.data.map(u => new User(u))
      Logger.info(`[DB] ${this.users.length} Users Loaded`)
    })
    var p3 = this.librariesDb.select(() => true).then((results) => {
      this.libraries = results.data.map(l => new Library(l))
      this.libraries.sort((a, b) => a.displayOrder - b.displayOrder)
      Logger.info(`[DB] ${this.libraries.length} Libraries Loaded`)
    })
    var p4 = this.settingsDb.select(() => true).then((results) => {
      if (results.data && results.data.length) {
        this.settings = results.data
        var serverSettings = this.settings.find(s => s.id === 'server-settings')
        if (serverSettings) {
          this.serverSettings = new ServerSettings(serverSettings)

          // Check if server was upgraded
          if (!this.serverSettings.version || this.serverSettings.version !== version) {
            this.previousVersion = this.serverSettings.version || '1.0.0'
          }
        }
      }
    })
    var p5 = this.collectionsDb.select(() => true).then((results) => {
      this.collections = results.data.map(l => new UserCollection(l))
      Logger.info(`[DB] ${this.collections.length} Collections Loaded`)
    })
    var p6 = this.authorsDb.select(() => true).then((results) => {
      this.authors = results.data.map(l => new Author(l))
      Logger.info(`[DB] ${this.authors.length} Authors Loaded`)
    })
    var p7 = this.seriesDb.select(() => true).then((results) => {
      this.series = results.data.map(l => new Series(l))
      Logger.info(`[DB] ${this.series.length} Series Loaded`)
    })
    await Promise.all([p1, p2, p3, p4, p5, p6, p7])

    // Update server version in server settings
    if (this.previousVersion) {
      this.serverSettings.version = version
      await this.updateServerSettings()
    }
  }

  getLibraryItem(id) {
    return this.libraryItems.find(li => li.id === id)
  }
  getLibraryItemsInLibrary(libraryId) {
    return this.libraryItems.filter(li => li.libraryId === libraryId)
  }
  getPlaybackSession(id) {
    return this.sessionsDb.select((pb) => pb.id == id).then((results) => {
      if (results.data.length) {
        return new PlaybackSession(results.data[0])
      }
      return null
    }).catch((error) => {
      Logger.error('Failed to get session', error)
      return null
    })
  }

  async updateLibraryItem(libraryItem) {
    return this.updateLibraryItems([libraryItem])
  }

  async updateLibraryItems(libraryItems) {
    await Promise.all(libraryItems.map(async (li) => {
      if (li && li.saveMetadata) return li.saveMetadata()
      return null
    }))

    var libraryItemIds = libraryItems.map(li => li.id)
    return this.libraryItemsDb.update((record) => libraryItemIds.includes(record.id), (record) => {
      return libraryItems.find(li => li.id === record.id)
    }).then((results) => {
      Logger.debug(`[DB] Library Items updated ${results.updated}`)
      return true
    }).catch((error) => {
      Logger.error(`[DB] Library Items update failed ${error}`)
      return false
    })
  }

  async insertLibraryItem(libraryItem) {
    return this.insertLibraryItems([libraryItem])
  }

  async insertLibraryItems(libraryItems) {
    await Promise.all(libraryItems.map(async (li) => {
      if (li && li.saveMetadata) return li.saveMetadata()
      return null
    }))

    return this.libraryItemsDb.insert(libraryItems).then((results) => {
      Logger.debug(`[DB] Library Items inserted ${results.inserted}`)
      this.libraryItems = this.libraryItems.concat(libraryItems)
      return true
    }).catch((error) => {
      Logger.error(`[DB] Library Items insert failed ${error}`)
      return false
    })
  }

  removeLibraryItem(id) {
    return this.libraryItemsDb.delete((record) => record.id === id).then((results) => {
      Logger.debug(`[DB] Deleted Library Items: ${results.deleted}`)
      this.libraryItems = this.libraryItems.filter(li => li.id !== id)
    }).catch((error) => {
      Logger.error(`[DB] Remove Library Items Failed: ${error}`)
    })
  }

  updateUserStream(userId, streamId) {
    return this.usersDb.update((record) => record.id === userId, (user) => {
      user.stream = streamId
      return user
    }).then((results) => {
      Logger.debug(`[DB] Updated user ${results.updated}`)
      this.users = this.users.map(u => {
        if (u.id === userId) {
          u.stream = streamId
        }
        return u
      })
    }).catch((error) => {
      Logger.error(`[DB] Update user Failed ${error}`)
    })
  }

  updateServerSettings() {
    global.ServerSettings = this.serverSettings.toJSON()
    return this.updateEntity('settings', this.serverSettings)
  }

  insertEntities(entityName, entities) {
    var entityDb = this.getEntityDb(entityName)
    return entityDb.insert(entities).then((results) => {
      Logger.debug(`[DB] Inserted ${results.inserted} ${entityName}`)

      var arrayKey = this.getEntityArrayKey(entityName)
      if (this[arrayKey]) this[arrayKey] = this[arrayKey].concat(entities)
      return true
    }).catch((error) => {
      Logger.error(`[DB] Failed to insert ${entityName}`, error)
      return false
    })
  }

  insertEntity(entityName, entity) {
    var entityDb = this.getEntityDb(entityName)
    return entityDb.insert([entity]).then((results) => {
      Logger.debug(`[DB] Inserted ${results.inserted} ${entityName}`)

      var arrayKey = this.getEntityArrayKey(entityName)
      if (this[arrayKey]) this[arrayKey].push(entity)
      return true
    }).catch((error) => {
      Logger.error(`[DB] Failed to insert ${entityName}`, error)
      return false
    })
  }

  async bulkInsertEntities(entityName, entities, batchSize = 500) {
    // Group entities in batches of size batchSize
    var entityBatches = []
    var batch = []
    var index = 0
    entities.forEach((ent) => {
      batch.push(ent)
      index++
      if (index >= batchSize) {
        entityBatches.push(batch)
        index = 0
        batch = []
      }
    })
    if (batch.length) entityBatches.push(batch)

    Logger.info(`[Db] bulkInsertEntities: ${entities.length} ${entityName} to ${entityBatches.length} batches of max size ${batchSize}`)

    // Start inserting batches
    var batchIndex = 1
    for (const entityBatch of entityBatches) {
      Logger.info(`[Db] bulkInsertEntities: Start inserting batch ${batchIndex} of ${entityBatch.length} for ${entityName}`)
      var success = await this.insertEntities(entityName, entityBatch)
      if (success) {
        Logger.info(`[Db] bulkInsertEntities: Success inserting batch ${batchIndex} for ${entityName}`)
      } else {
        Logger.info(`[Db] bulkInsertEntities: Failed inserting batch ${batchIndex} for ${entityName}`)
      }
      batchIndex++
    }
    return true
  }

  updateEntities(entityName, entities) {
    var entityDb = this.getEntityDb(entityName)

    var entityIds = entities.map(ent => ent.id)
    return entityDb.update((record) => entityIds.includes(record.id), (record) => {
      return entities.find(ent => ent.id === record.id)
    }).then((results) => {
      Logger.debug(`[DB] Updated ${entityName}: ${results.updated}`)
      var arrayKey = this.getEntityArrayKey(entityName)
      if (this[arrayKey]) {
        this[arrayKey] = this[arrayKey].map(e => {
          if (entityIds.includes(e.id)) return entities.find(_e => _e.id === e.id)
          return e
        })
      }
      return true
    }).catch((error) => {
      Logger.error(`[DB] Update ${entityName} Failed: ${error}`)
      return false
    })
  }

  updateEntity(entityName, entity) {
    var entityDb = this.getEntityDb(entityName)

    var jsonEntity = entity
    if (entity && entity.toJSON) {
      jsonEntity = entity.toJSON()
    }

    return entityDb.update((record) => record.id === entity.id, () => jsonEntity).then((results) => {
      if (process.env.NODE_ENV !== 'production') {
        Logger.debug(`[DB] Updated ${entityName}: ${results.updated} | Selected: ${results.selected}`)

        if (!results.selected) {
          entityDb.select(match => match.id == jsonEntity.id).then((results) => {
            if (results.data.length) {
              console.log('Said selected 0 but found it right here...', results.data[0].id)
            } else {
              console.log('Said selected 0 and no results for json entity id', jsonEntity.id)
            }
          })
        }
      } else {
        Logger.debug(`[DB] Updated ${entityName}: ${results.updated}`)
      }

      var arrayKey = this.getEntityArrayKey(entityName)
      if (this[arrayKey]) {
        this[arrayKey] = this[arrayKey].map(e => {
          return e.id === entity.id ? entity : e
        })
      }
      return true
    }).catch((error) => {
      Logger.error(`[DB] Update entity ${entityName} Failed: ${error}`)
      return false
    })
  }

  removeEntity(entityName, entityId) {
    var entityDb = this.getEntityDb(entityName)
    return entityDb.delete((record) => {
      return record.id === entityId
    }).then((results) => {
      Logger.debug(`[DB] Deleted entity ${entityName}: ${results.deleted}`)
      var arrayKey = this.getEntityArrayKey(entityName)
      if (this[arrayKey]) {
        this[arrayKey] = this[arrayKey].filter(e => {
          return e.id !== entityId
        })
      }
    }).catch((error) => {
      Logger.error(`[DB] Remove entity ${entityName} Failed: ${error}`)
    })
  }

  recreateLibraryItemsDb() {
    return this.libraryItemsDb.drop().then((results) => {
      Logger.info(`[DB] Dropped library items db`, results)
      this.libraryItemsDb = new njodb.Database(this.LibraryItemsPath)
      this.libraryItems = []
      return true
    }).catch((error) => {
      Logger.error(`[DB] Failed to drop library items db`, error)
      return false
    })
  }

  selectUserSessions(userId) {
    return this.sessionsDb.select((session) => session.userId === userId).then((results) => {
      return results.data || []
    }).catch((error) => {
      Logger.error(`[Db] Failed to select user sessions "${userId}"`, error)
      return []
    })
  }

  // Check if server was updated and previous version was earlier than param
  checkPreviousVersionIsBefore(version) {
    if (!this.previousVersion) return false
    // true if version > previousVersion
    return version.localeCompare(this.previousVersion) >= 0
  }
}
module.exports = Db
