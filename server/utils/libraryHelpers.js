const { createNewSortInstance } = require('../libs/fastSort')
const Database = require('../Database')
const { getTitlePrefixAtEnd, isNullOrNaN, getTitleIgnorePrefix } = require('../utils/index')
const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

module.exports = {
  decode(text) {
    return Buffer.from(decodeURIComponent(text), 'base64').toString()
  },

  async getFilteredLibraryItems(libraryItems, filterBy, user) {
    let filtered = libraryItems

    const searchGroups = ['genres', 'tags', 'series', 'authors', 'progress', 'narrators', 'publishers', 'missing', 'languages', 'tracks', 'ebooks']
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
      else if (group === 'publishers') filtered = filtered.filter(li => li.isBook && li.media.metadata.publisher === filter)
      else if (group === 'progress') {
        filtered = filtered.filter(li => {
          const itemProgress = user.getMediaProgress(li.id)
          if (filter === 'finished' && (itemProgress && itemProgress.isFinished)) return true
          if (filter === 'not-started' && (!itemProgress || itemProgress.notStarted)) return true
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
        if (filter === 'none') filtered = filtered.filter(li => li.isBook && !li.media.numTracks)
        else if (filter === 'single') filtered = filtered.filter(li => li.isBook && li.media.numTracks === 1)
        else if (filter === 'multi') filtered = filtered.filter(li => li.isBook && li.media.numTracks > 1)
      } else if (group === 'ebooks') {
        if (filter === 'ebook') filtered = filtered.filter(li => li.media.ebookFile)
        else if (filter === 'supplementary') filtered = filtered.filter(li => li.libraryFiles.some(lf => lf.isEBookFile && lf.ino !== li.media.ebookFile?.ino))
      }
    } else if (filterBy === 'issues') {
      filtered = filtered.filter(li => li.hasIssues)
    } else if (filterBy === 'feed-open') {
      const libraryItemIdsWithFeed = await Database.models.feed.findAllLibraryItemIds()
      filtered = filtered.filter(li => libraryItemIdsWithFeed.includes(li.id))
    } else if (filterBy === 'abridged') {
      filtered = filtered.filter(li => !!li.media.metadata?.abridged)
    } else if (filterBy === 'ebook') {
      filtered = filtered.filter(li => li.media.ebookFile)
    }

    return filtered
  },

  // Returns false if should be filtered out
  checkFilterForSeriesLibraryItem(libraryItem, filterBy) {
    const searchGroups = ['genres', 'tags', 'authors', 'progress', 'narrators', 'publishers', 'languages']
    const group = searchGroups.find(_group => filterBy.startsWith(_group + '.'))
    if (group) {
      const filterVal = filterBy.replace(`${group}.`, '')
      const filter = this.decode(filterVal)

      if (group === 'genres') return libraryItem.media.metadata.genres.includes(filter)
      else if (group === 'tags') return libraryItem.media.tags.includes(filter)
      else if (group === 'authors') return libraryItem.isBook && libraryItem.media.metadata.hasAuthor(filter)
      else if (group === 'narrators') return libraryItem.isBook && libraryItem.media.metadata.hasNarrator(filter)
      else if (group === 'publishers') return libraryItem.isBook && libraryItem.media.metadata.publisher === filter
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

  getSeriesFromBooks(books, allSeries, filterSeries, filterBy, user, minified, hideSingleBookSeries) {
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

    // Library setting to hide series with only 1 book
    if (hideSingleBookSeries) {
      seriesItems = seriesItems.filter(se => se.books.length > 1)
    }

    // check progress filter
    if (filterBy && filterBy.startsWith('progress.') && user) {
      seriesItems = seriesItems.filter(se => this.checkSeriesProgressFilter(se, filterBy, user))
    }

    return seriesItems.map((series) => {
      series.books = naturalSort(series.books).asc(li => li.sequence)
      return series
    })
  },

  collapseBookSeries(libraryItems, series, filterSeries, hideSingleBookSeries) {
    // Get series from the library items. If this list is being collapsed after filtering for a series,
    // don't collapse that series, only books that are in other series.
    const seriesObjects = this
      .getSeriesFromBooks(libraryItems, series, filterSeries, null, null, true, hideSingleBookSeries)
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
  }
}
