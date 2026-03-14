const { createNewSortInstance } = require('../libs/fastSort')
const { getTitlePrefixAtEnd, isNullOrNaN, getTitleIgnorePrefix } = require('../utils/index')

const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

function getSeriesFromBooks(libraryItems, filterSeries, hideSingleBookSeries) {
  const seriesById = {}

  libraryItems.forEach((libraryItem) => {
    const allBookSeries = libraryItem.media.series || []
    if (!allBookSeries.length) return

    allBookSeries.forEach((bookSeries) => {
      const itemJson = libraryItem.toOldJSONMinified()
      itemJson.sequence = bookSeries.bookSeries.sequence
      if (filterSeries) {
        const filteredSeries = libraryItem.media.series.find((series) => series.id === filterSeries)
        itemJson.filterSeriesSequence = filteredSeries?.bookSeries?.sequence
      }

      if (!seriesById[bookSeries.id]) {
        seriesById[bookSeries.id] = {
          id: bookSeries.id,
          name: bookSeries.name,
          nameIgnorePrefix: getTitlePrefixAtEnd(bookSeries.name),
          nameIgnorePrefixSort: getTitleIgnorePrefix(bookSeries.name),
          type: 'series',
          books: [itemJson],
          totalDuration: isNullOrNaN(itemJson.media.duration) ? 0 : Number(itemJson.media.duration)
        }
      } else {
        seriesById[bookSeries.id].books.push(itemJson)
        seriesById[bookSeries.id].totalDuration += isNullOrNaN(itemJson.media.duration) ? 0 : Number(itemJson.media.duration)
      }
    })
  })

  let seriesItems = Object.values(seriesById)
  if (hideSingleBookSeries) {
    seriesItems = seriesItems.filter((series) => series.books.length > 1)
  }

  return seriesItems.map((series) => {
    series.books = naturalSort(series.books).asc((libraryItem) => libraryItem.sequence)
    return series
  })
}

function collapseBookSeries(libraryItems, filterSeries, hideSingleBookSeries) {
  const seriesObjects = getSeriesFromBooks(libraryItems, filterSeries, hideSingleBookSeries).filter((series) => series.id !== filterSeries)
  const filteredLibraryItems = []

  libraryItems.forEach((libraryItem) => {
    if (libraryItem.mediaType && libraryItem.mediaType !== 'book') return

    seriesObjects
      .filter((series) => series.books[0].id === libraryItem.id)
      .forEach((series) => {
        filteredLibraryItems.push(Object.assign(Object.create(Object.getPrototypeOf(libraryItem)), libraryItem, { collapsedSeries: series }))
      })

    if (!seriesObjects.some((series) => series.books.some((book) => book.id === libraryItem.id))) {
      filteredLibraryItems.push(libraryItem)
    }
  })

  return filteredLibraryItems
}

function getSeriesSequenceList(collapsedSeries) {
  return naturalSort(collapsedSeries.books.filter((book) => book.filterSeriesSequence).map((book) => book.filterSeriesSequence))
    .asc()
    .reduce((ranges, currentSequence) => {
      const lastRange = ranges.at(-1)
      const isNumber = /^(\d+|\d+\.\d*|\d*\.\d+)$/.test(currentSequence)
      const normalizedSequence = isNumber ? parseFloat(currentSequence) : currentSequence

      if (lastRange && isNumber && lastRange.isNumber && lastRange.end + 1 === normalizedSequence) {
        lastRange.end = normalizedSequence
      } else {
        ranges.push({ start: normalizedSequence, end: normalizedSequence, isNumber })
      }

      return ranges
    }, [])
    .map((range) => (range.start === range.end ? range.start : `${range.start}-${range.end}`))
    .join(', ')
}

module.exports = {
  async toCollapsedSeriesPayload(libraryItems, seriesId, hideSingleBookSeries = false) {
    const shapedItems = libraryItems.some((libraryItem) => libraryItem.collapsedSeries)
      ? libraryItems
      : (() => {
          const collapsedItems = collapseBookSeries(libraryItems, seriesId, hideSingleBookSeries)
          return !(collapsedItems.length === 1 && collapsedItems[0].collapsedSeries) ? collapsedItems : libraryItems
        })()

    return Promise.all(
      shapedItems.map(async (libraryItem) => {
        const filteredSeries = libraryItem.media.series.find((series) => series.id === seriesId)
        const json = libraryItem.toOldJSONMinified()

        if (filteredSeries) {
          json.media.metadata.series = {
            id: filteredSeries.id,
            name: filteredSeries.name,
            sequence: filteredSeries.bookSeries.sequence
          }
        }

        if (libraryItem.collapsedSeries) {
          json.collapsedSeries = {
            id: libraryItem.collapsedSeries.id,
            name: libraryItem.collapsedSeries.name,
            nameIgnorePrefix: libraryItem.collapsedSeries.nameIgnorePrefix,
            libraryItemIds: libraryItem.collapsedSeries.books.map((book) => book.id),
            numBooks: libraryItem.collapsedSeries.books.length,
            seriesSequenceList: getSeriesSequenceList(libraryItem.collapsedSeries)
          }
        }

        if (libraryItem.rssFeed?.toOldJSONMinified) {
          json.rssFeed = libraryItem.rssFeed.toOldJSONMinified()
        }

        return json
      })
    )
  }
}
