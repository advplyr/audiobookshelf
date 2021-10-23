const express = require('express')
const Path = require('path')
const fs = require('fs-extra')

const Logger = require('./Logger')
const { isObject } = require('./utils/index')
const audioFileScanner = require('./utils/audioFileScanner')

const Library = require('./objects/Library')
const User = require('./objects/User')

class ApiController {
  constructor(MetadataPath, db, scanner, auth, streamManager, rssFeeds, downloadManager, coverController, backupManager, watcher, emitter, clientEmitter) {
    this.db = db
    this.scanner = scanner
    this.auth = auth
    this.streamManager = streamManager
    this.rssFeeds = rssFeeds
    this.downloadManager = downloadManager
    this.coverController = coverController
    this.backupManager = backupManager
    this.watcher = watcher
    this.emitter = emitter
    this.clientEmitter = clientEmitter
    this.MetadataPath = MetadataPath

    this.router = express()
    this.init()
  }

  init() {
    this.router.get('/find/covers', this.findCovers.bind(this))
    this.router.get('/find/:method', this.find.bind(this))

    this.router.get('/libraries', this.getLibraries.bind(this))
    this.router.patch('/libraries/order', this.reorderLibraries.bind(this))
    this.router.get('/library/:id/search', this.searchLibrary.bind(this))
    this.router.get('/library/:id', this.getLibrary.bind(this))
    this.router.delete('/library/:id', this.deleteLibrary.bind(this))
    this.router.patch('/library/:id', this.updateLibrary.bind(this))
    this.router.get('/library/:id/audiobooks', this.getLibraryAudiobooks.bind(this))
    this.router.post('/library', this.createNewLibrary.bind(this))

    this.router.get('/audiobooks', this.getAudiobooks.bind(this)) // Old route should pass library id
    this.router.delete('/audiobooks', this.deleteAllAudiobooks.bind(this))
    this.router.post('/audiobooks/delete', this.batchDeleteAudiobooks.bind(this))
    this.router.post('/audiobooks/update', this.batchUpdateAudiobooks.bind(this))

    this.router.get('/audiobook/:id', this.getAudiobook.bind(this))
    this.router.delete('/audiobook/:id', this.deleteAudiobook.bind(this))
    this.router.patch('/audiobook/:id/tracks', this.updateAudiobookTracks.bind(this))
    this.router.post('/audiobook/:id/cover', this.uploadAudiobookCover.bind(this))
    this.router.patch('/audiobook/:id/coverfile', this.updateAudiobookCoverFromFile.bind(this))
    this.router.patch('/audiobook/:id', this.updateAudiobook.bind(this))

    this.router.patch('/match/:id', this.match.bind(this))

    this.router.delete('/user/audiobook/:id', this.resetUserAudiobookProgress.bind(this))
    this.router.patch('/user/audiobook/:id', this.updateUserAudiobookProgress.bind(this))
    this.router.patch('/user/audiobooks', this.batchUpdateUserAudiobooksProgress.bind(this))

    this.router.patch('/user/password', this.userChangePassword.bind(this))
    this.router.patch('/user/settings', this.userUpdateSettings.bind(this))
    this.router.get('/users', this.getUsers.bind(this))
    this.router.post('/user', this.createUser.bind(this))
    this.router.get('/user/:id', this.getUser.bind(this))
    this.router.patch('/user/:id', this.updateUser.bind(this))
    this.router.delete('/user/:id', this.deleteUser.bind(this))

    this.router.patch('/serverSettings', this.updateServerSettings.bind(this))

    this.router.delete('/backup/:id', this.deleteBackup.bind(this))
    this.router.post('/backup/upload', this.uploadBackup.bind(this))

    this.router.post('/authorize', this.authorize.bind(this))

    this.router.get('/genres', this.getGenres.bind(this))

    this.router.post('/feed', this.openRssFeed.bind(this))

    this.router.get('/download/:id', this.download.bind(this))

    this.router.get('/filesystem', this.getFileSystemPaths.bind(this))

    this.router.get('/scantracks/:id', this.scanAudioTrackNums.bind(this))
  }

  find(req, res) {
    this.scanner.find(req, res)
  }

  findCovers(req, res) {
    this.scanner.findCovers(req, res)
  }

  authorize(req, res) {
    if (!req.user) {
      Logger.error('Invalid user in authorize')
      return res.sendStatus(401)
    }
    res.json({ user: req.user })
  }

  getLibraries(req, res) {
    var libraries = this.db.libraries.map(lib => lib.toJSON())
    res.json(libraries)
  }

  async reorderLibraries(req, res) {
    if (!req.user || !req.user.isRoot) {
      Logger.error('[ApiController] ReorderLibraries invalid user', req.user)
      return res.sendStatus(401)
    }

    var orderdata = req.body
    var hasUpdates = false
    for (let i = 0; i < orderdata.length; i++) {
      var library = this.db.libraries.find(lib => lib.id === orderdata[i].id)
      if (!library) {
        Logger.error(`[ApiController] Invalid library not found in reorder ${orderdata[i].id}`)
        return res.sendStatus(500)
      }
      if (library.update({ displayOrder: orderdata[i].newOrder })) {
        hasUpdates = true
        await this.db.updateEntity('library', library)
      }
    }

    if (hasUpdates) {
      Logger.info(`[ApiController] Updated library display orders`)
    } else {
      Logger.info(`[ApiController] Library orders were up to date`)
    }

    var libraries = this.db.libraries.map(lib => lib.toJSON())
    res.json(libraries)
  }

  searchLibrary(req, res) {
    var library = this.db.libraries.find(lib => lib.id === req.params.id)
    if (!library) {
      return res.status(404).send('Library not found')
    }
    if (!req.query.q) {
      return res.status(400).send('No query string')
    }
    var maxResults = req.query.max || 3

    var bookMatches = []
    var authorMatches = {}
    var seriesMatches = {}
    var tagMatches = {}

    var audiobooksInLibrary = this.db.audiobooks.filter(ab => ab.libraryId === library.id)
    audiobooksInLibrary.forEach((ab) => {
      var queryResult = ab.searchQuery(req.query.q)
      if (queryResult.book) {
        var bookMatchObj = {
          audiobook: ab,
          matchKey: queryResult.book,
          matchText: queryResult.bookMatchText
        }
        bookMatches.push(bookMatchObj)
      }
      if (queryResult.author && !authorMatches[queryResult.author]) {
        authorMatches[queryResult.author] = {
          author: queryResult.author
        }
      }
      if (queryResult.series) {
        if (!seriesMatches[queryResult.series]) {
          seriesMatches[queryResult.series] = {
            series: queryResult.series,
            audiobooks: [ab]
          }
        } else {
          seriesMatches[queryResult.series].audiobooks.push(ab)
        }
      }
      if (queryResult.tags && queryResult.tags.length) {
        queryResult.tags.forEach((tag) => {
          if (!tagMatches[tag]) {
            tagMatches[tag] = {
              tag,
              audiobooks: [ab]
            }
          } else {
            tagMatches[tag].audiobooks.push(ab)
          }
        })
      }
    })

    res.json({
      audiobooks: bookMatches.slice(0, maxResults),
      tags: Object.values(tagMatches).slice(0, maxResults),
      authors: Object.values(authorMatches).slice(0, maxResults),
      series: Object.values(seriesMatches).slice(0, maxResults)
    })
  }

  getLibrary(req, res) {
    var library = this.db.libraries.find(lib => lib.id === req.params.id)
    if (!library) {
      return res.status(404).send('Library not found')
    }
    return res.json(library.toJSON())
  }

  async deleteLibrary(req, res) {
    var library = this.db.libraries.find(lib => lib.id === req.params.id)
    if (!library) {
      return res.status(404).send('Library not found')
    }

    // Remove library watcher
    this.watcher.removeLibrary(library)

    // Remove audiobooks in this library
    var audiobooks = this.db.audiobooks.filter(ab => ab.libraryId === library.id)
    Logger.info(`[Server] deleting library "${library.name}" with ${audiobooks.length} audiobooks"`)
    for (let i = 0; i < audiobooks.length; i++) {
      await this.handleDeleteAudiobook(audiobooks[i])
    }

    var libraryJson = library.toJSON()
    await this.db.removeEntity('library', library.id)
    this.emitter('library_removed', libraryJson)
    return res.json(libraryJson)
  }

  async updateLibrary(req, res) {
    var library = this.db.libraries.find(lib => lib.id === req.params.id)
    if (!library) {
      return res.status(404).send('Library not found')
    }
    var hasUpdates = library.update(req.body)
    if (hasUpdates) {
      // Update watcher
      this.watcher.updateLibrary(library)

      // Remove audiobooks no longer in library
      var audiobooksToRemove = this.db.audiobooks.filter(ab => !library.checkFullPathInLibrary(ab.fullPath))
      if (audiobooksToRemove.length) {
        Logger.info(`[Scanner] Updating library, removing ${audiobooksToRemove.length} audiobooks`)
        for (let i = 0; i < audiobooksToRemove.length; i++) {
          await this.handleDeleteAudiobook(audiobooksToRemove[i])
        }
      }
      await this.db.updateEntity('library', library)
      this.emitter('library_updated', library.toJSON())
    }
    return res.json(library.toJSON())
  }

  getLibraryAudiobooks(req, res) {
    var libraryId = req.params.id
    var library = this.db.libraries.find(lib => lib.id === libraryId)
    if (!library) {
      return res.status(400).send('Library does not exist')
    }

    var audiobooks = []
    if (req.query.q) {
      audiobooks = this.db.audiobooks.filter(ab => {
        return ab.libraryId === libraryId && ab.isSearchMatch(req.query.q)
      }).map(ab => ab.toJSONMinified())
    } else {
      audiobooks = this.db.audiobooks.filter(ab => ab.libraryId === libraryId).map(ab => ab.toJSONMinified())
    }
    res.json(audiobooks)
  }

  async createNewLibrary(req, res) {
    var newLibraryPayload = {
      ...req.body
    }
    if (!newLibraryPayload.name || !newLibraryPayload.folders || !newLibraryPayload.folders.length) {
      return res.status(500).send('Invalid request')
    }

    var library = new Library()
    newLibraryPayload.displayOrder = this.db.libraries.length + 1
    library.setData(newLibraryPayload)
    await this.db.insertEntity('library', library)
    this.emitter('library_added', library.toJSON())

    // Add library watcher
    this.watcher.addLibrary(library)

    res.json(library)
  }

  getAudiobooks(req, res) {
    var audiobooks = []
    if (req.query.q) {
      audiobooks = this.db.audiobooks.filter(ab => {
        return ab.isSearchMatch(req.query.q)
      }).map(ab => ab.toJSONMinified())
    } else {
      audiobooks = this.db.audiobooks.map(ab => ab.toJSONMinified())
    }
    res.json(audiobooks)
  }

  async deleteAllAudiobooks(req, res) {
    if (!req.user.isRoot) {
      Logger.warn('User other than root attempted to delete all audiobooks', req.user)
      return res.sendStatus(403)
    }
    Logger.info('Removing all Audiobooks')
    var success = await this.db.recreateAudiobookDb()
    if (success) res.sendStatus(200)
    else res.sendStatus(500)
  }

  getAudiobook(req, res) {
    if (!req.user) {
      return res.sendStatus(403)
    }
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)

    // Check user can access this audiobooks library
    if (!req.user.checkCanAccessLibrary(audiobook.libraryId)) {
      return res.sendStatus(403)
    }

    res.json(audiobook.toJSONExpanded())
  }

  async handleDeleteAudiobook(audiobook) {
    // Remove audiobook from users
    for (let i = 0; i < this.db.users.length; i++) {
      var user = this.db.users[i]
      var madeUpdates = user.deleteAudiobookProgress(audiobook.id)
      if (madeUpdates) {
        await this.db.updateEntity('user', user)
      }
    }

    // remove any streams open for this audiobook
    var streams = this.streamManager.streams.filter(stream => stream.audiobookId === audiobook.id)
    for (let i = 0; i < streams.length; i++) {
      var stream = streams[i]
      var client = stream.client
      await stream.close()
      if (client && client.user) {
        client.user.stream = null
        client.stream = null
        this.db.updateUserStream(client.user.id, null)
      }
    }

    var audiobookJSON = audiobook.toJSONMinified()
    await this.db.removeEntity('audiobook', audiobook.id)
    this.emitter('audiobook_removed', audiobookJSON)
  }

  async deleteAudiobook(req, res) {
    if (!req.user.canDelete) {
      Logger.warn('User attempted to delete without permission', req.user)
      return res.sendStatus(403)
    }
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)

    await this.handleDeleteAudiobook(audiobook)
    res.sendStatus(200)
  }

  async batchDeleteAudiobooks(req, res) {
    if (!req.user.canDelete) {
      Logger.warn('User attempted to delete without permission', req.user)
      return res.sendStatus(403)
    }
    var { audiobookIds } = req.body
    if (!audiobookIds || !audiobookIds.length) {
      return res.sendStatus(500)
    }

    var audiobooksToDelete = this.db.audiobooks.filter(ab => audiobookIds.includes(ab.id))
    if (!audiobooksToDelete.length) {
      return res.sendStatus(404)
    }
    for (let i = 0; i < audiobooksToDelete.length; i++) {
      Logger.info(`[ApiController] Deleting Audiobook "${audiobooksToDelete[i].title}"`)
      await this.handleDeleteAudiobook(audiobooksToDelete[i])
    }
    res.sendStatus(200)
  }

  async batchUpdateAudiobooks(req, res) {
    if (!req.user.canUpdate) {
      Logger.warn('User attempted to batch update without permission', req.user)
      return res.sendStatus(403)
    }
    var audiobooks = req.body
    if (!audiobooks || !audiobooks.length) {
      return res.sendStatus(500)
    }

    var audiobooksUpdated = 0
    audiobooks = audiobooks.map((ab) => {
      var _ab = this.db.audiobooks.find(__ab => __ab.id === ab.id)
      if (!_ab) return null
      var hasUpdated = _ab.update(ab)
      if (!hasUpdated) return null
      audiobooksUpdated++
      return _ab
    }).filter(ab => ab)

    if (audiobooksUpdated) {
      Logger.info(`[ApiController] ${audiobooksUpdated} Audiobooks have updates`)
      for (let i = 0; i < audiobooks.length; i++) {
        await this.db.updateAudiobook(audiobooks[i])
        this.emitter('audiobook_updated', audiobooks[i].toJSONMinified())
      }
    }

    res.json({
      success: true,
      updates: audiobooksUpdated
    })
  }

  async updateAudiobookTracks(req, res) {
    if (!req.user.canUpdate) {
      Logger.warn('User attempted to update audiotracks without permission', req.user)
      return res.sendStatus(403)
    }
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)
    var orderedFileData = req.body.orderedFileData
    Logger.info(`Updating audiobook tracks called ${audiobook.id}`)
    audiobook.updateAudioTracks(orderedFileData)
    await this.db.updateAudiobook(audiobook)
    this.emitter('audiobook_updated', audiobook.toJSONMinified())
    res.json(audiobook.toJSON())
  }

  async uploadAudiobookCover(req, res) {
    if (!req.user.canUpload || !req.user.canUpdate) {
      Logger.warn('User attempted to upload a cover without permission', req.user)
      return res.sendStatus(403)
    }

    var audiobookId = req.params.id
    var audiobook = this.db.audiobooks.find(ab => ab.id === audiobookId)
    if (!audiobook) {
      return res.status(404).send('Audiobook not found')
    }

    var result = null
    if (req.body && req.body.url) {
      Logger.debug(`[ApiController] Requesting download cover from url "${req.body.url}"`)
      result = await this.coverController.downloadCoverFromUrl(audiobook, req.body.url)
    } else if (req.files && req.files.cover) {
      Logger.debug(`[ApiController] Handling uploaded cover`)
      var coverFile = req.files.cover
      result = await this.coverController.uploadCover(audiobook, coverFile)
    } else {
      return res.status(400).send('Invalid request no file or url')
    }

    if (result && result.error) {
      return res.status(400).send(result.error)
    } else if (!result || !result.cover) {
      return res.status(500).send('Unknown error occurred')
    }

    await this.db.updateAudiobook(audiobook)
    this.emitter('audiobook_updated', audiobook.toJSONMinified())
    res.json({
      success: true,
      cover: result.cover
    })
  }

  async updateAudiobookCoverFromFile(req, res) {
    if (!req.user.canUpdate) {
      Logger.warn('User attempted to update without permission', req.user)
      return res.sendStatus(403)
    }
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)

    var coverFile = req.body
    var updated = await audiobook.setCoverFromFile(coverFile)

    if (updated) {
      await this.db.updateAudiobook(audiobook)
      this.emitter('audiobook_updated', audiobook.toJSONMinified())
    }

    if (updated) res.status(200).send('Cover updated successfully')
    else res.status(200).send('No update was made to cover')
  }

  async updateAudiobook(req, res) {
    if (!req.user.canUpdate) {
      Logger.warn('User attempted to update without permission', req.user)
      return res.sendStatus(403)
    }
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)
    var hasUpdates = audiobook.update(req.body)
    if (hasUpdates) {
      await this.db.updateAudiobook(audiobook)
    }
    this.emitter('audiobook_updated', audiobook.toJSONMinified())
    res.json(audiobook.toJSON())
  }

  async match(req, res) {
    var body = req.body
    var audiobookId = req.params.id
    var audiobook = this.db.audiobooks.find(ab => ab.id === audiobookId)
    var bookData = {
      olid: body.id,
      publish_year: body.first_publish_year,
      description: body.description,
      title: body.title,
      author: body.author,
      cover: body.cover
    }
    audiobook.setBook(bookData)
    await this.db.updateAudiobook(audiobook)

    this.emitter('audiobook_updated', audiobook.toJSONMinified())

    res.sendStatus(200)
  }

  async resetUserAudiobookProgress(req, res) {
    var audiobook = this.db.audiobooks.find(ab => ab.id === req.params.id)
    if (!audiobook) {
      return res.status(404).send('Audiobook not found')
    }
    req.user.resetAudiobookProgress(audiobook)
    await this.db.updateEntity('user', req.user)
    this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    res.sendStatus(200)
  }

  async updateUserAudiobookProgress(req, res) {
    var audiobook = this.db.audiobooks.find(ab => ab.id === req.params.id)
    if (!audiobook) {
      return res.status(404).send('Audiobook not found')
    }
    var wasUpdated = req.user.updateAudiobookProgress(audiobook, req.body)
    if (wasUpdated) {
      await this.db.updateEntity('user', req.user)
      this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }
    res.sendStatus(200)
  }

  async batchUpdateUserAudiobooksProgress(req, res) {
    var abProgresses = req.body
    if (!abProgresses || !abProgresses.length) {
      return res.sendStatus(500)
    }

    var shouldUpdate = false
    abProgresses.forEach((progress) => {
      var audiobook = this.db.audiobooks.find(ab => ab.id === progress.audiobookId)
      if (audiobook) {
        var wasUpdated = req.user.updateAudiobookProgress(audiobook, progress)
        if (wasUpdated) shouldUpdate = true
      }
    })

    if (shouldUpdate) {
      await this.db.updateEntity('user', req.user)
      this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }

    res.sendStatus(200)
  }

  userChangePassword(req, res) {
    this.auth.userChangePassword(req, res)
  }

  async openRssFeed(req, res) {
    var audiobookId = req.body.audiobookId
    var audiobook = this.db.audiobooks.find(ab => ab.id === audiobookId)
    if (!audiobook) return res.sendStatus(404)
    var feed = await this.rssFeeds.openFeed(audiobook)
    console.log('Feed open', feed)
    res.json(feed)
  }

  async userUpdateSettings(req, res) {
    var settingsUpdate = req.body
    if (!settingsUpdate || !isObject(settingsUpdate)) {
      return res.sendStatus(500)
    }
    var madeUpdates = req.user.updateSettings(settingsUpdate)
    if (madeUpdates) {
      await this.db.updateEntity('user', req.user)
    }
    return res.json({
      success: true,
      settings: req.user.settings
    })
  }

  userJsonWithBookProgressDetails(user) {
    var json = user.toJSONForBrowser()

    // User audiobook progress attach book details
    if (json.audiobooks && Object.keys(json.audiobooks).length) {
      for (const audiobookId in json.audiobooks) {
        var audiobook = this.db.audiobooks.find(ab => ab.id === audiobookId)
        if (!audiobook) {
          Logger.error('[ApiController] Audiobook not found for users progress ' + audiobookId)
        } else {
          json.audiobooks[audiobookId].book = audiobook.book.toJSON()
        }
      }
    }

    return json
  }

  getUsers(req, res) {
    if (req.user.type !== 'root') return res.sendStatus(403)
    var users = this.db.users.map(u => this.userJsonWithBookProgressDetails(u))
    res.json(users)
  }

  async createUser(req, res) {
    if (!req.user.isRoot) {
      Logger.warn('Non-root user attempted to create user', req.user)
      return res.sendStatus(403)
    }
    var account = req.body

    var username = account.username
    var usernameExists = this.db.users.find(u => u.username.toLowerCase() === username.toLowerCase())
    if (usernameExists) {
      return res.status(500).send('Username already taken')
    }

    account.id = (Math.trunc(Math.random() * 1000) + Date.now()).toString(36)
    account.pash = await this.auth.hashPass(account.password)
    delete account.password
    account.token = await this.auth.generateAccessToken({ userId: account.id })
    account.createdAt = Date.now()
    var newUser = new User(account)
    var success = await this.db.insertEntity('user', newUser)
    if (success) {
      this.clientEmitter(req.user.id, 'user_added', newUser)
      res.json({
        user: newUser.toJSONForBrowser()
      })
    } else {
      return res.status(500).send('Failed to save new user')
    }
  }

  async getUser(req, res) {
    if (!req.user.isRoot) {
      Logger.error('User other than root attempting to get user', req.user)
      return res.sendStatus(403)
    }

    var user = this.db.users.find(u => u.id === req.params.id)
    if (!user) {
      return res.sendStatus(404)
    }

    res.json(this.userJsonWithBookProgressDetails(user))
  }

  async updateUser(req, res) {
    if (!req.user.isRoot) {
      Logger.error('User other than root attempting to update user', req.user)
      return res.sendStatus(403)
    }

    var user = this.db.users.find(u => u.id === req.params.id)
    if (!user) {
      return res.sendStatus(404)
    }

    var account = req.body

    if (account.username !== undefined && account.username !== user.username) {
      var usernameExists = this.db.users.find(u => u.username.toLowerCase() === account.username.toLowerCase())
      if (usernameExists) {
        return res.status(500).send('Username already taken')
      }
    }

    // Updating password
    if (account.password) {
      account.pash = await this.auth.hashPass(account.password)
      delete account.password
    }

    var hasUpdated = user.update(account)
    if (hasUpdated) {
      await this.db.updateEntity('user', user)
    }

    this.clientEmitter(req.user.id, 'user_updated', user.toJSONForBrowser())
    res.json({
      success: true,
      user: user.toJSONForBrowser()
    })
  }

  async deleteUser(req, res) {
    if (!req.user.isRoot) {
      Logger.error('User other than root attempting to delete user', req.user)
      return res.sendStatus(403)
    }
    if (req.params.id === 'root') {
      return res.sendStatus(500)
    }
    if (req.user.id === req.params.id) {
      Logger.error('Attempting to delete themselves...')
      return res.sendStatus(500)
    }
    var user = this.db.users.find(u => u.id === req.params.id)
    if (!user) {
      Logger.error('User not found')
      return res.json({
        error: 'User not found'
      })
    }

    // Todo: check if user is logged in and cancel streams

    var userJson = user.toJSONForBrowser()
    await this.db.removeEntity('user', user.id)
    this.clientEmitter(req.user.id, 'user_removed', userJson)
    res.json({
      success: true
    })
  }

  async updateServerSettings(req, res) {
    if (!req.user.isRoot) {
      Logger.error('User other than root attempting to update server settings', req.user)
      return res.sendStatus(403)
    }
    var settingsUpdate = req.body
    if (!settingsUpdate || !isObject(settingsUpdate)) {
      return res.status(500).send('Invalid settings update object')
    }

    var madeUpdates = this.db.serverSettings.update(settingsUpdate)
    if (madeUpdates) {
      // If backup schedule is updated - update backup manager
      if (settingsUpdate.backupSchedule !== undefined) {
        this.backupManager.updateCronSchedule()
      }

      await this.db.updateEntity('settings', this.db.serverSettings)
    }
    return res.json({
      success: true,
      serverSettings: this.db.serverSettings
    })
  }

  async deleteBackup(req, res) {
    if (!req.user.isRoot) {
      Logger.error(`[ApiController] Non-Root user attempting to delete backup`, req.user)
      return res.sendStatus(403)
    }
    var backup = this.backupManager.backups.find(b => b.id === req.params.id)
    if (!backup) {
      return res.sendStatus(404)
    }
    await this.backupManager.removeBackup(backup)
    res.json(this.backupManager.backups.map(b => b.toJSON()))
  }

  async uploadBackup(req, res) {
    if (!req.user.isRoot) {
      Logger.error(`[ApiController] Non-Root user attempting to upload backup`, req.user)
      return res.sendStatus(403)
    }
    if (!req.files.file) {
      Logger.error('[ApiController] Upload backup invalid')
      return res.sendStatus(500)
    }
    this.backupManager.uploadBackup(req, res)
  }

  async download(req, res) {
    if (!req.user.canDownload) {
      Logger.error('User attempting to download without permission', req.user)
      return res.sendStatus(403)
    }
    var downloadId = req.params.id
    Logger.info('Download Request', downloadId)
    var download = this.downloadManager.getDownload(downloadId)
    if (!download) {
      Logger.error('Download request not found', downloadId)
      return res.sendStatus(404)
    }

    var options = {
      headers: {
        'Content-Type': download.mimeType
      }
    }
    res.download(download.fullPath, download.filename, options, (err) => {
      if (err) {
        Logger.error('Download Error', err)
      }
    })
  }

  getGenres(req, res) {
    res.json({
      genres: this.db.getGenres()
    })
  }

  async getDirectories(dir, relpath, excludedDirs, level = 0) {
    try {
      var paths = await fs.readdir(dir)

      var dirs = await Promise.all(paths.map(async dirname => {
        var fullPath = Path.join(dir, dirname)
        var path = Path.join(relpath, dirname)

        var isDir = (await fs.lstat(fullPath)).isDirectory()
        if (isDir && !excludedDirs.includes(path) && dirname !== 'node_modules') {
          return {
            path,
            dirname,
            fullPath,
            level,
            dirs: level < 4 ? (await this.getDirectories(fullPath, path, excludedDirs, level + 1)) : []
          }
        } else {
          return false
        }
      }))
      dirs = dirs.filter(d => d)
      return dirs
    } catch (error) {
      Logger.error('Failed to readdir', dir, error)
      return []
    }
  }

  async getFileSystemPaths(req, res) {
    var excludedDirs = ['node_modules', 'client', 'server', '.git', 'static', 'build', 'dist', 'metadata', 'config', 'sys', 'proc'].map(dirname => {
      return Path.sep + dirname
    })

    // Do not include existing mapped library paths in response
    this.db.libraries.forEach(lib => {
      lib.folders.forEach((folder) => {
        var dir = folder.fullPath
        if (dir.includes(global.appRoot)) dir = dir.replace(global.appRoot, '')
        excludedDirs.push(dir)
      })
    })

    Logger.debug(`[Server] get file system paths, excluded: ${excludedDirs.join(', ')}`)
    var dirs = await this.getDirectories(global.appRoot, '/', excludedDirs)
    res.json(dirs)
  }

  async scanAudioTrackNums(req, res) {
    if (!req.user || !req.user.isRoot) {
      return res.sendStatus(403)
    }
    var audiobook = this.db.audiobooks.find(ab => ab.id === req.params.id)
    if (!audiobook) {
      return res.status(404).send('Audiobook not found')
    }

    var scandata = await audioFileScanner.scanTrackNumbers(audiobook)
    res.json(scandata)
  }
}
module.exports = ApiController