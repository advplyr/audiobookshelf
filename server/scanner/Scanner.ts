import Logger from '../Logger'
import SocketAuthority from '../SocketAuthority'
import Database from '../Database'
import { getTitleIgnorePrefix } from '../utils'

import { findMatchingEpisodesInFeed, getPodcastFeed } from '../utils/podcastUtils'
import type { RssPodcastEpisode } from '../utils/podcastUtils'

import BookFinder from '../finders/BookFinder'
import PodcastFinder from '../finders/PodcastFinder'
import LibraryScan from './LibraryScan'
import LibraryScanner from './LibraryScanner'
import CoverManager from '../managers/CoverManager'
import TaskManager from '../managers/TaskManager'
import type Book from '../models/Book'
import type Library from '../models/Library'
import type LibraryItem from '../models/LibraryItem'
import type Podcast from '../models/Podcast'
import type PodcastEpisode from '../models/PodcastEpisode'

type QuickMatchOptions = {
  provider?: string | null
  title?: string
  author?: string
  isbn?: string
  asin?: string
  overrideCover?: boolean
  overrideDetails?: boolean
}
type MatchRouter = {
  checkRemoveAuthorsWithNoBooks(authorIds: string[]): Promise<void>
  checkRemoveEmptySeries(seriesIds: string[]): Promise<void>
}
type BookItem = LibraryItem & { media: Book.BookExpanded }
type PodcastItem = LibraryItem & { media: Podcast.PodcastExpanded }
type QuickMatchResult = { warning: string; updated?: never } | {
  updated: boolean
  libraryItem: ReturnType<LibraryItem['toOldJSONExpanded']>
  warning?: never
}
type BookFinderResult = NonNullable<Awaited<ReturnType<typeof BookFinder.search>>[number]>
type PodcastFinderResult = NonNullable<Awaited<ReturnType<typeof PodcastFinder.search>>>[number]
type BookMatchSeries = { series: string; sequence?: string | null }
// Some metadata sources still supply these fields as strings.
type BookMatchData = Omit<BookFinderResult, 'author' | 'series' | 'genres' | 'tags'> & {
  author?: string | string[] | null
  series?: string | BookMatchSeries[] | null
  sequence?: string | null
  genres?: string | string[] | null
  tags?: string | string[] | null
}
type PodcastMatchData = Omit<PodcastFinderResult, 'genres'> & { genres?: string | string[] | null }
type MatchPayload = Record<string, string | number | boolean | string[]>

class Scanner {
  constructor() {}

  async quickMatchLibraryItem(apiRouterCtx: MatchRouter, libraryItem: LibraryItem.LibraryItemExpanded, options: QuickMatchOptions = {}): Promise<QuickMatchResult> {
    const provider = options.provider || 'google'
    const searchTitle = options.title || libraryItem.media.title
    const searchAuthor = options.author || (libraryItem.media as Book.BookExpanded | (Podcast.PodcastExpanded & { authorName?: string })).authorName

    // If overrideCover and overrideDetails is not sent in options than use the server setting to determine if we should override
    if (options.overrideCover === undefined && options.overrideDetails === undefined && Database.serverSettings!.scannerPreferMatchedMetadata) {
      options.overrideCover = true
      options.overrideDetails = true
    }

    let updatePayload: MatchPayload = {}
    let hasUpdated = false

    if (libraryItem.isBook) {
      // isBook is derived from the same discriminator used to load media.
      const bookItem = libraryItem as BookItem
      const bookMedia: Book = bookItem.media
      const searchISBN = options.isbn || bookMedia.isbn
      const searchASIN = options.asin || bookMedia.asin

      const results = await BookFinder.search(bookItem, provider, searchTitle!, searchAuthor, searchISBN, searchASIN, { maxFuzzySearches: 2 })
      if (!results.length) {
        return {
          warning: `No ${provider} match found`
        }
      }
      const matchData = results[0]!

      // Update cover if not set OR overrideCover flag
      if (matchData.cover && (!bookMedia.coverPath || options.overrideCover)) {
        Logger.debug(`[Scanner] Updating cover "${matchData.cover}"`)
        const coverResult = await CoverManager.downloadCoverFromUrlNew(matchData.cover, libraryItem.id, libraryItem.isFile ? null : libraryItem.path)
        if (coverResult.error) {
          Logger.warn(`[Scanner] Match cover "${matchData.cover}" failed to use: ${coverResult.error}`)
        } else {
          bookMedia.coverPath = coverResult.cover!
          bookMedia.changed('coverPath', true) // Cover path may be the same but this forces the update
          hasUpdated = true
        }
      }

      const bookBuildUpdateData = await this.quickMatchBookBuildUpdatePayload(apiRouterCtx, bookItem, matchData, options)
      updatePayload = bookBuildUpdateData.updatePayload
      if (bookBuildUpdateData.hasSeriesUpdates || bookBuildUpdateData.hasAuthorUpdates) {
        hasUpdated = true
      }
    } else if (libraryItem.isPodcast) {
      // Podcast quick match
      const podcastItem = libraryItem as PodcastItem
      const podcastMedia: Podcast = podcastItem.media
      const results = (await PodcastFinder.search(searchTitle!))!
      if (!results.length) {
        return {
          warning: `No ${provider} match found`
        }
      }
      const matchData = results[0]

      // Update cover if not set OR overrideCover flag
      if (matchData.cover && (!podcastMedia.coverPath || options.overrideCover)) {
        Logger.debug(`[Scanner] Updating cover "${matchData.cover}"`)
        const coverResult = await CoverManager.downloadCoverFromUrlNew(matchData.cover, libraryItem.id, libraryItem.path)
        if (coverResult.error) {
          Logger.warn(`[Scanner] Match cover "${matchData.cover}" failed to use: ${coverResult.error}`)
        } else {
          podcastMedia.coverPath = coverResult.cover!
          podcastMedia.changed('coverPath', true) // Cover path may be the same but this forces the update
          hasUpdated = true
        }
      }

      updatePayload = this.quickMatchPodcastBuildUpdatePayload(podcastItem, matchData, options)
    }

    // Both media models support the object form of Sequelize's setter.
    const media: { set(values: MatchPayload): unknown; changed(): string[] | false; save(): Promise<unknown> } = libraryItem.media
    if (Object.keys(updatePayload).length) {
      Logger.debug('[Scanner] Updating details with payload', updatePayload)
      media.set(updatePayload)
      if (media.changed()) {
        Logger.debug(`[Scanner] Updating library item "${libraryItem.media.title}" keys`, media.changed())
        hasUpdated = true
      }
    }

    if (hasUpdated) {
      if (libraryItem.isPodcast) {
        const podcastItem = libraryItem as PodcastItem
        if (podcastItem.media.feedURL) {
          // Quick match all unmatched podcast episodes
          await this.quickMatchPodcastEpisodes(podcastItem, options)
        }
      }

      await media.save()

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

  quickMatchPodcastBuildUpdatePayload(libraryItem: PodcastItem, matchData: PodcastMatchData, options: QuickMatchOptions) {
    const updatePayload: MatchPayload = {}

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

    for (const matchKey in matchDataTransformed) {
      const key = matchKey as keyof typeof matchDataTransformed
      const value = matchDataTransformed[key]
      if (value) {
        if (key === 'genres') {
          if (!libraryItem.media.genres!.length || options.overrideDetails) {
            let genresArray: string[]
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
        } else {
          // Legacy payload keys such as feedUrl differ from the Sequelize attribute names.
          const media = libraryItem.media as Podcast.PodcastExpanded & Partial<Record<'itunesPageUrl' | 'imageUrl' | 'feedUrl' | 'itunesArtistId' | 'itunesId', string | number>>
          if (media[key] !== value && (!media[key] || options.overrideDetails)) {
            updatePayload[key] = value
          }
        }
      }
    }

    return updatePayload
  }

  async quickMatchBookBuildUpdatePayload(apiRouterCtx: MatchRouter, libraryItem: BookItem, matchData: BookMatchData, options: QuickMatchOptions) {
    // Update media metadata if not set OR overrideDetails flag
    const detailKeysToUpdate = ['title', 'subtitle', 'description', 'narrator', 'publisher', 'publishedYear', 'genres', 'tags', 'language', 'explicit', 'abridged', 'asin', 'isbn'] as const
    const updatePayload: MatchPayload = {}

    for (const detailKey in matchData) {
      const key = detailKey as (typeof detailKeysToUpdate)[number]
      if (matchData[key] && detailKeysToUpdate.includes(key)) {
        if (key === 'narrator') {
          if (!libraryItem.media.narrators?.length || options.overrideDetails) {
            updatePayload.narrators = matchData[key]
              .split(',')
              .map((v) => v.trim())
              .filter((v) => !!v)
          }
        } else if (key === 'genres') {
          if (!libraryItem.media.genres!.length || options.overrideDetails) {
            let genresArray: string[]
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
          if (!libraryItem.media.tags!.length || options.overrideDetails) {
            let tagsArray: string[]
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
      const authorIdsRemoved: string[] = []
      const matchedAuthors = matchData.author
      for (const authorName of matchedAuthors) {
        const existingAuthor = libraryItem.media.authors.find((a) => a.name!.toLowerCase() === authorName.toLowerCase())
        if (!existingAuthor) {
          let author = await Database.authorModel.getByNameAndLibrary(authorName, libraryItem.libraryId!)
          if (!author) {
            author = await Database.authorModel.create({
              name: authorName,
              lastFirst: Database.authorModel.getLastFirst(authorName),
              libraryId: libraryItem.libraryId
            })
            SocketAuthority.emitter('author_added', author.toOldJSON())
            // Update filter data
            Database.addAuthorToFilterData(libraryItem.libraryId!, author.name, author.id)
          }
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
        const authorsRemoved = libraryItem.media.authors.filter((a) => !matchedAuthors.find((ma) => ma.toLowerCase() === a.name!.toLowerCase()))
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
      const seriesIdsRemoved: string[] = []
      const matchedSeries = matchData.series
      for (const seriesMatchItem of matchedSeries) {
        const existingSeries = libraryItem.media.series.find((s) => s.name!.toLowerCase() === seriesMatchItem.series.toLowerCase())
        if (existingSeries) {
          if (existingSeries.bookSeries!.sequence !== seriesMatchItem.sequence) {
            Object.assign(existingSeries.bookSeries!, { sequence: seriesMatchItem.sequence })
            await existingSeries.bookSeries!.save()
            Logger.info(`[Scanner] quickMatchBookBuildUpdatePayload: Updated series sequence for "${existingSeries.name}" to ${seriesMatchItem.sequence} in "${libraryItem.media.title}"`)
            hasSeriesUpdates = true
          }
        } else {
          let seriesItem = await Database.seriesModel.getByNameAndLibrary(seriesMatchItem.series, libraryItem.libraryId!)
          if (!seriesItem) {
            seriesItem = await Database.seriesModel.create({
              name: seriesMatchItem.series,
              nameIgnorePrefix: getTitleIgnorePrefix(seriesMatchItem.series),
              libraryId: libraryItem.libraryId
            })
            // Update filter data
            Database.addSeriesToFilterData(libraryItem.libraryId!, seriesItem.name!, seriesItem.id)
            SocketAuthority.emitter('series_added', seriesItem.toOldJSON())
          }
          const bookSeries = await Database.bookSeriesModel.create({
            seriesId: seriesItem.id,
            bookId: libraryItem.media.id,
            sequence: seriesMatchItem.sequence
          })
          libraryItem.media.series.push(Object.assign(seriesItem, { bookSeries }))
          Logger.info(`[Scanner] quickMatchBookBuildUpdatePayload: Added series "${seriesItem.name}" to "${libraryItem.media.title}"`)
          hasSeriesUpdates = true
        }
        const seriesRemoved = libraryItem.media.series.filter((s) => !matchedSeries.find((ms) => ms.series.toLowerCase() === s.name!.toLowerCase()))
        if (seriesRemoved.length) {
          for (const series of seriesRemoved) {
            await series.bookSeries!.destroy()
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

  async quickMatchPodcastEpisodes(libraryItem: PodcastItem, options: QuickMatchOptions = {}) {
    const episodesToQuickMatch = libraryItem.media.podcastEpisodes.filter((ep) => !ep.enclosureURL) // Only quick match episodes that are not already matched
    if (!episodesToQuickMatch.length) return 0

    const feed = await getPodcastFeed(libraryItem.media.feedURL!)
    if (!feed) {
      Logger.error(`[Scanner] quickMatchPodcastEpisodes: Unable to quick match episodes feed not found for "${libraryItem.media.feedURL}"`)
      return 0
    }

    let numEpisodesUpdated = 0
    for (const episode of episodesToQuickMatch) {
      const episodeMatches = findMatchingEpisodesInFeed(feed, episode.title!, 0.1)
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

  async updateEpisodeWithMatch(episode: PodcastEpisode, episodeToMatch: RssPodcastEpisode, options: QuickMatchOptions = {}) {
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
    const updatePayload: MatchPayload = {}
    for (const matchKey in matchDataTransformed) {
      const key = matchKey as keyof typeof matchDataTransformed
      const value = matchDataTransformed[key]
      if (value) {
        if (episode[key] !== value && (!episode[key] || options.overrideDetails)) {
          updatePayload[key] = value
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
   */
  async matchLibraryItemsChunk(apiRouterCtx: MatchRouter, library: Library, libraryItems: BookItem[], libraryScan: LibraryScan) {
    for (let i = 0; i < libraryItems.length; i++) {
      const libraryItem = libraryItems[i]

      if (libraryItem.media.asin && library.settings!.skipMatchingMediaWithAsin) {
        Logger.debug(`[Scanner] matchLibraryItems: Skipping "${libraryItem.media.title}" because it already has an ASIN (${i + 1} of ${libraryItems.length})`)
        continue
      }

      if (libraryItem.media.isbn && library.settings!.skipMatchingMediaWithIsbn) {
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
   */
  async matchLibraryItems(apiRouterCtx: MatchRouter, library: Library) {
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
      // The batch query includes books, authors and series and sets the media association.
      const libraryItems = (await Database.libraryItemModel.getLibraryItemsIncrement(offset, limit, { libraryId: library.id })) as BookItem[]
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

      task.data!.scanResults = libraryScan.scanResults
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
export = new Scanner()
