const Path = require('path')
const njodb = require("njodb")
const fs = require('fs-extra')
const jwt = require('jsonwebtoken')
const Logger = require('./Logger')
const Audiobook = require('./objects/Audiobook')
const User = require('./objects/User')
const Library = require('./objects/Library')
const ServerSettings = require('./objects/ServerSettings')

class Db {
  constructor(ConfigPath, AudiobookPath) {
    this.ConfigPath = ConfigPath
    this.AudiobookPath = AudiobookPath
    this.AudiobooksPath = Path.join(ConfigPath, 'audiobooks')
    this.UsersPath = Path.join(ConfigPath, 'users')
    this.LibrariesPath = Path.join(ConfigPath, 'libraries')
    this.SettingsPath = Path.join(ConfigPath, 'settings')

    this.audiobooksDb = new njodb.Database(this.AudiobooksPath)
    this.usersDb = new njodb.Database(this.UsersPath)
    this.librariesDb = new njodb.Database(this.LibrariesPath, { datastores: 2 })
    this.settingsDb = new njodb.Database(this.SettingsPath, { datastores: 2 })

    this.users = []
    this.libraries = []
    this.audiobooks = []
    this.settings = []

    this.serverSettings = null
  }

  getEntityDb(entityName) {
    if (entityName === 'user') return this.usersDb
    else if (entityName === 'audiobook') return this.audiobooksDb
    else if (entityName === 'library') return this.librariesDb
    return this.settingsDb
  }

  getEntityArrayKey(entityName) {
    if (entityName === 'user') return 'users'
    else if (entityName === 'audiobook') return 'audiobooks'
    else if (entityName === 'library') return 'libraries'
    return 'settings'
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
        fullPath: this.AudiobookPath,
        libraryId: 'main'
      }
    })
    return defaultLibrary
  }

  reinit() {
    this.audiobooksDb = new njodb.Database(this.AudiobooksPath)
    this.usersDb = new njodb.Database(this.UsersPath)
    this.librariesDb = new njodb.Database(this.LibrariesPath, { datastores: 2 })
    this.settingsDb = new njodb.Database(this.SettingsPath, { datastores: 2 })
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
        }
      }
    })
    await Promise.all([p1, p2, p3, p4])
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

  updateEntity(entityName, entity) {
    var entityDb = this.getEntityDb(entityName)

    var jsonEntity = entity
    if (entity && entity.toJSON) {
      jsonEntity = entity.toJSON()
    } else {
      console.log('Entity has no json', jsonEntity)
    }

    return entityDb.update((record) => record.id === entity.id, () => jsonEntity).then((results) => {
      Logger.debug(`[DB] Updated entity ${entityName}: ${results.updated}`)
      var arrayKey = this.getEntityArrayKey(entityName)
      this[arrayKey] = this[arrayKey].map(e => {
        return e.id === entity.id ? entity : e
      })
      return true
    }).catch((error) => {
      Logger.error(`[DB] Update entity ${entityName} Failed: ${error}`)

      if (error && error.code === 'ENOENT') {
        this.attemptDataRecovery(entityName)
      }

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

  async attemptDataRecovery(entityName) {
    var dbDirName = this.getEntityArrayKey(entityName)
    var dbdir = Path.join(this.ConfigPath, dbDirName)
    console.log('Attempting data recovery for:', dbdir)

    var exists = await fs.pathExists(dbdir)
    if (!exists) {
      console.error('Db dir does not exist', dbdir)
      return
    }

    try {
      var dbdatadir = Path.join(dbdir, 'data')
      var dbtmpdir = Path.join(dbdir, 'tmp')

      var datafiles = await fs.readdir(dbdatadir)
      var tempfiles = await fs.readdir(dbtmpdir)

      var orphanOld = datafiles.find(df => df.endsWith('.old'))
      if (orphanOld) {
        // Get data file num
        var dbnum = orphanOld.split('.')[1]
        console.log('Found orphan json.old', orphanOld, `Num: ${dbnum}`)

        var dbDataFilename = `data.${dbnum}.json`

        // make sure data.#.json does not already exist
        if (datafiles.includes(dbDataFilename)) {
          console.warn(`${dbDataFilename} already exists, not recovering`)
          return
        }

        // find temp file that was supposed to be renamed
        var matchingTmp = tempfiles.find(tmp => tmp.startsWith(`data.${dbnum}`))
        if (matchingTmp) {
          console.log('found matching tmp file', matchingTmp)

          var tmpfileFullPath = Path.join(dbtmpdir, matchingTmp)
          var renameToPath = Path.join(dbdatadir, dbDataFilename)

          console.log(`Renamining "${tmpfileFullPath}" => "${renameToPath}"`)
          await fs.rename(tmpfileFullPath, renameToPath)

          console.log('Data recovery successful -- unlinking old')

          var orphanOldPath = Path.join(dbdatadir, orphanOld)
          await fs.unlink(orphanOldPath)
          console.log('Removed .old file')

          // Removing lock dir throws error in proper-lockfile
          // var lockdirpath = Path.join(dbdatadir, `data.${dbnum}.json.lock`)
          // var lockdirexists = await fs.pathExists(lockdirpath)
          // if (lockdirexists) {
          //   await fs.rmdir(lockdirpath)
          //   console.log('Removed lock dir')
          // } else {
          //   console.log('No lock dir found', lockdirpath)
          // }
        }
      }
    } catch (error) {
      console.error('Data recovery failed', error)
    }
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

  getGenres() {
    var allGenres = []
    this.db.audiobooks.forEach((audiobook) => {
      allGenres = allGenres.concat(audiobook.genres)
    })
    allGenres = [...new Set(allGenres)] // Removes duplicates
    return allGenres
  }

  getTags() {
    var allTags = []
    this.db.audiobooks.forEach((audiobook) => {
      allTags = allTags.concat(audiobook.tags)
    })
    allTags = [...new Set(allTags)] // Removes duplicates
    return allTags
  }
}
module.exports = Db