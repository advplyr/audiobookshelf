const { sort, createNewSortInstance } = require('fast-sort')
const Logger = require('../Logger')
const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

module.exports = {
  decode(text) {
    return Buffer.from(decodeURIComponent(text), 'base64').toString()
  },

  getFilteredLibraryItems(libraryItems, filterBy, user) {
    var filtered = libraryItems

    var searchGroups = ['genres', 'tags', 'series', 'authors', 'progress', 'narrators', 'missing', 'languages']
    var group = searchGroups.find(_group => filterBy.startsWith(_group + '.'))
    if (group) {
      var filterVal = filterBy.replace(`${group}.`, '')
      var filter = this.decode(filterVal)
      if (group === 'genres') filtered = filtered.filter(li => li.media.metadata && li.media.metadata.genres.includes(filter))
      else if (group === 'tags') filtered = filtered.filter(li => li.media.tags.includes(filter))
      else if (group === 'series') {
        if (filter === 'No Series') filtered = filtered.filter(li => li.media.metadata && !li.media.metadata.series.length)
        else {
          filtered = filtered.filter(li => li.media.metadata && li.media.metadata.hasSeries(filter))
        }
      }
      else if (group === 'authors') filtered = filtered.filter(li => li.media.metadata && li.media.metadata.hasAuthor(filter))
      else if (group === 'narrators') filtered = filtered.filter(li => li.media.metadata && li.media.metadata.hasNarrator(filter))
      else if (group === 'progress') {
        filtered = filtered.filter(li => {
          var itemProgress = user.getMediaProgress(li.id)
          if (filter === 'Finished' && (itemProgress && itemProgress.isFinished)) return true
          if (filter === 'Not Started' && !itemProgress) return true
          if (filter === 'In Progress' && (itemProgress && itemProgress.inProgress)) return true
          return false
        })
      } else if (group == 'missing') {
        filtered = filtered.filter(li => {
          if (filter === 'ASIN' && li.media.metadata.asin === null) return true;
          if (filter === 'ISBN' && li.media.metadata.isbn === null) return true;
          if (filter === 'Subtitle' && li.media.metadata.subtitle === null) return true;
          if (filter === 'Author' && li.media.metadata.authors.length === 0) return true;
          if (filter === 'Publish Year' && li.media.metadata.publishedYear === null) return true;
          if (filter === 'Series' && li.media.metadata.series.length === 0) return true;
          if (filter === 'Volume Number' && (li.media.metadata.series.length === 0 || li.media.metadata.series[0].sequence === null)) return true;
          if (filter === 'Description' && li.media.metadata.description === null) return true;
          if (filter === 'Genres' && li.media.metadata.genres.length === 0) return true;
          if (filter === 'Tags' && li.media.tags.length === 0) return true;
          if (filter === 'Narrator' && li.media.metadata.narrators.length === 0) return true;
          if (filter === 'Publisher' && li.media.metadata.publisher === null) return true;
          if (filter === 'Language' && li.media.metadata.language === null) return true;
        })
      } else if (group === 'languages') {
        filtered = filtered.filter(li => li.media.metadata && li.media.metadata.language === filter)
      }
    } else if (filterBy === 'issues') {
      filtered = filtered.filter(ab => {
        // TODO: Update filter for issues
        return ab.isMissing || ab.isInvalid
        // return ab.numMissingParts || ab.numInvalidParts || ab.isMissing || ab.isInvalid
      })
    }

    return filtered
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
      if (mediaMetadata.genres.length) {
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

  getSeriesFromBooks(books, minified = false) {
    var _series = {}
    books.forEach((libraryItem) => {
      var bookSeries = libraryItem.media.metadata.series || []
      bookSeries.forEach((series) => {
        var abJson = minified ? libraryItem.toJSONMinified() : libraryItem.toJSONExpanded()
        abJson.sequence = series.sequence
        if (!_series[series.id]) {
          _series[series.id] = {
            id: series.id,
            name: series.name,
            type: 'series',
            books: [abJson]
          }
        } else {
          _series[series.id].books.push(abJson)
        }
      })
    })
    return Object.values(_series).map((series) => {
      series.books = naturalSort(series.books).asc(li => li.sequence)
      return series
    })
  },

  getSeriesWithProgressFromBooks(user, books) {
    return []
    // var _series = {}
    // books.forEach((audiobook) => {
    //   if (audiobook.book.series) {
    //     var bookWithUserAb = { userAudiobook: user.getMediaProgress(audiobook.id), book: audiobook }
    //     if (!_series[audiobook.book.series]) {
    //       _series[audiobook.book.series] = {
    //         id: audiobook.book.series,
    //         name: audiobook.book.series,
    //         type: 'series',
    //         books: [bookWithUserAb]
    //       }
    //     } else {
    //       _series[audiobook.book.series].books.push(bookWithUserAb)
    //     }
    //   }
    // })
    // return Object.values(_series).map((series) => {
    //   series.books = naturalSort(series.books).asc(ab => ab.book.book.volumeNumber)
    //   return series
    // }).filter((series) => series.books.some((book) => book.userAudiobook && book.userAudiobook.isRead))
  },

  sortSeriesBooks(books, seriesId, minified = false) {
    return naturalSort(books).asc(li => {
      if (!li.media.metadata.series) return null
      var series = li.media.metadata.series.find(se => se.id === seriesId)
      if (!series) return null
      return series.sequence
    }).map(li => {
      if (minified) return li.toJSONMinified()
      return li.toJSONExpanded()
    })
  },

  getMediaProgressWithItems(user, libraryItems) {
    var mediaProgress = []
    libraryItems.forEach(li => {
      var itemProgress = user.getAllMediaProgressForLibraryItem(li.id).map(mp => {
        var episode = null
        if (mp.episodeId) {
          episode = li.media.getEpisode(mp.episodeId)
          if (!episode) {
            // Episode not found for library item
            return null
          }
        }
        return {
          userProgress: mp.toJSON(),
          libraryItem: li,
          episode
        }
      }).filter(mp => !!mp)

      mediaProgress = mediaProgress.concat(itemProgress)
    })
    return mediaProgress
  },

  getItemsMostRecentlyListened(itemsWithUserProgress, limit, minified = false) {
    var itemsInProgress = itemsWithUserProgress.filter((data) => data.userProgress && data.userProgress.progress > 0 && !data.userProgress.isFinished)
    itemsInProgress.sort((a, b) => {
      return b.userProgress.lastUpdate - a.userProgress.lastUpdate
    })
    return itemsInProgress.map(b => {
      var libjson = minified ? b.libraryItem.toJSONMinified() : b.libraryItem.toJSONExpanded()
      if (b.episode) {
        libjson.recentEpisode = b.episode
      }
      return libjson
    }).slice(0, limit)
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

  getItemsMostRecentlyFinished(itemsWithUserProgress, limit, minified = false) {
    var itemsFinished = itemsWithUserProgress.filter((data) => data.userProgress && data.userProgress.isFinished)
    itemsFinished.sort((a, b) => {
      return b.userProgress.finishedAt - a.userProgress.finishedAt
    })
    return itemsFinished.map(i => {
      var libjson = minified ? i.libraryItem.toJSONMinified() : i.libraryItem.toJSONExpanded()
      if (i.episode) {
        libjson.recentEpisode = i.episode
      }
      return libjson
    }).slice(0, limit)
  },

  getItemsMostRecentlyAdded(libraryItems, limit, minified = false) {
    var itemsSortedByAddedAt = sort(libraryItems).desc(li => li.addedAt)
    return itemsSortedByAddedAt.map(b => minified ? b.toJSONMinified() : b.toJSONExpanded()).slice(0, limit)
  },

  getEpisodesRecentlyAdded(libraryItems, limit, minified = false) {
    var libraryItemsWithEpisode = []
    libraryItems.forEach((li) => {
      if (li.mediaType !== 'podcast' || !li.media.hasMediaEntities) return
      var libjson = minified ? li.toJSONMinified() : li.toJSONExpanded()
      var episodes = sort(li.media.episodes || []).desc(ep => ep.addedAt)
      episodes.forEach((ep) => {
        var lie = { ...libjson }
        lie.recentEpisode = ep
        libraryItemsWithEpisode.push(lie)
      })
    })
    libraryItemsWithEpisode = sort(libraryItemsWithEpisode).desc(lie => lie.recentEpisode.addedAt)
    return libraryItemsWithEpisode.slice(0, limit)
  },

  getSeriesMostRecentlyAdded(series, limit) {
    var seriesSortedByAddedAt = sort(series).desc(_series => {
      var booksSortedByMostRecent = sort(_series.books).desc(b => b.addedAt)
      return booksSortedByMostRecent[0].addedAt
    })
    return seriesSortedByAddedAt.slice(0, limit)
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

  getLibraryItemsTotalSize(libraryItems) {
    var totalSize = 0
    libraryItems.forEach((li) => {
      totalSize += li.media.size
    })
    return totalSize
  },

  collapseBookSeries(libraryItems) {
    var seriesObjects = this.getSeriesFromBooks(libraryItems, true)
    var seriesToUse = {}
    var libraryItemIdsToHide = []
    seriesObjects.forEach((series) => {
      series.firstBook = series.books.find(b => !seriesToUse[b.id]) // Find first book not already used
      if (series.firstBook) {
        seriesToUse[series.firstBook.id] = series
        libraryItemIdsToHide = libraryItemIdsToHide.concat(series.books.filter(b => !seriesToUse[b.id]).map(b => b.id))
      }
    })

    return libraryItems.map((li) => {
      if (li.mediaType != 'book') return
      var libraryItemJson = li.toJSONMinified()
      if (libraryItemIdsToHide.includes(li.id)) {
        return null
      }
      if (seriesToUse[li.id]) {
        libraryItemJson.collapsedSeries = {
          id: seriesToUse[li.id].id,
          name: seriesToUse[li.id].name,
          numBooks: seriesToUse[li.id].books.length
        }
      }
      return libraryItemJson
    }).filter(li => li)
  },

  buildPersonalizedShelves(user, libraryItems, mediaType, allSeries, allAuthors, maxEntitiesPerShelf = 10) {
    const isPodcastLibrary = mediaType === 'podcast'


    const shelves = [
      {
        id: 'continue-listening',
        label: 'Continue Listening',
        type: isPodcastLibrary ? 'episode' : mediaType,
        entities: [],
        category: 'recentlyListened'
      },
      {
        id: 'recently-added',
        label: 'Recently Added',
        type: mediaType,
        entities: [],
        category: 'newestItems'
      },
      {
        id: 'listen-again',
        label: 'Listen Again',
        type: isPodcastLibrary ? 'episode' : mediaType,
        entities: [],
        category: 'recentlyFinished'
      },
      {
        id: 'recent-series',
        label: 'Recent Series',
        type: 'series',
        entities: [],
        category: 'newestSeries'
      },
      {
        id: 'newest-authors',
        label: 'Newest Authors',
        type: 'authors',
        entities: [],
        category: 'newestAuthors'
      },
      {
        id: 'episodes-recently-added',
        label: 'Newest Episodes',
        type: 'episode',
        entities: [],
        category: 'newestEpisodes'
      }
    ]

    const categories = ['recentlyListened', 'newestEpisodes', 'newestItems', 'newestSeries', 'recentlyFinished', 'newestAuthors']
    const categoryMap = {}
    categories.forEach((cat) => {
      categoryMap[cat] = {
        category: cat,
        biggest: 0,
        smallest: 0,
        items: []
      }
    })

    const seriesMap = {}
    const authorMap = {}

    for (const libraryItem of libraryItems) {
      if (libraryItem.addedAt > categoryMap.newestItems.smallest) {

        var indexToPut = categoryMap.newestItems.items.findIndex(i => libraryItem.addedAt > i.addedAt)
        if (indexToPut >= 0) {
          categoryMap.newestItems.items.splice(indexToPut, 0, libraryItem.toJSONMinified())
        } else {
          categoryMap.newestItems.items.push(libraryItem.toJSONMinified())
        }

        if (categoryMap.newestItems.items.length > maxEntitiesPerShelf) {
          // Remove last item
          categoryMap.newestItems.items.pop()
          categoryMap.newestItems.smallest = categoryMap.newestItems.items[categoryMap.newestItems.items.length - 1].addedAt
        }
        categoryMap.newestItems.biggest = categoryMap.newestItems.items[0].addedAt
      }

      var allItemProgress = user.getAllMediaProgressForLibraryItem(libraryItem.id)
      if (libraryItem.isPodcast) {
        // Podcast categories
        const podcastEpisodes = libraryItem.media.episodes || []
        for (const episode of podcastEpisodes) {
          // Newest episodes
          if (episode.addedAt > categoryMap.newestEpisodes.smallest) {
            const libraryItemWithEpisode = {
              ...libraryItem.toJSONMinified(),
              recentEpisode: episode.toJSON()
            }

            var indexToPut = categoryMap.newestEpisodes.items.findIndex(i => episode.addedAt > i.recentEpisode.addedAt)
            if (indexToPut >= 0) {
              categoryMap.newestEpisodes.items.splice(indexToPut, 0, libraryItemWithEpisode)
            } else {
              categoryMap.newestEpisodes.items.push(libraryItemWithEpisode)
            }

            if (categoryMap.newestEpisodes.items.length > maxEntitiesPerShelf) {
              // Remove last item
              categoryMap.newestEpisodes.items.pop()
              categoryMap.newestEpisodes.smallest = categoryMap.newestEpisodes.items[categoryMap.newestEpisodes.items.length - 1].recentEpisode.addedAt
            }
            categoryMap.newestEpisodes.biggest = categoryMap.newestEpisodes.items[0].recentEpisode.addedAt
          }

          // Episode recently listened and finished
          var mediaProgress = allItemProgress.find(mp => mp.episodeId === episode.id)
          if (mediaProgress) {
            if (mediaProgress.isFinished) {
              if (mediaProgress.finishedAt > categoryMap.recentlyFinished.smallest) { // Item belongs on shelf
                const libraryItemWithEpisode = {
                  ...libraryItem.toJSONMinified(),
                  recentEpisode: episode.toJSON(),
                  finishedAt: mediaProgress.finishedAt
                }

                var indexToPut = categoryMap.recentlyFinished.items.findIndex(i => mediaProgress.finishedAt > i.finishedAt)
                if (indexToPut >= 0) {
                  categoryMap.recentlyFinished.items.splice(indexToPut, 0, libraryItemWithEpisode)
                } else {
                  categoryMap.recentlyFinished.items.push(libraryItemWithEpisode)
                }

                if (categoryMap.recentlyFinished.items.length > maxEntitiesPerShelf) {
                  // Remove last item
                  categoryMap.recentlyFinished.items.pop()
                  categoryMap.recentlyFinished.smallest = categoryMap.recentlyFinished.items[categoryMap.recentlyFinished.items.length - 1].finishedAt
                }
                categoryMap.recentlyFinished.biggest = categoryMap.recentlyFinished.items[0].finishedAt
              }
            } else if (mediaProgress.progress > 0) { // Handle most recently listened
              if (mediaProgress.lastUpdate > categoryMap.recentlyListened.smallest) { // Item belongs on shelf
                const libraryItemWithEpisode = {
                  ...libraryItem.toJSONMinified(),
                  recentEpisode: episode.toJSON(),
                  progressLastUpdate: mediaProgress.lastUpdate
                }

                var indexToPut = categoryMap.recentlyListened.items.findIndex(i => mediaProgress.lastUpdate > i.progressLastUpdate)
                if (indexToPut >= 0) {
                  categoryMap.recentlyListened.items.splice(indexToPut, 0, libraryItemWithEpisode)
                } else {
                  categoryMap.recentlyListened.items.push(libraryItemWithEpisode)
                }

                if (categoryMap.recentlyListened.items.length > maxEntitiesPerShelf) {
                  // Remove last item
                  categoryMap.recentlyListened.items.pop()
                  categoryMap.recentlyListened.smallest = categoryMap.recentlyListened.items[categoryMap.recentlyListened.items.length - 1].progressLastUpdate
                }

                categoryMap.recentlyListened.biggest = categoryMap.recentlyListened.items[0].progressLastUpdate
              }
            }
          }
        }
      } else {
        // Book categories

        // Newest series
        if (libraryItem.media.metadata.series.length) {
          for (const librarySeries of libraryItem.media.metadata.series) {

            if (!seriesMap[librarySeries.id]) {
              const seriesObj = allSeries.find(se => se.id === librarySeries.id)
              if (seriesObj) {
                var series = {
                  ...seriesObj.toJSON(),
                  books: []
                }

                if (series.addedAt > categoryMap.newestSeries.smallest) {
                  const libraryItemJson = libraryItem.toJSONMinified()
                  libraryItemJson.seriesSequence = librarySeries.sequence
                  series.books.push(libraryItemJson)

                  var indexToPut = categoryMap.newestSeries.items.findIndex(i => series.addedAt > i.addedAt)
                  if (indexToPut >= 0) {
                    categoryMap.newestSeries.items.splice(indexToPut, 0, series)
                  } else {
                    categoryMap.newestSeries.items.push(series)
                  }

                  // Max series is 5
                  if (categoryMap.newestSeries.items.length > 5) {
                    categoryMap.newestSeries.items.pop()
                    categoryMap.newestSeries.smallest = categoryMap.newestSeries.items[categoryMap.newestSeries.items.length - 1].addedAt
                  }

                  categoryMap.newestSeries.biggest = categoryMap.newestSeries.items[0].addedAt

                  seriesMap[librarySeries.id] = series
                }
              }
            } else {
              // series already in map - add book
              const libraryItemJson = libraryItem.toJSONMinified()
              libraryItemJson.seriesSequence = librarySeries.sequence
              seriesMap[librarySeries.id].books.push(libraryItemJson)
            }
          }
        }

        // Newest authors
        if (libraryItem.media.metadata.authors.length) {
          for (const libraryAuthor of libraryItem.media.metadata.authors) {
            if (!authorMap[libraryAuthor.id]) {
              const authorObj = allAuthors.find(au => au.id === libraryAuthor.id)
              if (authorObj) {
                var author = {
                  ...authorObj.toJSON(),
                  numBooks: 1
                }

                if (author.addedAt > categoryMap.newestAuthors.smallest) {

                  var indexToPut = categoryMap.newestAuthors.items.findIndex(i => author.addedAt > i.addedAt)
                  if (indexToPut >= 0) {
                    categoryMap.newestAuthors.items.splice(indexToPut, 0, author)
                  } else {
                    categoryMap.newestAuthors.items.push(author)
                  }

                  // Max authors is 10
                  if (categoryMap.newestAuthors.items.length > 10) {
                    categoryMap.newestAuthors.items.pop()
                    categoryMap.newestAuthors.smallest = categoryMap.newestAuthors.items[categoryMap.newestAuthors.items.length - 1].addedAt
                  }

                  categoryMap.newestAuthors.biggest = categoryMap.newestAuthors.items[0].addedAt
                }

                authorMap[libraryAuthor.id] = author
              }
            } else {
              authorMap[libraryAuthor.id].numBooks++
            }
          }
        }

        // Book listening and finished
        var mediaProgress = allItemProgress.length ? allItemProgress[0] : null
        if (mediaProgress) {
          // Handle most recently finished
          if (mediaProgress.isFinished) {
            if (mediaProgress.finishedAt > categoryMap.recentlyFinished.smallest) { // Item belongs on shelf
              const libraryItemObj = {
                ...libraryItem.toJSONMinified(),
                finishedAt: mediaProgress.finishedAt
              }

              var indexToPut = categoryMap.recentlyFinished.items.findIndex(i => mediaProgress.finishedAt > i.finishedAt)
              if (indexToPut >= 0) {
                categoryMap.recentlyFinished.items.splice(indexToPut, 0, libraryItemObj)
              } else {
                categoryMap.recentlyFinished.items.push(libraryItemObj)
              }
              if (categoryMap.recentlyFinished.items.length > maxEntitiesPerShelf) {
                // Remove last item
                categoryMap.recentlyFinished.items.pop()
                categoryMap.recentlyFinished.smallest = categoryMap.recentlyFinished.items[categoryMap.recentlyFinished.items.length - 1].finishedAt
              }
              categoryMap.recentlyFinished.biggest = categoryMap.recentlyFinished.items[0].finishedAt
            }
          } else if (mediaProgress.inProgress) { // Handle most recently listened
            if (mediaProgress.lastUpdate > categoryMap.recentlyListened.smallest) { // Item belongs on shelf
              const libraryItemObj = {
                ...libraryItem.toJSONMinified(),
                progressLastUpdate: mediaProgress.lastUpdate
              }

              var indexToPut = categoryMap.recentlyListened.items.findIndex(i => mediaProgress.lastUpdate > i.progressLastUpdate)
              if (indexToPut >= 0) {
                categoryMap.recentlyListened.items.splice(indexToPut, 0, libraryItemObj)
              } else { // Should only happen when array is < max
                categoryMap.recentlyListened.items.push(libraryItemObj)
              }
              if (categoryMap.recentlyListened.items.length > maxEntitiesPerShelf) {
                // Remove last item
                categoryMap.recentlyListened.items.pop()
                categoryMap.recentlyListened.smallest = categoryMap.recentlyListened.items[categoryMap.recentlyListened.items.length - 1].progressLastUpdate
              }
              categoryMap.recentlyListened.biggest = categoryMap.recentlyListened.items[0].progressLastUpdate
            }
          }
        }
      }
    }

    // Sort series books by sequence
    if (categoryMap.newestSeries.items.length) {
      for (const seriesItem of categoryMap.newestSeries.items) {
        seriesItem.books = naturalSort(seriesItem.books).asc(li => li.seriesSequence)
      }
    }

    var categoriesWithItems = Object.values(categoryMap).filter(cat => cat.items.length)

    return categoriesWithItems.map(cat => {
      var shelf = shelves.find(s => s.category === cat.category)
      shelf.entities = cat.items
      return shelf
    })
  }
}