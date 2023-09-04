const { createNewSortInstance } = require('../libs/fastSort')
const Database = require('../Database')
const { getTitlePrefixAtEnd, isNullOrNaN, getTitleIgnorePrefix } = require('../utils/index')
const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

module.exports = {
  getSeriesFromBooks(books, filterSeries, hideSingleBookSeries) {
    const _series = {}
    const seriesToFilterOut = {}
    books.forEach((libraryItem) => {
      // get all book series for item that is not already filtered out
      const bookSeries = (libraryItem.media.metadata.series || []).filter(se => !seriesToFilterOut[se.id])
      if (!bookSeries.length) return

      bookSeries.forEach((bookSeriesObj) => {
        // const series = allSeries.find(se => se.id === bookSeriesObj.id)

        const abJson = libraryItem.toJSONMinified()
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

    return seriesItems.map((series) => {
      series.books = naturalSort(series.books).asc(li => li.sequence)
      return series
    })
  },

  collapseBookSeries(libraryItems, filterSeries, hideSingleBookSeries) {
    // Get series from the library items. If this list is being collapsed after filtering for a series,
    // don't collapse that series, only books that are in other series.
    const seriesObjects = this
      .getSeriesFromBooks(libraryItems, filterSeries, hideSingleBookSeries)
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

  async handleCollapseSubseries(payload, seriesId, user, library) {
    const seriesWithBooks = await Database.seriesModel.findByPk(seriesId, {
      include: {
        model: Database.bookModel,
        through: {
          attributes: ['sequence']
        },
        include: [
          {
            model: Database.libraryItemModel
          },
          {
            model: Database.authorModel,
            through: {
              attributes: []
            }
          },
          {
            model: Database.seriesModel,
            through: {
              attributes: ['sequence']
            }
          }
        ]
      }
    })
    if (!seriesWithBooks) {
      payload.total = 0
      return []
    }


    const books = seriesWithBooks.books
    payload.total = books.length

    let libraryItems = books.map((book) => {
      const libraryItem = book.libraryItem
      libraryItem.media = book
      return Database.libraryItemModel.getOldLibraryItem(libraryItem)
    }).filter(li => {
      return user.checkCanAccessLibraryItem(li)
    })

    const collapsedItems = this.collapseBookSeries(libraryItems, seriesId, library.settings.hideSingleBookSeries)
    if (!(collapsedItems.length == 1 && collapsedItems[0].collapsedSeries)) {
      libraryItems = collapsedItems
      payload.total = libraryItems.length
    }

    const sortArray = [
      {
        asc: (li) => li.media.metadata.getSeries(seriesId).sequence
      },
      { // If no series sequence then fallback to sorting by title (or collapsed series name for sub-series)
        asc: (li) => {
          if (Database.serverSettings.sortingIgnorePrefix) {
            return li.collapsedSeries?.nameIgnorePrefix || li.media.metadata.titleIgnorePrefix
          } else {
            return li.collapsedSeries?.name || li.media.metadata.title
          }
        }
      }
    ]

    libraryItems = naturalSort(libraryItems).by(sortArray)

    if (payload.limit) {
      const startIndex = payload.page * payload.limit
      libraryItems = libraryItems.slice(startIndex, startIndex + payload.limit)
    }

    return Promise.all(libraryItems.map(async li => {
      const filteredSeries = li.media.metadata.getSeries(seriesId)
      const json = li.toJSONMinified()
      json.media.metadata.series = {
        id: filteredSeries.id,
        sequence: filteredSeries.sequence
      }

      if (li.collapsedSeries) {
        json.collapsedSeries = {
          id: li.collapsedSeries.id,
          name: li.collapsedSeries.name,
          nameIgnorePrefix: li.collapsedSeries.nameIgnorePrefix,
          libraryItemIds: li.collapsedSeries.books.map(b => b.id),
          numBooks: li.collapsedSeries.books.length
        }

        // If collapsing by series and filtering by a series, generate the list of sequences the collapsed
        // series represents in the filtered series
        json.collapsedSeries.seriesSequenceList =
          naturalSort(li.collapsedSeries.books.filter(b => b.filterSeriesSequence).map(b => b.filterSeriesSequence)).asc()
            .reduce((ranges, currentSequence) => {
              let lastRange = ranges.at(-1)
              let isNumber = /^(\d+|\d+\.\d*|\d*\.\d+)$/.test(currentSequence)
              if (isNumber) currentSequence = parseFloat(currentSequence)

              if (lastRange && isNumber && lastRange.isNumber && ((lastRange.end + 1) == currentSequence)) {
                lastRange.end = currentSequence
              }
              else {
                ranges.push({ start: currentSequence, end: currentSequence, isNumber: isNumber })
              }

              return ranges
            }, [])
            .map(r => r.start == r.end ? r.start : `${r.start}-${r.end}`)
            .join(', ')
      }

      return json
    }))
  }
}
