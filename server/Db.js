const Path = require('path')
const njodb = require("njodb")
const fs = require('fs-extra')
const jwt = require('jsonwebtoken')
const Logger = require('./Logger')
const { version } = require('../package.json')
const Audiobook = require('./objects/Audiobook')
const User = require('./objects/User')
const UserCollection = require('./objects/UserCollection')
const Library = require('./objects/Library')
const Author = require('./objects/Author')
const ServerSettings = require('./objects/ServerSettings')

class Db {
  constructor() {
    this.AudiobooksPath = Path.join(global.ConfigPath, 'audiobooks')
    this.UsersPath = Path.join(global.ConfigPath, 'users')
    this.SessionsPath = Path.join(global.ConfigPath, 'sessions')
    this.LibrariesPath = Path.join(global.ConfigPath, 'libraries')
    this.SettingsPath = Path.join(global.ConfigPath, 'settings')
    this.CollectionsPath = Path.join(global.ConfigPath, 'collections')
    this.AuthorsPath = Path.join(global.ConfigPath, 'authors')

    this.audiobooksDb = new njodb.Database(this.AudiobooksPath)
    this.usersDb = new njodb.Database(this.UsersPath)
    this.sessionsDb = new njodb.Database(this.SessionsPath)
    this.librariesDb = new njodb.Database(this.LibrariesPath, { datastores: 2 })
    this.settingsDb = new njodb.Database(this.SettingsPath, { datastores: 2 })
    this.collectionsDb = new njodb.Database(this.CollectionsPath, { datastores: 2 })
    this.authorsDb = new njodb.Database(this.AuthorsPath)

    this.users = []
    this.sessions = []
    this.libraries = []
    this.audiobooks = []
    this.settings = []
    this.collections = []
    this.authors = []

    this.serverSettings = null

    // Stores previous version only if upgraded
    this.previousVersion = null
  }

  getEntityDb(entityName) {
    if (entityName === 'user') return this.usersDb
    else if (entityName === 'session') return this.sessionsDb
    else if (entityName === 'audiobook') return this.audiobooksDb
    else if (entityName === 'library') return this.librariesDb
    else if (entityName === 'settings') return this.settingsDb
    else if (entityName === 'collection') return this.collectionsDb
    else if (entityName === 'author') return this.authorsDb
    return null
  }

  getEntityArrayKey(entityName) {
    if (entityName === 'user') return 'users'
    else if (entityName === 'session') return 'sessions'
    else if (entityName === 'audiobook') return 'audiobooks'
    else if (entityName === 'library') return 'libraries'
    else if (entityName === 'settings') return 'settings'
    else if (entityName === 'collection') return 'collections'
    else if (entityName === 'author') return 'authors'
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
    this.audiobooksDb = new njodb.Database(this.AudiobooksPath)
    this.usersDb = new njodb.Database(this.UsersPath)
    this.sessionsDb = new njodb.Database(this.SessionsPath)
    this.librariesDb = new njodb.Database(this.LibrariesPath, { datastores: 2 })
    this.settingsDb = new njodb.Database(this.SettingsPath, { datastores: 2 })
    this.collectionsDb = new njodb.Database(this.CollectionsPath, { datastores: 2 })
    this.authorsDb = new njodb.Database(this.AuthorsPath)
    return this.init()
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
    var p1 = this.audiobooksDb.select(() => true).then((results) => {
      this.audiobooks = results.data.map(a => new Audiobook(a))
      Logger.info(`[DB] ${this.audiobooks.length} Audiobooks Loaded`)
    })
    var p2 = this.usersDb.select(() => true).then((results) => {
      this.users = results.data.map(u => new User(u))
      Logger.info(`[DB] ${this.users.length} Users Loaded`)
    })
    var p3 = this.librariesDb.select(() => true).then((results) => {
      this.libraries = results.data.map(l => new Library(l))
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
    await Promise.all([p1, p2, p3, p4, p5, p6])

    // Update server version in server settings
    if (this.previousVersion) {
      this.serverSettings.version = version
      await this.updateServerSettings()
    }
  }

  updateAudiobook(audiobook) {
    return this.audiobooksDb.update((record) => record.id === audiobook.id, () => audiobook).then((results) => {
      Logger.debug(`[DB] Audiobook updated ${results.updated}`)
      return true
    }).catch((error) => {
      Logger.error(`[DB] Audiobook update failed ${error}`)
      return false
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
      this[arrayKey] = this[arrayKey].concat(entities)
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
      this[arrayKey].push(entity)
      return true
    }).catch((error) => {
      Logger.error(`[DB] Failed to insert ${entityName}`, error)
      return false
    })
  }

  updateEntities(entityName, entities) {
    var entityDb = this.getEntityDb(entityName)

    var entityIds = entities.map(ent => ent.id)
    return entityDb.update((record) => entityIds.includes(record.id), (record) => {
      return entities.find(ent => ent.id === record.id)
    }).then((results) => {
      Logger.debug(`[DB] Updated ${entityName}: ${results.updated}`)
      var arrayKey = this.getEntityArrayKey(entityName)
      this[arrayKey] = this[arrayKey].map(e => {
        if (entityIds.includes(e.id)) return entities.find(_e => _e.id === e.id)
        return e
      })
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
      } else {
        Logger.debug(`[DB] Updated ${entityName}: ${results.updated}`)
      }

      var arrayKey = this.getEntityArrayKey(entityName)
      this[arrayKey] = this[arrayKey].map(e => {
        return e.id === entity.id ? entity : e
      })
      return true
    }).catch((error) => {
      Logger.error(`[DB] Update entity ${entityName} Failed: ${error}`)
      return false
    })
  }

  removeEntity(entityName, entityId) {
    var entityDb = this.getEntityDb(entityName)
    return entityDb.delete((record) => record.id === entityId).then((results) => {
      Logger.debug(`[DB] Deleted entity ${entityName}: ${results.deleted}`)
      var arrayKey = this.getEntityArrayKey(entityName)
      this[arrayKey] = this[arrayKey].filter(e => {
        return e.id !== entityId
      })
    }).catch((error) => {
      Logger.error(`[DB] Remove entity ${entityName} Failed: ${error}`)
    })
  }

  recreateAudiobookDb() {
    return this.audiobooksDb.drop().then((results) => {
      Logger.info(`[DB] Dropped audiobook db`, results)
      this.audiobooksDb = new njodb.Database(this.AudiobooksPath)
      this.audiobooks = []
      return true
    }).catch((error) => {
      Logger.error(`[DB] Failed to drop audiobook db`, error)
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
