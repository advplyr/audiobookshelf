const { sort, createNewSortInstance } = require('../libs/fastSort')
const Logger = require('../Logger')
const { getTitlePrefixAtEnd, isNullOrNaN, getTitleIgnorePrefix } = require('../utils/index')
const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

module.exports = {
  decode(text) {
    return Buffer.from(decodeURIComponent(text), 'base64').toString()
  },

  getFilteredLibraryItems(libraryItems, filterBy, user, feedsArray) {
    let filtered = libraryItems

    const searchGroups = ['genres', 'tags', 'series', 'authors', 'progress', 'narrators', 'missing', 'languages', 'tracks']
    const group = searchGroups.find(_group => filterBy.startsWith(_group + '.'))
    if (group) {
      const filterVal = filterBy.replace(`${group}.`, '')
      const filter = this.decode(filterVal)
      if (group === 'genres') filtered = filtered.filter(li => li.media.metadata.genres?.includes(filter))
      else if (group === 'tags') filtered = filtered.filter(li => li.media.tags.includes(filter))
      else if (group === 'series') {
        if (filter === 'no-series') filtered = filtered.filter(li => li.isBook && !li.media.metadata.series.length)
        else {
          filtered = filtered.filter(li => li.isBook && li.media.metadata.hasSeries(filter))
        }
      }
      else if (group === 'authors') filtered = filtered.filter(li => li.isBook && li.media.metadata.hasAuthor(filter))
      else if (group === 'narrators') filtered = filtered.filter(li => li.isBook && li.media.metadata.hasNarrator(filter))
      else if (group === 'progress') {
        filtered = filtered.filter(li => {
          const itemProgress = user.getMediaProgress(li.id)
          if (filter === 'finished' && (itemProgress && itemProgress.isFinished)) return true
          if (filter === 'not-started' && !itemProgress) return true
          if (filter === 'not-finished' && (!itemProgress || !itemProgress.isFinished)) return true
          if (filter === 'in-progress' && (itemProgress && itemProgress.inProgress)) return true
          return false
        })
      } else if (group == 'missing') {
        filtered = filtered.filter(li => {
          if (li.isBook) {
            if (filter === 'asin' && !li.media.metadata.asin) return true
            if (filter === 'isbn' && !li.media.metadata.isbn) return true
            if (filter === 'subtitle' && !li.media.metadata.subtitle) return true
            if (filter === 'authors' && !li.media.metadata.authors.length) return true
            if (filter === 'publishedYear' && !li.media.metadata.publishedYear) return true
            if (filter === 'series' && !li.media.metadata.series.length) return true
            if (filter === 'description' && !li.media.metadata.description) return true
            if (filter === 'genres' && !li.media.metadata.genres.length) return true
            if (filter === 'tags' && !li.media.tags.length) return true
            if (filter === 'narrators' && !li.media.metadata.narrators.length) return true
            if (filter === 'publisher' && !li.media.metadata.publisher) return true
            if (filter === 'language' && !li.media.metadata.language) return true
            if (filter === 'cover' && !li.media.coverPath) return true
          } else {
            return false
          }
        })
      } else if (group === 'languages') {
        filtered = filtered.filter(li => li.media.metadata.language === filter)
      } else if (group === 'tracks') {
        if (filter === 'single') filtered = filtered.filter(li => li.isBook && li.media.numTracks === 1)
        else if (filter === 'multi') filtered = filtered.filter(li => li.isBook && li.media.numTracks > 1)
      }
    } else if (filterBy === 'issues') {
      filtered = filtered.filter(li => li.hasIssues)
    } else if (filterBy === 'feed-open') {
      filtered = filtered.filter(li => feedsArray.some(feed => feed.entityId === li.id))
    } else if (filterBy === 'abridged') {
      filtered = filtered.filter(li => !!li.media.metadata?.abridged)
    } else if (filterBy === 'ebook') {
      filtered = filtered.filter(li => li.media.ebookFile)
    }

    return filtered
  },

  // Returns false if should be filtered out
  checkFilterForSeriesLibraryItem(libraryItem, filterBy) {
    var searchGroups = ['genres', 'tags', 'authors', 'progress', 'narrators', 'languages']
    var group = searchGroups.find(_group => filterBy.startsWith(_group + '.'))
    if (group) {
      var filterVal = filterBy.replace(`${group}.`, '')
      var filter = this.decode(filterVal)

      if (group === 'genres') return libraryItem.media.metadata.genres.includes(filter)
      else if (group === 'tags') return libraryItem.media.tags.includes(filter)
      else if (group === 'authors') return libraryItem.isBook && libraryItem.media.metadata.hasAuthor(filter)
      else if (group === 'narrators') return libraryItem.isBook && libraryItem.media.metadata.hasNarrator(filter)
      else if (group === 'languages') {
        return libraryItem.media.metadata.language === filter
      }
    }
    return true
  },

  // Return false to filter out series
  checkSeriesProgressFilter(series, filterBy, user) {
    const filter = this.decode(filterBy.split('.')[1])

    let someBookHasProgress = false
    let someBookIsUnfinished = false
    for (const libraryItem of series.books) {
      const itemProgress = user.getMediaProgress(libraryItem.id)
      if (!itemProgress || !itemProgress.isFinished) someBookIsUnfinished = true
      if (itemProgress && itemProgress.progress > 0) someBookHasProgress = true

      if (filter === 'finished' && (!itemProgress || !itemProgress.isFinished)) return false
      if (filter === 'not-started' && itemProgress) return false
    }

    if (!someBookIsUnfinished && (filter === 'not-finished' || filter === 'in-progress')) { // Completely finished series
      return false
    } else if (!someBookHasProgress && filter === 'in-progress') { // Series not started
      return false
    }
    return true
  },

  getDistinctFilterDataNew(libraryItems) {
    var data = {
      authors: [],
      genres: [],
      tags: [],
      series: [],
      narrators: [],
      languages: []
    }
    libraryItems.forEach((li) => {
      var mediaMetadata = li.media.metadata
      if (mediaMetadata.authors && mediaMetadata.authors.length) {
        mediaMetadata.authors.forEach((author) => {
          if (author && !data.authors.find(au => au.id === author.id)) data.authors.push({ id: author.id, name: author.name })
        })
      }
      if (mediaMetadata.series && mediaMetadata.series.length) {
        mediaMetadata.series.forEach((series) => {
          if (series && !data.series.find(se => se.id === series.id)) data.series.push({ id: series.id, name: series.name })
        })
      }
      if (mediaMetadata.genres && mediaMetadata.genres.length) {
        mediaMetadata.genres.forEach((genre) => {
          if (genre && !data.genres.includes(genre)) data.genres.push(genre)
        })
      }
      if (li.media.tags.length) {
        li.media.tags.forEach((tag) => {
          if (tag && !data.tags.includes(tag)) data.tags.push(tag)
        })
      }
      if (mediaMetadata.narrators && mediaMetadata.narrators.length) {
        mediaMetadata.narrators.forEach((narrator) => {
          if (narrator && !data.narrators.includes(narrator)) data.narrators.push(narrator)
        })
      }
      if (mediaMetadata.language && !data.languages.includes(mediaMetadata.language)) data.languages.push(mediaMetadata.language)
    })
    data.authors = naturalSort(data.authors).asc(au => au.name)
    data.genres = naturalSort(data.genres).asc()
    data.tags = naturalSort(data.tags).asc()
    data.series = naturalSort(data.series).asc(se => se.name)
    data.narrators = naturalSort(data.narrators).asc()
    data.languages = naturalSort(data.languages).asc()
    return data
  },

  getSeriesFromBooks(books, allSeries, filterSeries, filterBy, user, minified = false) {
    const _series = {}
    const seriesToFilterOut = {}
    books.forEach((libraryItem) => {
      // get all book series for item that is not already filtered out
      const bookSeries = (libraryItem.media.metadata.series || []).filter(se => !seriesToFilterOut[se.id])
      if (!bookSeries.length) return

      if (filterBy && user && !filterBy.startsWith('progress.')) { // Series progress filters are evaluated after grouping
        // If a single book in a series is filtered out then filter out the entire series
        if (!this.checkFilterForSeriesLibraryItem(libraryItem, filterBy)) {
          // filter out this library item
          bookSeries.forEach((bookSeriesObj) => {
            // flag series to filter it out
            seriesToFilterOut[bookSeriesObj.id] = true
            delete _series[bookSeriesObj.id]
          })
          return
        }
      }

      bookSeries.forEach((bookSeriesObj) => {
        const series = allSeries.find(se => se.id === bookSeriesObj.id)

        const abJson = minified ? libraryItem.toJSONMinified() : libraryItem.toJSONExpanded()
        abJson.sequence = bookSeriesObj.sequence
        if (filterSeries) {
          abJson.filterSeriesSequence = libraryItem.media.metadata.getSeries(filterSeries).sequence
        }
        if (!_series[bookSeriesObj.id]) {
          _series[bookSeriesObj.id] = {
            id: bookSeriesObj.id,
            name: bookSeriesObj.name,
            nameIgnorePrefix: getTitlePrefixAtEnd(bookSeriesObj.name),
            nameIgnorePrefixSort: getTitleIgnorePrefix(bookSeriesObj.name),
            type: 'series',
            books: [abJson],
            addedAt: series ? series.addedAt : 0,
            totalDuration: isNullOrNaN(abJson.media.duration) ? 0 : Number(abJson.media.duration)
          }

        } else {
          _series[bookSeriesObj.id].books.push(abJson)
          _series[bookSeriesObj.id].totalDuration += isNullOrNaN(abJson.media.duration) ? 0 : Number(abJson.media.duration)
        }
      })
    })

    let seriesItems = Object.values(_series)

    // check progress filter
    if (filterBy && filterBy.startsWith('progress.') && user) {
      seriesItems = seriesItems.filter(se => this.checkSeriesProgressFilter(se, filterBy, user))
    }

    return seriesItems.map((series) => {
      series.books = naturalSort(series.books).asc(li => li.sequence)
      return series
    })
  },

  getBooksNextInSeries(seriesWithUserAb, limit, minified = false) {
    var incompleteSeires = seriesWithUserAb.filter((series) => series.books.some((book) => !book.userAudiobook || (!book.userAudiobook.isRead && book.userAudiobook.progress == 0)))
    var booksNextInSeries = []
    incompleteSeires.forEach((series) => {
      var dateLastRead = series.books.filter((data) => data.userAudiobook && data.userAudiobook.isRead).sort((a, b) => { return b.userAudiobook.finishedAt - a.userAudiobook.finishedAt })[0].userAudiobook.finishedAt
      var nextUnreadBook = series.books.filter((data) => !data.userAudiobook || (!data.userAudiobook.isRead && data.userAudiobook.progress == 0))[0]
      nextUnreadBook.DateLastReadSeries = dateLastRead
      booksNextInSeries.push(nextUnreadBook)
    })
    return booksNextInSeries.sort((a, b) => { return b.DateLastReadSeries - a.DateLastReadSeries }).map(b => minified ? b.book.toJSONMinified() : b.book.toJSONExpanded()).slice(0, limit)
  },

  getGenresWithCount(libraryItems) {
    var genresMap = {}
    libraryItems.forEach((li) => {
      var genres = li.media.metadata.genres || []
      genres.forEach((genre) => {
        if (genresMap[genre]) genresMap[genre].count++
        else
          genresMap[genre] = {
            genre,
            count: 1
          }
      })
    })
    return Object.values(genresMap).sort((a, b) => b.count - a.count)
  },

  getAuthorsWithCount(libraryItems) {
    var authorsMap = {}
    libraryItems.forEach((li) => {
      var authors = li.media.metadata.authors || []
      authors.forEach((author) => {
        if (authorsMap[author.id]) authorsMap[author.id].count++
        else
          authorsMap[author.id] = {
            id: author.id,
            name: author.name,
            count: 1
          }
      })
    })
    return Object.values(authorsMap).sort((a, b) => b.count - a.count)
  },

  getItemDurationStats(libraryItems) {
    var sorted = sort(libraryItems).desc(li => li.media.duration)
    var top10 = sorted.slice(0, 10).map(li => ({ id: li.id, title: li.media.metadata.title, duration: li.media.duration })).filter(i => i.duration > 0)
    var totalDuration = 0
    var numAudioTracks = 0
    libraryItems.forEach((li) => {
      totalDuration += li.media.duration
      numAudioTracks += li.media.numTracks
    })
    return {
      totalDuration,
      numAudioTracks,
      longestItems: top10
    }
  },

  getItemSizeStats(libraryItems) {
    var sorted = sort(libraryItems).desc(li => li.media.size)
    var top10 = sorted.slice(0, 10).map(li => ({ id: li.id, title: li.media.metadata.title, size: li.media.size })).filter(i => i.size > 0)
    var totalSize = 0
    libraryItems.forEach((li) => {
      totalSize += li.media.size
    })
    return {
      totalSize,
      largestItems: top10
    }
  },

  getLibraryItemsTotalSize(libraryItems) {
    var totalSize = 0
    libraryItems.forEach((li) => {
      totalSize += li.media.size
    })
    return totalSize
  },


  collapseBookSeries(libraryItems, series, filterSeries) {
    // Get series from the library items. If this list is being collapsed after filtering for a series,
    // don't collapse that series, only books that are in other series.
    const seriesObjects = this
      .getSeriesFromBooks(libraryItems, series, filterSeries, null, null, true)
      .filter(s => s.id != filterSeries)

    const filteredLibraryItems = []

    libraryItems.forEach((li) => {
      if (li.mediaType != 'book') return

      // Handle when this is the first book in a series
      seriesObjects.filter(s => s.books[0].id == li.id).forEach(series => {
        // Clone the library item as we need to attach data to it, but don't
        // want to change the global copy of the library item
        filteredLibraryItems.push(Object.assign(
          Object.create(Object.getPrototypeOf(li)),
          li, { collapsedSeries: series }))
      })

      // Only included books not contained in series
      if (!seriesObjects.some(s => s.books.some(b => b.id == li.id)))
        filteredLibraryItems.push(li)
    })

    return filteredLibraryItems
  },

  buildPersonalizedShelves(ctx, user, libraryItems, mediaType, maxEntitiesPerShelf, include) {
    const isPodcastLibrary = mediaType === 'podcast'
    const includeRssFeed = include.includes('rssfeed')

    const shelves = [
      {
        id: 'continue-listening',
        label: 'Continue Listening',
        labelStringKey: 'LabelContinueListening',
        type: isPodcastLibrary ? 'episode' : mediaType,
        entities: []
      },
      {
        id: 'continue-reading',
        label: 'Continue Reading',
        labelStringKey: 'LabelContinueReading',
        type: 'book',
        entities: []
      },
      {
        id: 'continue-series',
        label: 'Continue Series',
        labelStringKey: 'LabelContinueSeries',
        type: mediaType,
        entities: []
      },
      {
        id: 'episodes-recently-added',
        label: 'Newest Episodes',
        labelStringKey: 'LabelNewestEpisodes',
        type: 'episode',
        entities: []
      },
      {
        id: 'recently-added',
        label: 'Recently Added',
        labelStringKey: 'LabelRecentlyAdded',
        type: mediaType,
        entities: []
      },
      {
        id: 'recent-series',
        label: 'Recent Series',
        labelStringKey: 'LabelRecentSeries',
        type: 'series',
        entities: []
      },
      {
        id: 'recommended',
        label: 'Recommended',
        labelStringKey: 'LabelRecommended',
        type: mediaType,
        entities: []
      },
      {
        id: 'listen-again',
        label: 'Listen Again',
        labelStringKey: 'LabelListenAgain',
        type: isPodcastLibrary ? 'episode' : mediaType,
        entities: []
      },
      {
        id: 'read-again',
        label: 'Read Again',
        labelStringKey: 'LabelReadAgain',
        type: 'book',
        entities: []
      },
      {
        id: 'newest-authors',
        label: 'Newest Authors',
        labelStringKey: 'LabelNewestAuthors',
        type: 'authors',
        entities: []
      }
    ]

    const categoryMap = {}
    shelves.forEach((shelf) => {
      categoryMap[shelf.id] = {
        id: shelf.id,
        biggest: 0,
        smallest: 0,
        items: []
      }
    })

    const seriesMap = {}
    const authorMap = {}

    // For use with recommended
    const topGenresListened = {}
    const topAuthorsListened = {}
    const topTagsListened = {}
    const notStartedBooks = []

    for (const libraryItem of libraryItems) {
      if (libraryItem.addedAt > categoryMap['recently-added'].smallest) {

        const indexToPut = categoryMap['recently-added'].items.findIndex(i => libraryItem.addedAt > i.addedAt)
        if (indexToPut >= 0) {
          categoryMap['recently-added'].items.splice(indexToPut, 0, libraryItem.toJSONMinified())
        } else {
          categoryMap['recently-added'].items.push(libraryItem.toJSONMinified())
        }

        if (categoryMap['recently-added'].items.length > maxEntitiesPerShelf) {
          // Remove last item
          categoryMap['recently-added'].items.pop()
          categoryMap['recently-added'].smallest = categoryMap['recently-added'].items[categoryMap['recently-added'].items.length - 1].addedAt
        }
        categoryMap['recently-added'].biggest = categoryMap['recently-added'].items[0].addedAt
      }

      const allItemProgress = user.getAllMediaProgressForLibraryItem(libraryItem.id)
      if (libraryItem.isPodcast) {
        // Podcast categories
        const podcastEpisodes = libraryItem.media.episodes || []
        for (const episode of podcastEpisodes) {
          // Newest episodes
          if (episode.addedAt > categoryMap['episodes-recently-added'].smallest) {
            const libraryItemWithEpisode = {
              ...libraryItem.toJSONMinified(),
              recentEpisode: episode.toJSON()
            }

            const indexToPut = categoryMap['episodes-recently-added'].items.findIndex(i => episode.addedAt > i.recentEpisode.addedAt)
            if (indexToPut >= 0) {
              categoryMap['episodes-recently-added'].items.splice(indexToPut, 0, libraryItemWithEpisode)
            } else {
              categoryMap['episodes-recently-added'].items.push(libraryItemWithEpisode)
            }

            if (categoryMap['episodes-recently-added'].items.length > maxEntitiesPerShelf) {
              // Remove last item
              categoryMap['episodes-recently-added'].items.pop()
              categoryMap['episodes-recently-added'].smallest = categoryMap['episodes-recently-added'].items[categoryMap['episodes-recently-added'].items.length - 1].recentEpisode.addedAt
            }
            categoryMap['episodes-recently-added'].biggest = categoryMap['episodes-recently-added'].items[0].recentEpisode.addedAt
          }

          // Episode recently listened and finished
          const mediaProgress = allItemProgress.find(mp => mp.episodeId === episode.id)
          if (mediaProgress) {
            if (mediaProgress.isFinished) {
              if (mediaProgress.finishedAt > categoryMap['listen-again'].smallest) { // Item belongs on shelf
                const libraryItemWithEpisode = {
                  ...libraryItem.toJSONMinified(),
                  recentEpisode: episode.toJSON(),
                  finishedAt: mediaProgress.finishedAt
                }

                const indexToPut = categoryMap['listen-again'].items.findIndex(i => mediaProgress.finishedAt > i.finishedAt)
                if (indexToPut >= 0) {
                  categoryMap['listen-again'].items.splice(indexToPut, 0, libraryItemWithEpisode)
                } else {
                  categoryMap['listen-again'].items.push(libraryItemWithEpisode)
                }

                if (categoryMap['listen-again'].items.length > maxEntitiesPerShelf) {
                  // Remove last item
                  categoryMap['listen-again'].items.pop()
                  categoryMap['listen-again'].smallest = categoryMap['listen-again'].items[categoryMap['listen-again'].items.length - 1].finishedAt
                }
                categoryMap['listen-again'].biggest = categoryMap['listen-again'].items[0].finishedAt
              }
            } else if (mediaProgress.inProgress && !mediaProgress.hideFromContinueListening) { // Handle most recently listened
              if (mediaProgress.lastUpdate > categoryMap['continue-listening'].smallest) { // Item belongs on shelf
                const libraryItemWithEpisode = {
                  ...libraryItem.toJSONMinified(),
                  recentEpisode: episode.toJSON(),
                  progressLastUpdate: mediaProgress.lastUpdate
                }

                const indexToPut = categoryMap['continue-listening'].items.findIndex(i => mediaProgress.lastUpdate > i.progressLastUpdate)
                if (indexToPut >= 0) {
                  categoryMap['continue-listening'].items.splice(indexToPut, 0, libraryItemWithEpisode)
                } else {
                  categoryMap['continue-listening'].items.push(libraryItemWithEpisode)
                }

                if (categoryMap['continue-listening'].items.length > maxEntitiesPerShelf) {
                  // Remove last item
                  categoryMap['continue-listening'].items.pop()
                  categoryMap['continue-listening'].smallest = categoryMap['continue-listening'].items[categoryMap['continue-listening'].items.length - 1].progressLastUpdate
                }

                categoryMap['continue-listening'].biggest = categoryMap['continue-listening'].items[0].progressLastUpdate
              }
            }
          }
        }
      } else if (libraryItem.isBook) {
        // Book categories

        const mediaProgress = allItemProgress.length ? allItemProgress[0] : null

        // Used for recommended. Tally up most listened to authors/genres/tags
        if (mediaProgress && (mediaProgress.inProgress || mediaProgress.isFinished)) {
          libraryItem.media.metadata.authors.forEach((author) => {
            topAuthorsListened[author.id] = (topAuthorsListened[author.id] || 0) + 1
          })
          libraryItem.media.metadata.genres.forEach((genre) => {
            topGenresListened[genre] = (topGenresListened[genre] || 0) + 1
          })
          libraryItem.media.tags.forEach((tag) => {
            topTagsListened[tag] = (topTagsListened[tag] || 0) + 1
          })
        } else {
          // Insert in random position to add randomization to equal weighted items
          notStartedBooks.splice(Math.floor(Math.random() * (notStartedBooks.length + 1)), 0, libraryItem)
        }

        // Newest series
        if (libraryItem.media.metadata.series.length) {
          for (const librarySeries of libraryItem.media.metadata.series) {

            const bookInProgress = mediaProgress && (mediaProgress.inProgress || mediaProgress.isFinished)
            const bookActive = mediaProgress && mediaProgress.inProgress && !mediaProgress.isFinished
            const libraryItemJson = libraryItem.toJSONMinified()
            libraryItemJson.seriesSequence = librarySeries.sequence

            const hideFromContinueListening = user.checkShouldHideSeriesFromContinueListening(librarySeries.id)

            if (!seriesMap[librarySeries.id]) {
              const seriesObj = ctx.db.series.find(se => se.id === librarySeries.id)
              if (seriesObj) {
                const series = {
                  ...seriesObj.toJSON(),
                  books: [libraryItemJson],
                  inProgress: bookInProgress,
                  hasActiveBook: bookActive,
                  hideFromContinueListening,
                  bookInProgressLastUpdate: bookInProgress ? mediaProgress.lastUpdate : null,
                  firstBookUnread: bookInProgress ? null : libraryItemJson
                }
                seriesMap[librarySeries.id] = series

                if (series.addedAt > categoryMap['recent-series'].smallest) {
                  const indexToPut = categoryMap['recent-series'].items.findIndex(i => series.addedAt > i.addedAt)
                  if (indexToPut >= 0) {
                    categoryMap['recent-series'].items.splice(indexToPut, 0, series)
                  } else {
                    categoryMap['recent-series'].items.push(series)
                  }

                  // Max series is 5
                  if (categoryMap['recent-series'].items.length > 5) {
                    categoryMap['recent-series'].items.pop()
                    categoryMap['recent-series'].smallest = categoryMap['recent-series'].items[categoryMap['recent-series'].items.length - 1].addedAt
                  }

                  categoryMap['recent-series'].biggest = categoryMap['recent-series'].items[0].addedAt
                }
              }
            } else {
              // series already in map - add book
              seriesMap[librarySeries.id].books.push(libraryItemJson)

              if (bookInProgress) { // Update if this series is in progress
                seriesMap[librarySeries.id].inProgress = true

                if (seriesMap[librarySeries.id].bookInProgressLastUpdate < mediaProgress.lastUpdate) {
                  seriesMap[librarySeries.id].bookInProgressLastUpdate = mediaProgress.lastUpdate
                }
              } else if (!seriesMap[librarySeries.id].firstBookUnread) {
                seriesMap[librarySeries.id].firstBookUnread = libraryItemJson
              } else if (libraryItemJson.seriesSequence) {
                // If current firstBookUnread has a series sequence greater than this series sequence, then update firstBookUnread
                const firstBookUnreadSequence = seriesMap[librarySeries.id].firstBookUnread.seriesSequence
                if (!firstBookUnreadSequence || String(firstBookUnreadSequence).localeCompare(String(librarySeries.sequence), undefined, { sensitivity: 'base', numeric: true }) > 0) {
                  seriesMap[librarySeries.id].firstBookUnread = libraryItemJson
                }
              }

              // Update if series has an active (progress < 100%) book
              if (bookActive) {
                seriesMap[librarySeries.id].hasActiveBook = true
              }
            }
          }
        }

        // Newest authors
        if (libraryItem.media.metadata.authors.length) {
          for (const libraryAuthor of libraryItem.media.metadata.authors) {
            if (!authorMap[libraryAuthor.id]) {
              const authorObj = ctx.db.authors.find(au => au.id === libraryAuthor.id)
              if (authorObj) {
                const author = {
                  ...authorObj.toJSON(),
                  numBooks: 1
                }

                if (author.addedAt > categoryMap['newest-authors'].smallest) {

                  const indexToPut = categoryMap['newest-authors'].items.findIndex(i => author.addedAt > i.addedAt)
                  if (indexToPut >= 0) {
                    categoryMap['newest-authors'].items.splice(indexToPut, 0, author)
                  } else {
                    categoryMap['newest-authors'].items.push(author)
                  }

                  // Max authors is 10
                  if (categoryMap['newest-authors'].items.length > 10) {
                    categoryMap['newest-authors'].items.pop()
                    categoryMap['newest-authors'].smallest = categoryMap['newest-authors'].items[categoryMap['newest-authors'].items.length - 1].addedAt
                  }

                  categoryMap['newest-authors'].biggest = categoryMap['newest-authors'].items[0].addedAt
                }

                authorMap[libraryAuthor.id] = author
              }
            } else {
              authorMap[libraryAuthor.id].numBooks++
            }
          }
        }

        // Book listening and finished
        if (mediaProgress) {
          const categoryId = libraryItem.media.isEBookOnly ? 'read-again' : 'listen-again'

          // Handle most recently finished
          if (mediaProgress.isFinished) {
            if (mediaProgress.finishedAt > categoryMap[categoryId].smallest) { // Item belongs on shelf
              const libraryItemObj = {
                ...libraryItem.toJSONMinified(),
                finishedAt: mediaProgress.finishedAt
              }

              const indexToPut = categoryMap[categoryId].items.findIndex(i => mediaProgress.finishedAt > i.finishedAt)
              if (indexToPut >= 0) {
                categoryMap[categoryId].items.splice(indexToPut, 0, libraryItemObj)
              } else {
                categoryMap[categoryId].items.push(libraryItemObj)
              }
              if (categoryMap[categoryId].items.length > maxEntitiesPerShelf) {
                // Remove last item
                categoryMap[categoryId].items.pop()
                categoryMap[categoryId].smallest = categoryMap[categoryId].items[categoryMap[categoryId].items.length - 1].finishedAt
              }
              categoryMap[categoryId].biggest = categoryMap[categoryId].items[0].finishedAt
            }
          } else if (mediaProgress.inProgress && !mediaProgress.hideFromContinueListening) { // Handle most recently listened
            const categoryId = libraryItem.media.isEBookOnly ? 'continue-reading' : 'continue-listening'

            if (mediaProgress.lastUpdate > categoryMap[categoryId].smallest) { // Item belongs on shelf
              const libraryItemObj = {
                ...libraryItem.toJSONMinified(),
                progressLastUpdate: mediaProgress.lastUpdate
              }

              const indexToPut = categoryMap[categoryId].items.findIndex(i => mediaProgress.lastUpdate > i.progressLastUpdate)
              if (indexToPut >= 0) {
                categoryMap[categoryId].items.splice(indexToPut, 0, libraryItemObj)
              } else { // Should only happen when array is < max
                categoryMap[categoryId].items.push(libraryItemObj)
              }
              if (categoryMap[categoryId].items.length > maxEntitiesPerShelf) {
                // Remove last item
                categoryMap[categoryId].items.pop()
                categoryMap[categoryId].smallest = categoryMap[categoryId].items[categoryMap[categoryId].items.length - 1].progressLastUpdate
              }
              categoryMap[categoryId].biggest = categoryMap[categoryId].items[0].progressLastUpdate
            }
          }
        }
      }
    }

    // For Continue Series - Find next book in series for series that are in progress
    for (const seriesId in seriesMap) {
      seriesMap[seriesId].books = naturalSort(seriesMap[seriesId].books).asc(li => li.seriesSequence)

      if (seriesMap[seriesId].inProgress && !seriesMap[seriesId].hideFromContinueListening) {
        // take the first book unread with the smallest series sequence
        // unless the user is already listening to a book from this series
        const hasActiveBook = seriesMap[seriesId].hasActiveBook
        const nextBookInSeries = seriesMap[seriesId].firstBookUnread

        if (!hasActiveBook && nextBookInSeries) {
          const bookForContinueSeries = {
            ...nextBookInSeries,
            prevBookInProgressLastUpdate: seriesMap[seriesId].bookInProgressLastUpdate
          }
          bookForContinueSeries.media.metadata.series = {
            id: seriesId,
            name: seriesMap[seriesId].name,
            sequence: nextBookInSeries.seriesSequence
          }

          const indexToPut = categoryMap['continue-series'].items.findIndex(i => i.prevBookInProgressLastUpdate < bookForContinueSeries.prevBookInProgressLastUpdate)
          if (!categoryMap['continue-series'].items.find(book => book.id === bookForContinueSeries.id)) {
            if (indexToPut >= 0) {
              categoryMap['continue-series'].items.splice(indexToPut, 0, bookForContinueSeries)
            } else if (categoryMap['continue-series'].items.length < 10) { // Max 10 books
              categoryMap['continue-series'].items.push(bookForContinueSeries)
            }
          }
        }
      }
    }

    // For recommended
    if (!isPodcastLibrary && notStartedBooks.length) {
      const genresCount = Object.values(topGenresListened).reduce((a, b) => a + b, 0)
      const authorsCount = Object.values(topAuthorsListened).reduce((a, b) => a + b, 0)
      const tagsCount = Object.values(topTagsListened).reduce((a, b) => a + b, 0)

      for (const libraryItem of notStartedBooks) {
        // dont include books in an unfinished series and books that are not first in an unstarted series
        let shouldContinue = !libraryItem.media.metadata.series.length
        libraryItem.media.metadata.series.forEach((se) => {
          if (seriesMap[se.id]) {
            if (seriesMap[se.id].inProgress) {
              shouldContinue = false
              return
            } else if (seriesMap[se.id].books[0].id === libraryItem.id) {
              shouldContinue = true
            }
          }
        })
        if (!shouldContinue) {
          continue;
        }

        let totalWeight = 0

        if (authorsCount > 0) {
          libraryItem.media.metadata.authors.forEach((author) => {
            if (topAuthorsListened[author.id]) {
              totalWeight += topAuthorsListened[author.id] / authorsCount
            }
          })
        }

        if (genresCount > 0) {
          libraryItem.media.metadata.genres.forEach((genre) => {
            if (topGenresListened[genre]) {
              totalWeight += topGenresListened[genre] / genresCount
            }
          })
        }

        if (tagsCount > 0) {
          libraryItem.media.tags.forEach((tag) => {
            if (topTagsListened[tag]) {
              totalWeight += topTagsListened[tag] / tagsCount
            }
          })
        }

        if (!categoryMap.recommended.smallest || totalWeight > categoryMap.recommended.smallest) {
          const libraryItemObj = {
            ...libraryItem.toJSONMinified(),
            weight: totalWeight
          }

          const indexToPut = categoryMap.recommended.items.findIndex(i => totalWeight > i.weight)
          if (indexToPut >= 0) {
            categoryMap.recommended.items.splice(indexToPut, 0, libraryItemObj)
          } else {
            categoryMap.recommended.items.push(libraryItemObj)
          }

          if (categoryMap.recommended.items.length > maxEntitiesPerShelf) {
            categoryMap.recommended.items.pop()
            categoryMap.recommended.smallest = categoryMap.recommended.items[categoryMap.recommended.items.length - 1].weight
          }
        }
      }
    }

    // Sort series books by sequence
    if (categoryMap['recent-series'].items.length) {
      for (const seriesItem of categoryMap['recent-series'].items) {
        seriesItem.books = naturalSort(seriesItem.books).asc(li => li.seriesSequence)
      }
    }

    const categoriesWithItems = Object.values(categoryMap).filter(cat => cat.items.length)

    return categoriesWithItems.map(cat => {
      const shelf = shelves.find(s => s.id === cat.id)
      shelf.entities = cat.items

      // Add rssFeed to entities if query string "include=rssfeed" was on request
      if (includeRssFeed) {
        if (shelf.type === 'book' || shelf.type === 'podcast') {
          shelf.entities = shelf.entities.map((item) => {
            item.rssFeed = ctx.rssFeedManager.findFeedForEntityId(item.id)?.toJSONMinified() || null
            return item
          })
        } else if (shelf.type === 'series') {
          shelf.entities = shelf.entities.map((series) => {
            series.rssFeed = ctx.rssFeedManager.findFeedForEntityId(series.id)?.toJSONMinified() || null
            return series
          })
        }
      }

      return shelf
    })
  },

  groupMusicLibraryItemsIntoAlbums(libraryItems) {
    const albums = {}

    libraryItems.forEach((li) => {
      const albumTitle = li.media.metadata.album
      const albumArtist = li.media.metadata.albumArtist

      if (albumTitle && !albums[albumTitle]) {
        albums[albumTitle] = {
          title: albumTitle,
          artist: albumArtist,
          libraryItemId: li.media.coverPath ? li.id : null,
          numTracks: 1
        }
      } else if (albumTitle && albums[albumTitle].artist === albumArtist) {
        if (!albums[albumTitle].libraryItemId && li.media.coverPath) albums[albumTitle].libraryItemId = li.id
        albums[albumTitle].numTracks++
      } else {
        if (albumTitle) {
          Logger.warn(`Music track "${li.media.metadata.title}" with album "${albumTitle}" has a different album artist then another track in the same album.  This track album artist is "${albumArtist}" but the album artist is already set to "${albums[albumTitle].artist}"`)
        }
        if (!albums['_none_']) albums['_none_'] = { title: 'No Album', artist: 'Various Artists', libraryItemId: null, numTracks: 0 }
        albums['_none_'].numTracks++
      }
    })

    return Object.values(albums)
  }
}
