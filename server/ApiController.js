const express = require('express')
const Path = require('path')
const fs = require('fs-extra')
const Logger = require('./Logger')
const User = require('./objects/User')
const { isObject } = require('./utils/index')
const Library = require('./objects/Library')

class ApiController {
  constructor(MetadataPath, db, scanner, auth, streamManager, rssFeeds, downloadManager, coverController, watcher, emitter, clientEmitter) {
    this.db = db
    this.scanner = scanner
    this.auth = auth
    this.streamManager = streamManager
    this.rssFeeds = rssFeeds
    this.downloadManager = downloadManager
    this.coverController = coverController
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
    this.router.patch('/audiobook/:id', this.updateAudiobook.bind(this))

    this.router.patch('/match/:id', this.match.bind(this))

    this.router.delete('/user/audiobook/:id', this.resetUserAudiobookProgress.bind(this))
    this.router.patch('/user/audiobook/:id', this.updateUserAudiobookProgress.bind(this))
    this.router.patch('/user/audiobooks', this.batchUpdateUserAudiobooksProgress.bind(this))

    this.router.patch('/user/password', this.userChangePassword.bind(this))
    this.router.patch('/user/settings', this.userUpdateSettings.bind(this))
    this.router.get('/users', this.getUsers.bind(this))
    this.router.post('/user', this.createUser.bind(this))
    this.router.patch('/user/:id', this.updateUser.bind(this))
    this.router.delete('/user/:id', this.deleteUser.bind(this))

    this.router.patch('/serverSettings', this.updateServerSettings.bind(this))

    this.router.post('/authorize', this.authorize.bind(this))

    this.router.get('/genres', this.getGenres.bind(this))

    this.router.post('/feed', this.openRssFeed.bind(this))

    this.router.get('/download/:id', this.download.bind(this))

    this.router.get('/filesystem', this.getFileSystemPaths.bind(this))
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
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)
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

  getUsers(req, res) {
    if (req.user.type !== 'root') return res.sendStatus(403)
    return res.json(this.db.users.map(u => u.toJSONForBrowser()))
  }

  async resetUserAudiobookProgress(req, res) {
    req.user.resetAudiobookProgress(req.params.id)
    await this.db.updateEntity('user', req.user)
    this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    res.sendStatus(200)
  }

  async updateUserAudiobookProgress(req, res) {
    var wasUpdated = req.user.updateAudiobookProgress(req.params.id, req.body)
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
      var wasUpdated = req.user.updateAudiobookProgress(progress.audiobookId, progress)
      if (wasUpdated) shouldUpdate = true
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

  async createUser(req, res) {
    if (!req.user.isRoot) {
      Logger.warn('Non-root user attempted to create user', req.user)
      return res.sendStatus(403)
    }
    var account = req.body
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
      res.json({
        error: 'Failed to save new user'
      })
    }
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
      return res.sendStatus(500)
    }
    var madeUpdates = this.db.serverSettings.update(settingsUpdate)
    if (madeUpdates) {
      await this.db.updateEntity('settings', this.db.serverSettings)
    }
    return res.json({
      success: true,
      serverSettings: this.db.serverSettings
    })
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
        if (isDir && !excludedDirs.includes(dirname)) {
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
    var excludedDirs = ['node_modules', 'client', 'server', '.git', 'static', 'build', 'dist', 'metadata', 'config', 'sys', 'proc']

    // Do not include existing mapped library paths in response
    this.db.libraries.forEach(lib => {
      lib.folders.forEach((folder) => {
        excludedDirs.push(Path.basename(folder.fullPath))
      })
    })

    Logger.debug(`[Server] get file system paths, excluded: ${excludedDirs.join(', ')}`)
    var dirs = await this.getDirectories(global.appRoot, '/', excludedDirs)
    res.json(dirs)
  }
}
module.exports = ApiController