const { sort } = require('fast-sort')

module.exports = {
  decode(text) {
    return Buffer.from(decodeURIComponent(text), 'base64').toString()
  },

  getFiltered(audiobooks, filterBy, user) {
    var filtered = audiobooks

    var searchGroups = ['genres', 'tags', 'series', 'authors', 'progress', 'narrators']
    var group = searchGroups.find(_group => filterBy.startsWith(_group + '.'))
    if (group) {
      var filterVal = filterBy.replace(`${group}.`, '')
      var filter = this.decode(filterVal)
      if (group === 'genres') filtered = filtered.filter(ab => ab.book && ab.book.genres.includes(filter))
      else if (group === 'tags') filtered = filtered.filter(ab => ab.tags.includes(filter))
      else if (group === 'series') {
        if (filter === 'No Series') filtered = filtered.filter(ab => ab.book && !ab.book.series)
        else filtered = filtered.filter(ab => ab.book && ab.book.series === filter)
      }
      else if (group === 'authors') filtered = filtered.filter(ab => ab.book && ab.book.authorFL && ab.book.authorFL.split(', ').includes(filter))
      else if (group === 'narrators') filtered = filtered.filter(ab => ab.book && ab.book.narratorFL && ab.book.narratorFL.split(', ').includes(filter))
      else if (group === 'progress') {
        filtered = filtered.filter(ab => {
          var userAudiobook = user.getAudiobookJSON(ab.id)
          var isRead = userAudiobook && userAudiobook.isRead
          if (filter === 'Read' && isRead) return true
          if (filter === 'Unread' && !isRead) return true
          if (filter === 'In Progress' && (userAudiobook && !userAudiobook.isRead && userAudiobook.progress > 0)) return true
          return false
        })
      }
    } else if (filterBy === 'issues') {
      filtered = filtered.filter(ab => {
        return ab.numMissingParts || ab.numInvalidParts || ab.isMissing || ab.isInvalid
      })
    }

    return filtered
  },

  getDistinctFilterData(audiobooks) {
    var data = {
      authors: [],
      genres: [],
      tags: [],
      series: [],
      narrators: []
    }
    audiobooks.forEach((ab) => {
      if (ab.book._authorsList.length) {
        ab.book._authorsList.forEach((author) => {
          if (author && !data.authors.includes(author)) data.authors.push(author)
        })
      }
      if (ab.book._genres.length) {
        ab.book._genres.forEach((genre) => {
          if (genre && !data.genres.includes(genre)) data.genres.push(genre)
        })
      }
      if (ab.tags.length) {
        ab.tags.forEach((tag) => {
          if (tag && !data.tags.includes(tag)) data.tags.push(tag)
        })
      }
      if (ab.book._series && !data.series.includes(ab.book._series)) data.series.push(ab.book._series)
      if (ab.book._narratorsList.length) {
        ab.book._narratorsList.forEach((narrator) => {
          if (narrator && !data.narrators.includes(narrator)) data.narrators.push(narrator)
        })
      }
    })
    return data
  },

  getSeriesFromBooks(books) {
    var _series = {}
    books.forEach((audiobook) => {
      if (audiobook.book.series) {
        if (!_series[audiobook.book.series]) {
          _series[audiobook.book.series] = {
            id: audiobook.book.series,
            name: audiobook.book.series,
            type: 'series',
            books: [audiobook.toJSONExpanded()]
          }
        } else {
          _series[audiobook.book.series].books.push(audiobook.toJSONExpanded())
        }
      }
    })
    return Object.values(_series).map((series) => {
      series.books = sort(series.books).asc(ab => {
        if (!isNaN(ab.book.volumeNumber) && ab.book.volumeNumber !== null) return Number(ab.book.volumeNumber)
        return ab.book.volumeNumber
      })
      return series
    })
  },

  getBooksWithUserAudiobook(user, books) {
    return books.map(book => {
      return {
        userAudiobook: user.getAudiobookJSON(book.id),
        book
      }
    })
  },

  getBooksMostRecentlyRead(booksWithUserAb, limit) {
    var booksWithProgress = booksWithUserAb.filter((data) => data.userAudiobook && data.userAudiobook.progress > 0 && !data.userAudiobook.isRead)
    booksWithProgress.sort((a, b) => {
      return b.userAudiobook.lastUpdate - a.userAudiobook.lastUpdate
    })
    return booksWithProgress.map(b => b.book.toJSONExpanded()).slice(0, limit)
  },

  getBooksMostRecentlyAdded(books, limit) {
    var booksSortedByAddedAt = sort(books).desc(book => book.addedAt)
    return booksSortedByAddedAt.map(b => b.toJSONExpanded()).slice(0, limit)
  },

  getBooksMostRecentlyFinished(booksWithUserAb, limit) {
    var booksRead = booksWithUserAb.filter((data) => data.userAudiobook && data.userAudiobook.isRead)
    booksRead.sort((a, b) => {
      return b.userAudiobook.finishedAt - a.userAudiobook.finishedAt
    })
    return booksRead.map(b => b.book.toJSONExpanded()).slice(0, limit)
  },

  getSeriesMostRecentlyAdded(series, limit) {
    var seriesSortedByAddedAt = sort(series).desc(_series => {
      var booksSortedByMostRecent = sort(_series.books).desc(b => b.addedAt)
      return booksSortedByMostRecent[0].addedAt
    })
    return seriesSortedByAddedAt.slice(0, limit)
  },

  getGenresWithCount(audiobooks) {
    var genresMap = {}
    audiobooks.forEach((ab) => {
      var genres = ab.book.genres || []
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

  getAuthorsWithCount(audiobooks) {
    var authorsMap = {}
    audiobooks.forEach((ab) => {
      var authors = ab.book.authorFL ? ab.book.authorFL.split(', ') : []
      authors.forEach((author) => {
        if (authorsMap[author]) authorsMap[author].count++
        else
          authorsMap[author] = {
            author,
            count: 1
          }
      })
    })
    return Object.values(authorsMap).sort((a, b) => b.count - a.count)
  },

  getAudiobooksTotalDuration(audiobooks) {
    var totalDuration = 0
    audiobooks.forEach((ab) => {
      totalDuration += ab.duration
    })
    return totalDuration
  },

  getAudiobooksTotalSize(audiobooks) {
    var totalSize = 0
    audiobooks.forEach((ab) => {
      totalSize += ab.size
    })
    return totalSize
  },

  getNumIssues(books) {
    return books.filter(ab => {
      return ab.numMissingParts || ab.numInvalidParts || ab.isMissing || ab.isInvalid
    }).length
  }
}