const uuidv4 = require("uuid").v4
const Folder = require('./Folder')
const LibrarySettings = require('./settings/LibrarySettings')
const { filePathToPOSIX } = require('../utils/fileUtils')
/**
 * @openapi
 * components:
 *   schemas:
 *     mediaType:
 *       type: string
 *       description: The type of media, will be book or podcast.
 *       enum: [book, podcast]
 *     oldLibraryId:
 *       type: string
 *       description: The ID of the libraries created on server version 2.2.23 and before.
 *       format: "lib_[a-z0-9]{18}"
 *       example: lib_o78uaoeuh78h6aoeif
 *     newLibraryId:
 *       type: string
 *       description: The library ID for any libraries after 2.3.0.
 *       format: uuid
 *       example: e4bb1afb-4a4f-4dd6-8be0-e615d233185b
 *     libraryId:
 *       type: string
 *       anyOf:
 *         - $ref: '#/components/schemas/oldLibraryId'
 *         - $ref: '#/components/schemas/newLibraryId'
 *     library:
 *       type: object
 *       properties:
 *         id:
 *           $ref: '#/components/schemas/libraryId'
 *         name:
 *           type: string
 *           description: The name of the library.
 *           example: Main
 *         folders:
 *           type: array
 *           description: The folders that the library is composed of on the server.
 *           items:
 *             $ref: '#/components/schemas/folder'
 *         displayOrder:
 *           type: integer
 *           description: Display position of the library in the list of libraries. Must be >= 1.
 *           example: 1
 *         icon:
 *           type: string
 *           description: The selected icon for the library. See [Library Icons](https://api.audiobookshelf.org/#library-icons) for a list of possible icons.
 *           example: audiobookshelf
 *         mediaType:
 *           - $ref: '#/components/schemas/mediaType'
 *         provider:
 *           type: string
 *           description: Preferred metadata provider for the library. See [Metadata Providers](https://api.audiobookshelf.org/#metadata-providers) for a list of possible providers.
 *           example: audible
 *         settings:
 *           $ref: '#/components/schemas/librarySettings'
 *         createdAt:
 *           $ref: '#/components/schemas/createdAt'
 *         lastUpdate:
 *           type: integer
 *           description: The time (in ms since POSIX epoch) when the library was last updated. (Read Only)
 *           example: 1646520916818
 *     librarySettings:
 *       type: object
 *       properties:
 *         coverAspectRatio:
 *           type: integer
 *           description: Whether the library should use square book covers. Must be 0 (for false) or 1 (for true).
 *           example: 1
 *         disableWatcher:
 *           type: boolean
 *           description: Whether to disable the folder watcher for the library.
 *           example: false
 *         skipMatchingMediaWithAsin:
 *           type: boolean
 *           description: Whether to skip matching books that already have an ASIN.
 *           example: false
 *         skipMatchingMediaWithIsbn:
 *           type: boolean
 *           description: Whether to skip matching books that already have an ISBN.
 *           example: false
 *         autoScanCronExpression:
 *           description: The cron expression for when to automatically scan the library folders. If null, automatic scanning will be disabled.
 *           type: [string, 'null']
 *     libraryFilterData:
 *       type: object
 *       properties:
 *         authors:
 *           description: The authors of books in the library.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/authorMinified'
 *         genres:
 *           description: The genres of books in the library.
 *           type: array
 *           items:
 *             type: string
 *             example: Fantasy
 *         tags:
 *           $ref: '#/components/schemas/tags'
 *         series:
 *           description: The series in the library. The series will only have their id and name.
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: ser_cabkj4jeu8be3rap4g
 *               name:
 *                 type: string
 *                 example: Sword of Truth
 *         narrators:
 *           description: The narrators of books in the library.
 *           type: array
 *           items:
 *             type: string
 *             example: Sam Tsoutsouvas
 *         languages:
 *           description: The languages of books in the library.
 *           type: array
 *           items:
 *             type: string
 */
class Library {
  constructor(library = null) {
    this.id = null
    this.oldLibraryId = null // TODO: Temp
    this.name = null
    this.folders = []
    this.displayOrder = 1
    this.icon = 'database'
    this.mediaType = 'book' // book, podcast
    this.provider = 'google'

    this.lastScan = 0
    this.lastScanVersion = null
    this.lastScanMetadataPrecedence = null

    this.settings = null

    this.createdAt = null
    this.lastUpdate = null

    if (library) {
      this.construct(library)
    }
  }

  get folderPaths() {
    return this.folders.map(f => f.fullPath)
  }
  get isPodcast() {
    return this.mediaType === 'podcast'
  }
  get isMusic() {
    return this.mediaType === 'music'
  }
  get isBook() {
    return this.mediaType === 'book'
  }

  construct(library) {
    this.id = library.id
    this.oldLibraryId = library.oldLibraryId
    this.name = library.name
    this.folders = (library.folders || []).map(f => new Folder(f))
    this.displayOrder = library.displayOrder || 1
    this.icon = library.icon || 'database'
    this.mediaType = library.mediaType
    this.provider = library.provider || 'google'

    this.settings = new LibrarySettings(library.settings)
    if (library.settings === undefined) { // LibrarySettings added in v2, migrate settings
      this.settings.disableWatcher = !!library.disableWatcher
    }

    this.lastScan = library.lastScan
    this.lastScanVersion = library.lastScanVersion
    this.lastScanMetadataPrecedence = library.lastScanMetadataPrecedence

    this.createdAt = library.createdAt
    this.lastUpdate = library.lastUpdate
    this.cleanOldValues() // mediaType changed for v2 and icon change for v2.2.2
  }

  cleanOldValues() {
    const availableIcons = ['database', 'audiobookshelf', 'books-1', 'books-2', 'book-1', 'microphone-1', 'microphone-3', 'radio', 'podcast', 'rss', 'headphones', 'music', 'file-picture', 'rocket', 'power', 'star', 'heart']
    if (!availableIcons.includes(this.icon)) {
      if (this.icon === 'audiobook') this.icon = 'audiobookshelf'
      else if (this.icon === 'book') this.icon = 'books-1'
      else if (this.icon === 'comic') this.icon = 'file-picture'
      else this.icon = 'database'
    }

    const mediaTypes = ['podcast', 'book', 'video', 'music']
    if (!this.mediaType || !mediaTypes.includes(this.mediaType)) {
      this.mediaType = 'book'
    }
  }

  toJSON() {
    return {
      id: this.id,
      oldLibraryId: this.oldLibraryId,
      name: this.name,
      folders: (this.folders || []).map(f => f.toJSON()),
      displayOrder: this.displayOrder,
      icon: this.icon,
      mediaType: this.mediaType,
      provider: this.provider,
      settings: this.settings.toJSON(),
      lastScan: this.lastScan,
      lastScanVersion: this.lastScanVersion,
      createdAt: this.createdAt,
      lastUpdate: this.lastUpdate
    }
  }

  setData(data) {
    this.id = data.id || uuidv4()
    this.name = data.name
    if (data.folder) {
      this.folders = [
        new Folder(data.folder)
      ]
    } else if (data.folders) {
      this.folders = data.folders.map(folder => {
        var newFolder = new Folder()
        newFolder.setData({
          fullPath: folder.fullPath,
          libraryId: this.id
        })
        return newFolder
      })
    }
    this.displayOrder = data.displayOrder || 1
    this.icon = data.icon || 'database'
    this.mediaType = data.mediaType || 'book'
    this.provider = data.provider || 'google'
    this.settings = new LibrarySettings(data.settings)
    this.createdAt = Date.now()
    this.lastUpdate = Date.now()
  }

  update(payload) {
    let hasUpdates = false

    const keysToCheck = ['name', 'provider', 'mediaType', 'icon']
    keysToCheck.forEach((key) => {
      if (payload[key] && payload[key] !== this[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    })

    if (payload.settings && this.settings.update(payload.settings)) {
      hasUpdates = true
    }

    if (!isNaN(payload.displayOrder) && payload.displayOrder !== this.displayOrder) {
      this.displayOrder = Number(payload.displayOrder)
      hasUpdates = true
    }
    if (payload.folders) {
      const newFolders = payload.folders.filter(f => !f.id)
      const removedFolders = this.folders.filter(f => !payload.folders.some(_f => _f.id === f.id))

      if (removedFolders.length) {
        const removedFolderIds = removedFolders.map(f => f.id)
        this.folders = this.folders.filter(f => !removedFolderIds.includes(f.id))
      }

      if (newFolders.length) {
        newFolders.forEach((folderData) => {
          folderData.libraryId = this.id
          const newFolder = new Folder()
          newFolder.setData(folderData)
          this.folders.push(newFolder)
        })
      }

      if (newFolders.length || removedFolders.length) {
        hasUpdates = true
      }
    }
    if (hasUpdates) {
      this.lastUpdate = Date.now()
    }
    return hasUpdates
  }

  checkFullPathInLibrary(fullPath) {
    fullPath = filePathToPOSIX(fullPath)
    return this.folders.find(folder => fullPath.startsWith(filePathToPOSIX(folder.fullPath)))
  }

  getFolderById(id) {
    return this.folders.find(folder => folder.id === id)
  }
}
module.exports = Library