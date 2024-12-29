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
   * @param {import('../objects/LibraryItem')} libraryItem
   * @param {QuickMatchOptions} options
   * @returns {Promise<{updated: boolean, libraryItem: import('../objects/LibraryItem')}>}
   */
  async quickMatchLibraryItem(apiRouterCtx, libraryItem, options = {}) {
    const provider = options.provider || 'google'
    const searchTitle = options.title || libraryItem.media.metadata.title
    const searchAuthor = options.author || libraryItem.media.metadata.authorName

    // If overrideCover and overrideDetails is not sent in options than use the server setting to determine if we should override
    if (options.overrideCover === undefined && options.overrideDetails === undefined && Database.serverSettings.scannerPreferMatchedMetadata) {
      options.overrideCover = true
      options.overrideDetails = true
    }

    let updatePayload = {}
    let hasUpdated = false

    let existingAuthors = [] // Used for checking if authors or series are now empty
    let existingSeries = []

    if (libraryItem.isBook) {
      existingAuthors = libraryItem.media.metadata.authors.map((a) => a.id)
      existingSeries = libraryItem.media.metadata.series.map((s) => s.id)

      const searchISBN = options.isbn || libraryItem.media.metadata.isbn
      const searchASIN = options.asin || libraryItem.media.metadata.asin

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
        var coverResult = await CoverManager.downloadCoverFromUrl(libraryItem, matchData.cover)
        if (!coverResult || coverResult.error || !coverResult.cover) {
          Logger.warn(`[Scanner] Match cover "${matchData.cover}" failed to use: ${coverResult ? coverResult.error : 'Unknown Error'}`)
        } else {
          hasUpdated = true
        }
      }

      updatePayload = await this.quickMatchBookBuildUpdatePayload(libraryItem, matchData, options)
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
        var coverResult = await CoverManager.downloadCoverFromUrl(libraryItem, matchData.cover)
        if (!coverResult || coverResult.error || !coverResult.cover) {
          Logger.warn(`[Scanner] Match cover "${matchData.cover}" failed to use: ${coverResult ? coverResult.error : 'Unknown Error'}`)
        } else {
          hasUpdated = true
        }
      }

      updatePayload = this.quickMatchPodcastBuildUpdatePayload(libraryItem, matchData, options)
    }

    if (Object.keys(updatePayload).length) {
      Logger.debug('[Scanner] Updating details', updatePayload)
      if (libraryItem.media.update(updatePayload)) {
        hasUpdated = true
      }
    }

    if (hasUpdated) {
      if (libraryItem.isPodcast && libraryItem.media.metadata.feedUrl) {
        // Quick match all unmatched podcast episodes
        await this.quickMatchPodcastEpisodes(libraryItem, options)
      }

      await Database.updateLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())

      // Check if any authors or series are now empty and should be removed
      if (libraryItem.isBook) {
        const authorsRemoved = existingAuthors.filter((aid) => !libraryItem.media.metadata.authors.find((au) => au.id === aid))
        const seriesRemoved = existingSeries.filter((sid) => !libraryItem.media.metadata.series.find((se) => se.id === sid))

        if (authorsRemoved.length) {
          await apiRouterCtx.checkRemoveAuthorsWithNoBooks(authorsRemoved)
        }
        if (seriesRemoved.length) {
          await apiRouterCtx.checkRemoveEmptySeries(seriesRemoved)
        }
      }
    }

    return {
      updated: hasUpdated,
      libraryItem: libraryItem.toJSONExpanded()
    }
  }

  quickMatchPodcastBuildUpdatePayload(libraryItem, matchData, options) {
    const updatePayload = {}
    updatePayload.metadata = {}

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
          if (!libraryItem.media.metadata.genres.length || options.overrideDetails) {
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
            updatePayload.metadata[key] = genresArray
          }
        } else if (libraryItem.media.metadata[key] !== matchDataTransformed[key] && (!libraryItem.media.metadata[key] || options.overrideDetails)) {
          updatePayload.metadata[key] = matchDataTransformed[key]
        }
      }
    }

    if (!Object.keys(updatePayload.metadata).length) {
      delete updatePayload.metadata
    }

    return updatePayload
  }

  /**
   *
   * @param {import('../objects/LibraryItem')} libraryItem
   * @param {*} matchData
   * @param {QuickMatchOptions} options
   * @returns
   */
  async quickMatchBookBuildUpdatePayload(libraryItem, matchData, options) {
    // Update media metadata if not set OR overrideDetails flag
    const detailKeysToUpdate = ['title', 'subtitle', 'description', 'narrator', 'publisher', 'publishedYear', 'genres', 'tags', 'language', 'explicit', 'abridged', 'asin', 'isbn']
    const updatePayload = {}
    updatePayload.metadata = {}

    for (const key in matchData) {
      if (matchData[key] && detailKeysToUpdate.includes(key)) {
        if (key === 'narrator') {
          if (!libraryItem.media.metadata.narratorName || options.overrideDetails) {
            updatePayload.metadata.narrators = matchData[key]
              .split(',')
              .map((v) => v.trim())
              .filter((v) => !!v)
          }
        } else if (key === 'genres') {
          if (!libraryItem.media.metadata.genres.length || options.overrideDetails) {
            var genresArray = []
            if (Array.isArray(matchData[key])) genresArray = [...matchData[key]]
            else {
              // Genres should always be passed in as an array but just incase handle a string
              Logger.warn(`[Scanner] quickMatch genres is not an array ${matchData[key]}`)
              genresArray = matchData[key]
                .split(',')
                .map((v) => v.trim())
                .filter((v) => !!v)
            }
            updatePayload.metadata[key] = genresArray
          }
        } else if (key === 'tags') {
          if (!libraryItem.media.tags.length || options.overrideDetails) {
            var tagsArray = []
            if (Array.isArray(matchData[key])) tagsArray = [...matchData[key]]
            else
              tagsArray = matchData[key]
                .split(',')
                .map((v) => v.trim())
                .filter((v) => !!v)
            updatePayload[key] = tagsArray
          }
        } else if (!libraryItem.media.metadata[key] || options.overrideDetails) {
          updatePayload.metadata[key] = matchData[key]
        }
      }
    }

    // Add or set author if not set
    if (matchData.author && (!libraryItem.media.metadata.authorName || options.overrideDetails)) {
      if (!Array.isArray(matchData.author)) {
        matchData.author = matchData.author
          .split(',')
          .map((au) => au.trim())
          .filter((au) => !!au)
      }
      const authorPayload = []
      for (const authorName of matchData.author) {
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
        }
        authorPayload.push(author.toJSONMinimal())
      }
      updatePayload.metadata.authors = authorPayload
    }

    // Add or set series if not set
    if (matchData.series && (!libraryItem.media.metadata.seriesName || options.overrideDetails)) {
      if (!Array.isArray(matchData.series)) matchData.series = [{ series: matchData.series, sequence: matchData.sequence }]
      const seriesPayload = []
      for (const seriesMatchItem of matchData.series) {
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
        seriesPayload.push(seriesItem.toJSONMinimal(seriesMatchItem.sequence))
      }
      updatePayload.metadata.series = seriesPayload
    }

    if (!Object.keys(updatePayload.metadata).length) {
      delete updatePayload.metadata
    }

    return updatePayload
  }

  async quickMatchPodcastEpisodes(libraryItem, options = {}) {
    const episodesToQuickMatch = libraryItem.media.episodes.filter((ep) => !ep.enclosureUrl) // Only quick match episodes without enclosure
    if (!episodesToQuickMatch.length) return false

    const feed = await getPodcastFeed(libraryItem.media.metadata.feedUrl)
    if (!feed) {
      Logger.error(`[Scanner] quickMatchPodcastEpisodes: Unable to quick match episodes feed not found for "${libraryItem.media.metadata.feedUrl}"`)
      return false
    }

    let numEpisodesUpdated = 0
    for (const episode of episodesToQuickMatch) {
      const episodeMatches = findMatchingEpisodesInFeed(feed, episode.title)
      if (episodeMatches && episodeMatches.length) {
        const wasUpdated = this.updateEpisodeWithMatch(libraryItem, episode, episodeMatches[0].episode, options)
        if (wasUpdated) numEpisodesUpdated++
      }
    }
    return numEpisodesUpdated
  }

  updateEpisodeWithMatch(libraryItem, episode, episodeToMatch, options = {}) {
    Logger.debug(`[Scanner] quickMatchPodcastEpisodes: Found episode match for "${episode.title}" => ${episodeToMatch.title}`)
    const matchDataTransformed = {
      title: episodeToMatch.title || '',
      subtitle: episodeToMatch.subtitle || '',
      description: episodeToMatch.description || '',
      enclosure: episodeToMatch.enclosure || null,
      episode: episodeToMatch.episode || '',
      episodeType: episodeToMatch.episodeType || 'full',
      season: episodeToMatch.season || '',
      pubDate: episodeToMatch.pubDate || '',
      publishedAt: episodeToMatch.publishedAt
    }
    const updatePayload = {}
    for (const key in matchDataTransformed) {
      if (matchDataTransformed[key]) {
        if (key === 'enclosure') {
          if (!episode.enclosure || JSON.stringify(episode.enclosure) !== JSON.stringify(matchDataTransformed.enclosure)) {
            updatePayload[key] = {
              ...matchDataTransformed.enclosure
            }
          }
        } else if (episode[key] !== matchDataTransformed[key] && (!episode[key] || options.overrideDetails)) {
          updatePayload[key] = matchDataTransformed[key]
        }
      }
    }

    if (Object.keys(updatePayload).length) {
      return libraryItem.media.updateEpisode(episode.id, updatePayload)
    }
    return false
  }

  /**
   * Quick match library items
   *
   * @param {import('../routers/ApiRouter')} apiRouterCtx
   * @param {import('../models/Library')} library
   * @param {import('../objects/LibraryItem')[]} libraryItems
   * @param {LibraryScan} libraryScan
   * @returns {Promise<boolean>} false if scan canceled
   */
  async matchLibraryItemsChunk(apiRouterCtx, library, libraryItems, libraryScan) {
    for (let i = 0; i < libraryItems.length; i++) {
      const libraryItem = libraryItems[i]

      if (libraryItem.media.metadata.asin && library.settings.skipMatchingMediaWithAsin) {
        Logger.debug(`[Scanner] matchLibraryItems: Skipping "${libraryItem.media.metadata.title}" because it already has an ASIN (${i + 1} of ${libraryItems.length})`)
        continue
      }

      if (libraryItem.media.metadata.isbn && library.settings.skipMatchingMediaWithIsbn) {
        Logger.debug(`[Scanner] matchLibraryItems: Skipping "${libraryItem.media.metadata.title}" because it already has an ISBN (${i + 1} of ${libraryItems.length})`)
        continue
      }

      Logger.debug(`[Scanner] matchLibraryItems: Quick matching "${libraryItem.media.metadata.title}" (${i + 1} of ${libraryItems.length})`)
      const result = await this.quickMatchLibraryItem(apiRouterCtx, libraryItem, { provider: library.provider })
      if (result.warning) {
        Logger.warn(`[Scanner] matchLibraryItems: Match warning ${result.warning} for library item "${libraryItem.media.metadata.title}"`)
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
      let oldLibraryItems = libraryItems.map((li) => Database.libraryItemModel.getOldLibraryItem(li))

      const shouldContinue = await this.matchLibraryItemsChunk(apiRouterCtx, library, oldLibraryItems, libraryScan)
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
