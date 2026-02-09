const Path = require('path')
const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const fs = require('../libs/fsExtra')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const { getTitleIgnorePrefix } = require('../utils')
const { sanitizeFilename, filePathToPOSIX } = require('../utils/fileUtils')

const RssFeedManager = require('../managers/RssFeedManager')

const libraryItemsBookFilters = require('../utils/queries/libraryItemsBookFilters')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestEntityObject
 * @property {import('../models/Series')} series
 *
 * @typedef {RequestWithUser & RequestEntityObject} SeriesControllerRequest
 */

class SeriesController {
  constructor() {}

  /**
   * @deprecated
   * /api/series/:id
   *
   * TODO: Update mobile app to use /api/libraries/:id/series/:seriesId API route instead
   * Series are not library specific so we need to know what the library id is
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async findOne(req, res) {
    const include = (req.query.include || '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => !!v)

    const seriesJson = req.series.toOldJSON()

    // Add progress map with isFinished flag
    if (include.includes('progress')) {
      const libraryItemsInSeries = req.libraryItemsInSeries
      const libraryItemsFinished = libraryItemsInSeries.filter((li) => {
        return req.user.getMediaProgress(li.media.id)?.isFinished
      })
      seriesJson.progress = {
        libraryItemIds: libraryItemsInSeries.map((li) => li.id),
        libraryItemIdsFinished: libraryItemsFinished.map((li) => li.id),
        isFinished: libraryItemsFinished.length === libraryItemsInSeries.length
      }
    }

    if (include.includes('rssfeed')) {
      const feedObj = await RssFeedManager.findFeedForEntityId(seriesJson.id)
      seriesJson.rssFeed = feedObj?.toOldJSONMinified() || null
    }

    res.json(seriesJson)
  }

  /**
   * TODO: Currently unused in the client, should check for duplicate name
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async update(req, res) {
    const keysToUpdate = ['name', 'description']
    const payload = {}
    for (const key of keysToUpdate) {
      if (req.body[key] !== undefined && typeof req.body[key] === 'string') {
        payload[key] = req.body[key]
      }
    }
    if (!Object.keys(payload).length) {
      return res.status(400).send('No valid fields to update')
    }
    req.series.set(payload)
    if (req.series.changed()) {
      await req.series.save()
      SocketAuthority.emitter('series_updated', req.series.toOldJSON())
    }
    res.json(req.series.toOldJSON())
  }

  /**
   * POST: /api/libraries/:id/series/:seriesId/placeholders
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async createPlaceholder(req, res) {
    if (!req.user.canUpdate) {
      Logger.warn(`[SeriesController] User "${req.user.username}" attempted to create placeholder without permission`)
      return res.sendStatus(403)
    }

    if (req.body?.cover || req.body?.url || req.files?.cover) {
      return res.status(400).send('Cover uploads are not supported for placeholders')
    }

    const libraryId = req.params.id
    const library = req.library || (await Database.libraryModel.findByIdWithFolders(libraryId))
    if (!library) {
      return res.status(404).send('Library not found')
    }

    if (!req.user.checkCanAccessLibrary(library.id)) {
      Logger.warn(`[SeriesController] User "${req.user.username}" attempted to access library "${library.id}" without permission`)
      return res.sendStatus(403)
    }

    const series = await Database.seriesModel.findByPk(req.params.seriesId)
    if (!series || series.libraryId !== library.id) {
      return res.sendStatus(404)
    }

    if (library.mediaType !== 'book') {
      return res.status(400).send('Library media type does not support series placeholders')
    }

    const requestedTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
    const placeholderTitle = requestedTitle || 'Placeholder'
    const requestedSequence = req.body?.sequence
    const placeholderSequence = typeof requestedSequence === 'string' || typeof requestedSequence === 'number' ? String(requestedSequence).trim() || null : null

    const requestedFolderId = typeof req.body?.folderId === 'string' ? req.body.folderId.trim() : ''
    let libraryFolder = null
    let seriesLibraryItem = null

    if (requestedFolderId) {
      libraryFolder = library.libraryFolders?.find((folder) => folder.id === requestedFolderId)
      if (!libraryFolder) {
        return res.status(404).send('Folder not found')
      }
    } else {
      seriesLibraryItem = await Database.libraryItemModel.findOne({
        where: {
          libraryId: library.id,
          mediaType: 'book'
        },
        include: [
          {
            model: Database.bookModel,
            required: true,
            include: [
              {
                model: Database.seriesModel,
                required: true,
                where: {
                  id: series.id
                },
                through: {
                  attributes: []
                }
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      })

      if (seriesLibraryItem?.libraryFolderId) {
        libraryFolder = library.libraryFolders?.find((folder) => folder.id === seriesLibraryItem.libraryFolderId) || null
      }
    }

    if (!libraryFolder) {
      libraryFolder = library.libraryFolders?.[0] || null
    }

    if (!libraryFolder) {
      Logger.error(`[SeriesController] Library "${library.id}" has no folders for placeholder creation`)
      return res.status(400).send('Library has no folders')
    }

    const authorDirectory = typeof seriesLibraryItem?.authorNamesFirstLast === 'string' ? seriesLibraryItem.authorNamesFirstLast.trim() : ''
    const outputDirectoryParts = [authorDirectory, series.name, placeholderTitle]
    const cleanedOutputDirectoryParts = outputDirectoryParts.filter(Boolean).map((part) => sanitizeFilename(part))
    const outputDirectory = filePathToPOSIX(Path.join(...[libraryFolder.path, ...cleanedOutputDirectoryParts]))

    const existingLibraryItemCount = await Database.libraryItemModel.count({
      where: {
        path: outputDirectory
      }
    })
    if (existingLibraryItemCount) {
      return res.status(400).send('Library item already exists at that path')
    }

    try {
      await fs.ensureDir(outputDirectory)
    } catch (error) {
      Logger.error(`[SeriesController] Failed to create placeholder directory "${outputDirectory}"`, error)
      return res.status(500).send('Failed to create placeholder directory')
    }

    const libraryItemFolderStats = {
      ino: null,
      mtimeMs: 0,
      ctimeMs: 0,
      birthtimeMs: 0
    }

    let relPath = outputDirectory.replace(filePathToPOSIX(libraryFolder.path), '')
    if (relPath.startsWith('/')) relPath = relPath.slice(1)

    const bookPayload = {
      title: placeholderTitle,
      titleIgnorePrefix: getTitleIgnorePrefix(placeholderTitle),
      subtitle: null,
      publishedYear: null,
      publishedDate: null,
      publisher: null,
      description: null,
      isbn: null,
      asin: null,
      language: null,
      explicit: false,
      abridged: false,
      coverPath: null,
      duration: 0,
      narrators: [],
      audioFiles: [],
      ebookFile: null,
      chapters: [],
      tags: [],
      genres: []
    }

    let newLibraryItem = null
    const transaction = await Database.sequelize.transaction()
    try {
      const book = await Database.bookModel.create(bookPayload, { transaction })

      await Database.bookSeriesModel.create(
        {
          bookId: book.id,
          seriesId: series.id,
          sequence: placeholderSequence
        },
        { transaction }
      )

      newLibraryItem = await Database.libraryItemModel.create(
        {
          ino: libraryItemFolderStats.ino,
          path: outputDirectory,
          relPath,
          mediaId: book.id,
          mediaType: 'book',
          isFile: false,
          isMissing: false,
          isInvalid: false,
          isPlaceholder: true,
          mtime: libraryItemFolderStats.mtimeMs || 0,
          ctime: libraryItemFolderStats.ctimeMs || 0,
          birthtime: libraryItemFolderStats.birthtimeMs || 0,
          size: 0,
          libraryFiles: [],
          extraData: {},
          libraryId: library.id,
          libraryFolderId: libraryFolder.id,
          title: placeholderTitle,
          titleIgnorePrefix: getTitleIgnorePrefix(placeholderTitle),
          authorNamesFirstLast: '',
          authorNamesLastFirst: ''
        },
        { transaction }
      )

      await transaction.commit()
    } catch (error) {
      Logger.error(`[SeriesController] Failed to create series placeholder`, error)
      await transaction.rollback()
      return res.status(500).send('Failed to create placeholder')
    }

    newLibraryItem.media = await newLibraryItem.getMediaExpanded()
    SocketAuthority.libraryItemEmitter('item_added', newLibraryItem)

    res.json(newLibraryItem.toOldJSONExpanded())
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    const series = await Database.seriesModel.findByPk(req.params.id)
    if (!series) return res.sendStatus(404)

    /**
     * Filter out any library items not accessible to user
     */
    const libraryItems = await libraryItemsBookFilters.getLibraryItemsForSeries(series, req.user)
    if (!libraryItems.length) {
      Logger.warn(`[SeriesController] User "${req.user.username}" attempted to access series "${series.id}" with no accessible books`)
      return res.sendStatus(404)
    }

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[SeriesController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn(`[SeriesController] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    req.series = series
    req.libraryItemsInSeries = libraryItems
    next()
  }
}
module.exports = new SeriesController()
