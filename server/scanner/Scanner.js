const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const { getTitleIgnorePrefix } = require('../utils/index')

// Utils
const { findMatchingEpisodesInFeed, getPodcastFeed } = require('../utils/podcastUtils')

const BookFinder = require('../finders/BookFinder')
const PodcastFinder = require('../finders/PodcastFinder')
const LibraryScan = require('./LibraryScan')
const LibraryScanner = require('./LibraryScanner')
const CoverManager = require('../managers/CoverManager')
const TaskManager = require('../managers/TaskManager')

/**
 * @typedef QuickMatchOptions
 * @property {string} [provider]
 * @property {string} [title]
 * @property {string} [author]
 * @property {string} [isbn] - This override is currently unused in Abs clients
 * @property {string} [asin] - This override is currently unused in Abs clients
 * @property {boolean} [overrideCover]
 * @property {boolean} [overrideDetails]
 */

class Scanner {
  constructor() {}

  /**
   *
   * @param {import('../routers/ApiRouter')} apiRouterCtx
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {QuickMatchOptions} options
   * @returns {Promise<{updated: boolean, libraryItem: Object}>}
   */
  async quickMatchLibraryItem(apiRouterCtx, libraryItem, options = {}) {
    const provider = options.provider || 'google'
    const searchTitle = options.title || libraryItem.media.title
    const searchAuthor = options.author || libraryItem.media.authorName

    // If overrideCover and overrideDetails is not sent in options than use the server setting to determine if we should override
    if (options.overrideCover === undefined && options.overrideDetails === undefined && Database.serverSettings.scannerPreferMatchedMetadata) {
      options.overrideCover = true
      options.overrideDetails = true
    }

    let updatePayload = {}
    let hasUpdated = false

    if (libraryItem.isBook) {
      const searchISBN = options.isbn || libraryItem.media.isbn
      const searchASIN = options.asin || libraryItem.media.asin

      const results = await BookFinder.search(libraryItem, provider, searchTitle, searchAuthor, searchISBN, searchASIN, { maxFuzzySearches: 2 })
      if (!results.length) {
        return {
          warning: `No ${provider} match found`
        }
      }
      const matchData = results[0]

      // Update cover if not set OR overrideCover flag
      if (matchData.cover && (!libraryItem.media.coverPath || options.overrideCover)) {
        Logger.debug(`[Scanner] Updating cover "${matchData.cover}"`)
        const coverResult = await CoverManager.downloadCoverFromUrlNew(matchData.cover, libraryItem.id, libraryItem.isFile ? null : libraryItem.path)
        if (coverResult.error) {
          Logger.warn(`[Scanner] Match cover "${matchData.cover}" failed to use: ${coverResult.error}`)
        } else {
          libraryItem.media.coverPath = coverResult.cover
          libraryItem.media.changed('coverPath', true) // Cover path may be the same but this forces the update
          hasUpdated = true
        }
      }

      const bookBuildUpdateData = await this.quickMatchBookBuildUpdatePayload(apiRouterCtx, libraryItem, matchData, options)
      updatePayload = bookBuildUpdateData.updatePayload
      if (bookBuildUpdateData.hasSeriesUpdates || bookBuildUpdateData.hasAuthorUpdates) {
        hasUpdated = true
      }
    } else if (libraryItem.isPodcast) {
      // Podcast quick match
      const results = await PodcastFinder.search(searchTitle)
      if (!results.length) {
        return {
          warning: `No ${provider} match found`
        }
      }
      const matchData = results[0]

      // Update cover if not set OR overrideCover flag
      if (matchData.cover && (!libraryItem.media.coverPath || options.overrideCover)) {
        Logger.debug(`[Scanner] Updating cover "${matchData.cover}"`)
        const coverResult = await CoverManager.downloadCoverFromUrlNew(matchData.cover, libraryItem.id, libraryItem.path)
        if (coverResult.error) {
          Logger.warn(`[Scanner] Match cover "${matchData.cover}" failed to use: ${coverResult.error}`)
        } else {
          libraryItem.media.coverPath = coverResult.cover
          libraryItem.media.changed('coverPath', true) // Cover path may be the same but this forces the update
          hasUpdated = true
        }
      }

      updatePayload = this.quickMatchPodcastBuildUpdatePayload(libraryItem, matchData, options)
    }

    if (Object.keys(updatePayload).length) {
      Logger.debug('[Scanner] Updating details with payload', updatePayload)
      libraryItem.media.set(updatePayload)
      if (libraryItem.media.changed()) {
        Logger.debug(`[Scanner] Updating library item "${libraryItem.media.title}" keys`, libraryItem.media.changed())
        hasUpdated = true
      }
    }

    if (hasUpdated) {
      if (libraryItem.isPodcast && libraryItem.media.feedURL) {
        // Quick match all unmatched podcast episodes
        await this.quickMatchPodcastEpisodes(libraryItem, options)
      }

      await libraryItem.media.save()

      libraryItem.changed('updatedAt', true)
      await libraryItem.save()

      await libraryItem.saveMetadataFile()

      SocketAuthority.libraryItemEmitter('item_updated', libraryItem)
    }

    return {
      updated: hasUpdated,
      libraryItem: libraryItem.toOldJSONExpanded()
    }
  }

  /**
   *
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {*} matchData
   * @param {QuickMatchOptions} options
   * @returns {Map<string, any>} - Update payload
   */
  quickMatchPodcastBuildUpdatePayload(libraryItem, matchData, options) {
    const updatePayload = {}

    const matchDataTransformed = {
      title: matchData.title || null,
      author: matchData.artistName || null,
      genres: matchData.genres || [],
      itunesId: matchData.id || null,
      itunesPageUrl: matchData.pageUrl || null,
      itunesArtistId: matchData.artistId || null,
      releaseDate: matchData.releaseDate || null,
      imageUrl: matchData.cover || null,
      feedUrl: matchData.feedUrl || null,
      description: matchData.descriptionPlain || null
    }

    for (const key in matchDataTransformed) {
      if (matchDataTransformed[key]) {
        if (key === 'genres') {
          if (!libraryItem.media.genres.length || options.overrideDetails) {
            var genresArray = []
            if (Array.isArray(matchDataTransformed[key])) genresArray = [...matchDataTransformed[key]]
            else {
              // Genres should always be passed in as an array but just incase handle a string
              Logger.warn(`[Scanner] quickMatch genres is not an array ${matchDataTransformed[key]}`)
              genresArray = matchDataTransformed[key]
                .split(',')
                .map((v) => v.trim())
                .filter((v) => !!v)
            }
            updatePayload[key] = genresArray
          }
        } else if (libraryItem.media[key] !== matchDataTransformed[key] && (!libraryItem.media[key] || options.overrideDetails)) {
          updatePayload[key] = matchDataTransformed[key]
        }
      }
    }

    return updatePayload
  }

  /**
   *
   * @param {import('../routers/ApiRouter')} apiRouterCtx
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {*} matchData
   * @param {QuickMatchOptions} options
   * @returns {Promise<{updatePayload: Map<string, any>, seriesIdsRemoved: string[], hasSeriesUpdates: boolean, authorIdsRemoved: string[], hasAuthorUpdates: boolean}>}
   */
  async quickMatchBookBuildUpdatePayload(apiRouterCtx, libraryItem, matchData, options) {
    // Update media metadata if not set OR overrideDetails flag
    const detailKeysToUpdate = ['title', 'subtitle', 'description', 'narrator', 'publisher', 'publishedYear', 'genres', 'tags', 'language', 'explicit', 'abridged', 'asin', 'isbn']
    const updatePayload = {}

    for (const key in matchData) {
      if (matchData[key] && detailKeysToUpdate.includes(key)) {
        if (key === 'narrator') {
          if (!libraryItem.media.narrators?.length || options.overrideDetails) {
            updatePayload.narrators = matchData[key]
              .split(',')
              .map((v) => v.trim())
              .filter((v) => !!v)
          }
        } else if (key === 'genres') {
          if (!libraryItem.media.genres.length || options.overrideDetails) {
            let genresArray = []
            if (Array.isArray(matchData[key])) genresArray = [...matchData[key]]
            else {
              // Genres should always be passed in as an array but just incase handle a string
              Logger.warn(`[Scanner] quickMatch genres is not an array ${matchData[key]}`)
              genresArray = matchData[key]
                .split(',')
                .map((v) => v.trim())
                .filter((v) => !!v)
            }
            updatePayload[key] = genresArray
          }
        } else if (key === 'tags') {
          if (!libraryItem.media.tags.length || options.overrideDetails) {
            let tagsArray = []
            if (Array.isArray(matchData[key])) tagsArray = [...matchData[key]]
            else
              tagsArray = matchData[key]
                .split(',')
                .map((v) => v.trim())
                .filter((v) => !!v)
            updatePayload[key] = tagsArray
          }
        } else if (!libraryItem.media[key] || options.overrideDetails) {
          updatePayload[key] = matchData[key]
        }
      }
    }

    // Add or set author if not set
    let hasAuthorUpdates = false
    if (matchData.author && (!libraryItem.media.authorName || options.overrideDetails)) {
      if (!Array.isArray(matchData.author)) {
        matchData.author = matchData.author
          .split(',')
          .map((au) => au.trim())
          .filter((au) => !!au)
      }
      const authorIdsRemoved = []
      for (const authorName of matchData.author) {
        const existingAuthor = libraryItem.media.authors.find((a) => a.name.toLowerCase() === authorName.toLowerCase())
        if (!existingAuthor) {
          let author = await Database.authorModel.getByNameAndLibrary(authorName, libraryItem.libraryId)
          if (!author) {
            author = await Database.authorModel.create({
              name: authorName,
              lastFirst: Database.authorModel.getLastFirst(authorName),
              libraryId: libraryItem.libraryId
            })
            SocketAuthority.emitter('author_added', author.toOldJSON())
            // Update filter data
            Database.addAuthorToFilterData(libraryItem.libraryId, author.name, author.id)

            await Database.bookAuthorModel
              .create({
                authorId: author.id,
                bookId: libraryItem.media.id
              })
              .then(() => {
                Logger.info(`[Scanner] quickMatchBookBuildUpdatePayload: Added author "${author.name}" to "${libraryItem.media.title}"`)
                libraryItem.media.authors.push(author)
                hasAuthorUpdates = true
              })
          }
        }
        const authorsRemoved = libraryItem.media.authors.filter((a) => !matchData.author.find((ma) => ma.toLowerCase() === a.name.toLowerCase()))
        if (authorsRemoved.length) {
          for (const author of authorsRemoved) {
            await Database.bookAuthorModel.destroy({ where: { authorId: author.id, bookId: libraryItem.media.id } })
            libraryItem.media.authors = libraryItem.media.authors.filter((a) => a.id !== author.id)
            authorIdsRemoved.push(author.id)
            Logger.info(`[Scanner] quickMatchBookBuildUpdatePayload: Removed author "${author.name}" from "${libraryItem.media.title}"`)
          }
          hasAuthorUpdates = true
        }
      }

      // For all authors removed from book, check if they are empty now and should be removed
      if (authorIdsRemoved.length) {
        await apiRouterCtx.checkRemoveAuthorsWithNoBooks(authorIdsRemoved)
      }
    }

    // Add or set series if not set
    let hasSeriesUpdates = false
    if (matchData.series && (!libraryItem.media.seriesName || options.overrideDetails)) {
      if (!Array.isArray(matchData.series)) matchData.series = [{ series: matchData.series, sequence: matchData.sequence }]
      const seriesIdsRemoved = []
      for (const seriesMatchItem of matchData.series) {
        const existingSeries = libraryItem.media.series.find((s) => s.name.toLowerCase() === seriesMatchItem.series.toLowerCase())
        if (existingSeries) {
          if (existingSeries.bookSeries.sequence !== seriesMatchItem.sequence) {
            existingSeries.bookSeries.sequence = seriesMatchItem.sequence
            await existingSeries.bookSeries.save()
            Logger.info(`[Scanner] quickMatchBookBuildUpdatePayload: Updated series sequence for "${existingSeries.name}" to ${seriesMatchItem.sequence} in "${libraryItem.media.title}"`)
            hasSeriesUpdates = true
          }
        } else {
          let seriesItem = await Database.seriesModel.getByNameAndLibrary(seriesMatchItem.series, libraryItem.libraryId)
          if (!seriesItem) {
            seriesItem = await Database.seriesModel.create({
              name: seriesMatchItem.series,
              nameIgnorePrefix: getTitleIgnorePrefix(seriesMatchItem.series),
              libraryId: libraryItem.libraryId
            })
            // Update filter data
            Database.addSeriesToFilterData(libraryItem.libraryId, seriesItem.name, seriesItem.id)
            SocketAuthority.emitter('series_added', seriesItem.toOldJSON())
          }
          const bookSeries = await Database.bookSeriesModel.create({
            seriesId: seriesItem.id,
            bookId: libraryItem.media.id,
            sequence: seriesMatchItem.sequence
          })
          seriesItem.bookSeries = bookSeries
          libraryItem.media.series.push(seriesItem)
          Logger.info(`[Scanner] quickMatchBookBuildUpdatePayload: Added series "${seriesItem.name}" to "${libraryItem.media.title}"`)
          hasSeriesUpdates = true
        }
        const seriesRemoved = libraryItem.media.series.filter((s) => !matchData.series.find((ms) => ms.series.toLowerCase() === s.name.toLowerCase()))
        if (seriesRemoved.length) {
          for (const series of seriesRemoved) {
            await series.bookSeries.destroy()
            libraryItem.media.series = libraryItem.media.series.filter((s) => s.id !== series.id)
            seriesIdsRemoved.push(series.id)
            Logger.info(`[Scanner] quickMatchBookBuildUpdatePayload: Removed series "${series.name}" from "${libraryItem.media.title}"`)
          }
          hasSeriesUpdates = true
        }
      }

      // For all series removed from book, check if it is empty now and should be removed
      if (seriesIdsRemoved.length) {
        await apiRouterCtx.checkRemoveEmptySeries(seriesIdsRemoved)
      }
    }

    return {
      updatePayload,
      hasSeriesUpdates,
      hasAuthorUpdates
    }
  }

  /**
   *
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {QuickMatchOptions} options
   * @returns {Promise<number>} - Number of episodes updated
   */
  async quickMatchPodcastEpisodes(libraryItem, options = {}) {
    /** @type {import('../models/PodcastEpisode')[]} */
    const episodesToQuickMatch = libraryItem.media.podcastEpisodes.filter((ep) => !ep.enclosureURL) // Only quick match episodes that are not already matched
    if (!episodesToQuickMatch.length) return 0

    const feed = await getPodcastFeed(libraryItem.media.feedURL)
    if (!feed) {
      Logger.error(`[Scanner] quickMatchPodcastEpisodes: Unable to quick match episodes feed not found for "${libraryItem.media.feedURL}"`)
      return 0
    }

    let numEpisodesUpdated = 0
    for (const episode of episodesToQuickMatch) {
      const episodeMatches = findMatchingEpisodesInFeed(feed, episode.title, 0.1)
      if (episodeMatches?.length) {
        const wasUpdated = await this.updateEpisodeWithMatch(episode, episodeMatches[0].episode, options)
        if (wasUpdated) numEpisodesUpdated++
      }
    }
    if (numEpisodesUpdated) {
      Logger.info(`[Scanner] quickMatchPodcastEpisodes: Updated ${numEpisodesUpdated} episodes for "${libraryItem.media.title}"`)
    }
    return numEpisodesUpdated
  }

  /**
   *
   * @param {import('../models/PodcastEpisode')} episode
   * @param {import('../utils/podcastUtils').RssPodcastEpisode} episodeToMatch
   * @param {QuickMatchOptions} options
   * @returns {Promise<boolean>} - true if episode was updated
   */
  async updateEpisodeWithMatch(episode, episodeToMatch, options = {}) {
    Logger.debug(`[Scanner] quickMatchPodcastEpisodes: Found episode match for "${episode.title}" => ${episodeToMatch.title}`)
    const matchDataTransformed = {
      title: episodeToMatch.title || '',
      subtitle: episodeToMatch.subtitle || '',
      description: episodeToMatch.description || '',
      enclosureURL: episodeToMatch.enclosure?.url || null,
      enclosureSize: episodeToMatch.enclosure?.length || null,
      enclosureType: episodeToMatch.enclosure?.type || null,
      episode: episodeToMatch.episode || '',
      episodeType: episodeToMatch.episodeType || 'full',
      season: episodeToMatch.season || '',
      pubDate: episodeToMatch.pubDate || '',
      publishedAt: episodeToMatch.publishedAt
    }
    const updatePayload = {}
    for (const key in matchDataTransformed) {
      if (matchDataTransformed[key]) {
        if (episode[key] !== matchDataTransformed[key] && (!episode[key] || options.overrideDetails)) {
          updatePayload[key] = matchDataTransformed[key]
        }
      }
    }

    if (Object.keys(updatePayload).length) {
      episode.set(updatePayload)
      if (episode.changed()) {
        Logger.debug(`[Scanner] quickMatchPodcastEpisodes: Updating episode "${episode.title}" keys`, episode.changed())
        await episode.save()
        return true
      }
    }
    return false
  }

  /**
   * Quick match library items
   *
   * @param {import('../routers/ApiRouter')} apiRouterCtx
   * @param {import('../models/Library')} library
   * @param {import('../models/LibraryItem')[]} libraryItems
   * @param {LibraryScan} libraryScan
   * @returns {Promise<boolean>} false if scan canceled
   */
  async matchLibraryItemsChunk(apiRouterCtx, library, libraryItems, libraryScan) {
    for (let i = 0; i < libraryItems.length; i++) {
      const libraryItem = libraryItems[i]

      if (libraryItem.media.asin && library.settings.skipMatchingMediaWithAsin) {
        Logger.debug(`[Scanner] matchLibraryItems: Skipping "${libraryItem.media.title}" because it already has an ASIN (${i + 1} of ${libraryItems.length})`)
        continue
      }

      if (libraryItem.media.isbn && library.settings.skipMatchingMediaWithIsbn) {
        Logger.debug(`[Scanner] matchLibraryItems: Skipping "${libraryItem.media.title}" because it already has an ISBN (${i + 1} of ${libraryItems.length})`)
        continue
      }

      Logger.debug(`[Scanner] matchLibraryItems: Quick matching "${libraryItem.media.title}" (${i + 1} of ${libraryItems.length})`)
      const result = await this.quickMatchLibraryItem(apiRouterCtx, libraryItem, { provider: library.provider })
      if (result.warning) {
        Logger.warn(`[Scanner] matchLibraryItems: Match warning ${result.warning} for library item "${libraryItem.media.title}"`)
      } else if (result.updated) {
        libraryScan.resultsUpdated++
      }

      if (LibraryScanner.cancelLibraryScan[libraryScan.libraryId]) {
        Logger.info(`[Scanner] matchLibraryItems: Library match scan canceled for "${libraryScan.libraryName}"`)
        return false
      }
    }

    return true
  }

  /**
   * Quick match all library items for library
   *
   * @param {import('../routers/ApiRouter')} apiRouterCtx
   * @param {import('../models/Library')} library
   */
  async matchLibraryItems(apiRouterCtx, library) {
    if (library.mediaType === 'podcast') {
      Logger.error(`[Scanner] matchLibraryItems: Match all not supported for podcasts yet`)
      return
    }

    if (LibraryScanner.isLibraryScanning(library.id)) {
      Logger.error(`[Scanner] Library "${library.name}" is already scanning`)
      return
    }

    const limit = 100
    let offset = 0

    const libraryScan = new LibraryScan()
    libraryScan.setData(library, 'match')
    LibraryScanner.librariesScanning.push(libraryScan.libraryId)
    const taskData = {
      libraryId: library.id
    }
    const taskTitleString = {
      text: `Matching books in "${library.name}"`,
      key: 'MessageTaskMatchingBooksInLibrary',
      subs: [library.name]
    }
    const task = TaskManager.createAndAddTask('library-match-all', taskTitleString, null, true, taskData)
    Logger.info(`[Scanner] matchLibraryItems: Starting library match scan ${libraryScan.id} for ${libraryScan.libraryName}`)

    let hasMoreChunks = true
    let isCanceled = false
    while (hasMoreChunks) {
      const libraryItems = await Database.libraryItemModel.getLibraryItemsIncrement(offset, limit, { libraryId: library.id })
      if (!libraryItems.length) {
        break
      }

      offset += limit
      hasMoreChunks = libraryItems.length === limit

      const shouldContinue = await this.matchLibraryItemsChunk(apiRouterCtx, library, libraryItems, libraryScan)
      if (!shouldContinue) {
        isCanceled = true
        break
      }
    }

    if (offset === 0) {
      Logger.error(`[Scanner] matchLibraryItems: Library has no items ${library.id}`)
      libraryScan.setComplete()
      const taskFailedString = {
        text: 'No items found',
        key: 'MessageNoItemsFound'
      }
      task.setFailed(taskFailedString)
    } else {
      libraryScan.setComplete()

      task.data.scanResults = libraryScan.scanResults
      if (isCanceled) {
        const taskFinishedString = {
          text: 'Task canceled by user',
          key: 'MessageTaskCanceledByUser'
        }
        task.setFinished(taskFinishedString)
      } else {
        task.setFinished(null, true)
      }
    }

    delete LibraryScanner.cancelLibraryScan[libraryScan.libraryId]
    LibraryScanner.librariesScanning = LibraryScanner.librariesScanning.filter((lid) => lid !== library.id)
    TaskManager.taskFinished(task)
  }
}
module.exports = new Scanner()
