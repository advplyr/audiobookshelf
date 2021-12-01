import { sort } from '@/assets/fastSort'
import { decode } from '@/plugins/init.client'

const STANDARD_GENRES = ['Adventure', 'Autobiography', 'Biography', 'Childrens', 'Comedy', 'Crime', 'Dystopian', 'Fantasy', 'Fiction', 'Health', 'History', 'Horror', 'Mystery', 'New Adult', 'Nonfiction', 'Philosophy', 'Politics', 'Religion', 'Romance', 'Sci-Fi', 'Self-Help', 'Short Story', 'Technology', 'Thriller', 'True Crime', 'Western', 'Young Adult']

export const state = () => ({
  audiobooks: [],
  loadedLibraryId: '',
  lastLoad: 0,
  listeners: [],
  genres: [...STANDARD_GENRES],
  tags: [],
  series: [],
  keywordFilter: null,
  selectedSeries: null,
  libraryPage: null,
  searchResults: {},
  searchResultAudiobooks: []
})

export const getters = {
  getAudiobook: (state) => id => {
    return state.audiobooks.find(ab => ab.id === id)
  },
  getAudiobooksWithIssues: (state) => {
    return state.audiobooks.filter(ab => {
      return ab.hasMissingParts || ab.hasInvalidParts || ab.isMissing || ab.isIncomplete
    })
  },
  getEntitiesShowing: (state, getters, rootState, rootGetters) => () => {
    if (!state.libraryPage) {
      return getters.getFiltered()
    } else if (state.libraryPage === 'search') {
      return state.searchResultAudiobooks
    } else if (state.libraryPage === 'series') {
      var series = getters.getSeriesGroups()
      if (state.selectedSeries) {
        var _series = series.find(__series => __series.name === state.selectedSeries)
        if (!_series) return []
        return _series.books || []
      }
      return series
    }
    return []
  },
  getFiltered: (state, getters, rootState, rootGetters) => () => {
    var filtered = state.audiobooks
    var settings = rootState.user.settings || {}
    var filterBy = settings.filterBy || ''

    var searchGroups = ['genres', 'tags', 'series', 'authors', 'progress', 'narrators']
    var group = searchGroups.find(_group => filterBy.startsWith(_group + '.'))
    if (group) {
      var filterVal = filterBy.replace(`${group}.`, '')
      var filter = decode(filterVal)
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
          var userAudiobook = rootGetters['user/getUserAudiobook'](ab.id)
          var isRead = userAudiobook && userAudiobook.isRead
          if (filter === 'Read' && isRead) return true
          if (filter === 'Unread' && !isRead) return true
          if (filter === 'In Progress' && (userAudiobook && !userAudiobook.isRead && userAudiobook.progress > 0)) return true
          return false
        })
      }
    } else if (filterBy === 'issues') {
      filtered = filtered.filter(ab => {
        return ab.hasMissingParts || ab.hasInvalidParts || ab.isMissing || ab.isIncomplete
      })
    }

    if (state.keywordFilter) {
      const keywordFilterKeys = ['title', 'subtitle', 'author', 'series', 'narrator']
      const keyworkFilter = state.keywordFilter.toLowerCase()
      return filtered.filter(ab => {
        if (!ab.book) return false
        return !!keywordFilterKeys.find(key => (ab.book[key] && ab.book[key].toLowerCase().includes(keyworkFilter)))
      })
    }
    return filtered
  },
  getFilteredAndSorted: (state, getters, rootState) => () => {
    var settings = rootState.user.settings
    var direction = settings.orderDesc ? 'desc' : 'asc'

    var filtered = getters.getFiltered()

    var orderByNumber = settings.orderBy === 'book.volumeNumber'
    return sort(filtered)[direction]((ab) => {
      // Supports dot notation strings i.e. "book.title"
      var value = settings.orderBy.split('.').reduce((a, b) => a[b], ab)
      if (orderByNumber && !isNaN(value)) return Number(value)
      return value
    })
  },
  getSeriesGroups: (state, getters, rootState) => () => {
    var series = {}
    state.audiobooks.forEach((audiobook) => {
      if (audiobook.book && audiobook.book.series) {
        if (series[audiobook.book.series]) {
          var bookLastUpdate = audiobook.book.lastUpdate
          if (bookLastUpdate > series[audiobook.book.series].lastUpdate) series[audiobook.book.series].lastUpdate = bookLastUpdate
          series[audiobook.book.series].books.push(audiobook)
        } else {
          series[audiobook.book.series] = {
            type: 'series',
            name: audiobook.book.series || '',
            books: [audiobook],
            lastUpdate: audiobook.book.lastUpdate
          }
        }
      }
    })
    var seriesArray = Object.values(series).map((_series) => {
      _series.books = sort(_series.books)['asc']((ab) => {
        return ab.book && ab.book.volumeNumber && !isNaN(ab.book.volumeNumber) ? Number(ab.book.volumeNumber) : null
      })
      return _series
    })
    if (state.keywordFilter) {
      const keywordFilter = state.keywordFilter.toLowerCase()
      return seriesArray.filter((_series) => _series.name.toLowerCase().includes(keywordFilter))
    }
    return seriesArray
  },
  getUniqueAuthors: (state) => {
    var abAuthors = []
    state.audiobooks.forEach((ab) => {
      if (ab.book && ab.book.authorFL) {
        abAuthors = abAuthors.concat(ab.book.authorFL.split(', '))
      }
    })
    return [...new Set(abAuthors)].sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)
  },
  getUniqueNarrators: (state) => {
    var narrators = []
    state.audiobooks.forEach((ab) => {
      if (ab.book && ab.book.narratorFL) {
        narrators = narrators.concat(ab.book.narratorFL.split(', '))
      }
    })
    return [...new Set(narrators)].sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)
  },
  getGenresUsed: (state) => {
    var _genres = []
    state.audiobooks.filter(ab => !!(ab.book && ab.book.genres)).forEach(ab => _genres = _genres.concat(ab.book.genres))
    return [...new Set(_genres)].sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)
  },
  getBookCoverSrc: (state, getters, rootState, rootGetters) => (bookItem, placeholder = '/book_placeholder.jpg') => {
    if (!bookItem) return placeholder
    var book = bookItem.book
    if (!book || !book.cover || book.cover === placeholder) return placeholder
    var cover = book.cover

    // Absolute URL covers (should no longer be used)
    if (cover.startsWith('http:') || cover.startsWith('https:')) return cover

    // Server hosted covers
    try {
      // Ensure cover is refreshed if cached
      var bookLastUpdate = book.lastUpdate || Date.now()
      var userToken = rootGetters['user/getToken']

      cover = cover.replace(/\\/g, '/')

      // Map old covers to new format /s/book/{bookid}/*
      if (cover.startsWith('/local')) {
        cover = cover.replace('local', `s/book/${bookItem.id}`)
        if (cover.includes(bookItem.path + '/')) { // Remove book path
          cover = cover.replace(bookItem.path + '/', '')
        }
      }

      // Easier to replace these special characters then to encodeUriComponent of the filename
      var encodedCover = cover.replace(/%/g, '%25').replace(/#/g, '%23')

      var url = new URL(encodedCover, document.baseURI)
      return url.href + `?token=${userToken}&ts=${bookLastUpdate}`
    } catch (err) {
      console.error(err)
      return placeholder
    }
  }
}

export const actions = {
  // Return true if calling load
  load({ state, commit, rootState }) {
    if (!rootState.user || !rootState.user.user) {
      console.error('audiobooks/load - User not set')
      return false
    }

    var currentLibraryId = rootState.libraries.currentLibraryId

    if (currentLibraryId === state.loadedLibraryId) {
      // Don't load again if already loaded in the last 5 minutes
      var lastLoadDiff = Date.now() - state.lastLoad
      if (lastLoadDiff < 5 * 60 * 1000) {
        // Already up to date
        return false
      }
    }
    commit('setLoadedLibrary', currentLibraryId)

    this.$axios
      .$get(`/api/libraries/${currentLibraryId}/books`)
      .then((data) => {
        commit('set', data)
        commit('setLastLoad')

      })
      .catch((error) => {
        console.error('Failed', error)
        commit('set', [])
      })
    return true
  }
}

export const mutations = {
  setLoadedLibrary(state, val) {
    state.loadedLibraryId = val
  },
  setLastLoad(state) {
    state.lastLoad = Date.now()
  },
  setKeywordFilter(state, val) {
    state.keywordFilter = val
  },
  setSelectedSeries(state, val) {
    state.selectedSeries = val
  },
  setLibraryPage(state, val) {
    state.libraryPage = val
  },
  setSearchResults(state, val) {
    state.searchResults = val
    state.searchResultAudiobooks = val && val.audiobooks ? val.audiobooks.map(ab => ab.audiobook) : []
  },
  set(state, audiobooks) {
    // GENRES
    var genres = [...state.genres]
    audiobooks.forEach((ab) => {
      if (!ab.book) return
      genres = genres.concat(ab.book.genres)
    })
    state.genres = [...new Set(genres)] // Remove Duplicates
    state.genres.sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)

    // TAGS
    var tags = []
    audiobooks.forEach((ab) => {
      tags = tags.concat(ab.tags)
    })
    state.tags = [...new Set(tags)] // Remove Duplicates
    state.tags.sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)

    // SERIES
    var series = []
    audiobooks.forEach((ab) => {
      if (!ab.book || !ab.book.series || series.includes(ab.book.series)) return
      series.push(ab.book.series)
    })
    state.series = series
    state.series.sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)

    state.audiobooks = audiobooks
    state.listeners.forEach((listener) => {
      listener.meth()
    })
  },
  addUpdate(state, audiobook) {
    if (state.loadedLibraryId && audiobook.libraryId !== state.loadedLibraryId) {
      console.warn('Invalid library', audiobook, 'loaded library', state.loadedLibraryId, '"')
      return
    }

    var index = state.audiobooks.findIndex(a => a.id === audiobook.id)
    var origAudiobook = null
    if (index >= 0) {
      origAudiobook = { ...state.audiobooks[index] }
      state.audiobooks.splice(index, 1, audiobook)
    } else {
      state.audiobooks.push(audiobook)
    }

    if (audiobook.book) {
      // GENRES
      var newGenres = []
      audiobook.book.genres.forEach((genre) => {
        if (!state.genres.includes(genre)) newGenres.push(genre)
      })
      if (newGenres.length) {
        state.genres = state.genres.concat(newGenres)
        state.genres.sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)
      }

      // SERIES
      if (audiobook.book.series && !state.series.includes(audiobook.book.series)) {
        state.series.push(audiobook.book.series)
        state.series.sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)
      }
      if (origAudiobook && origAudiobook.book && origAudiobook.book.series) {
        var isInAB = state.audiobooks.find(ab => ab.book && ab.book.series === origAudiobook.book.series)
        if (!isInAB) state.series = state.series.filter(series => series !== origAudiobook.book.series)
      }
    }

    // TAGS
    var newTags = []
    audiobook.tags.forEach((tag) => {
      if (!state.tags.includes(tag)) newTags.push(tag)
    })
    if (newTags.length) {
      state.tags = state.tags.concat(newTags)
      state.tags.sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)
    }

    state.listeners.forEach((listener) => {
      if (!listener.audiobookId || listener.audiobookId === audiobook.id) {
        listener.meth()
      }
    })
  },
  remove(state, audiobook) {
    state.audiobooks = state.audiobooks.filter(a => a.id !== audiobook.id)

    if (audiobook.book) {
      // GENRES
      audiobook.book.genres.forEach((genre) => {
        if (!STANDARD_GENRES.includes(genre)) {
          var isInOtherAB = state.audiobooks.find(ab => {
            return ab.book && ab.book.genres.includes(genre)
          })
          if (!isInOtherAB) {
            // Genre is not used by any other audiobook - remove it
            state.genres = state.genres.filter(g => g !== genre)
          }
        }
      })

      // SERIES
      if (audiobook.book.series) {
        var isInOtherAB = state.audiobooks.find(ab => ab.book && ab.book.series === audiobook.book.series)
        if (!isInOtherAB) {
          // Series not used in any other audiobook - remove it
          state.series = state.series.filter(s => s !== audiobook.book.series)
        }
      }
    }

    // TAGS
    audiobook.tags.forEach((tag) => {
      var isInOtherAB = state.audiobooks.find(ab => {
        return ab.tags.includes(tag)
      })
      if (!isInOtherAB) {
        // Tag is not used by any other audiobook - remove it
        state.tags = state.tags.filter(t => t !== tag)
      }
    })

    state.listeners.forEach((listener) => {
      if (!listener.audiobookId || listener.audiobookId === audiobook.id) {
        listener.meth()
      }
    })
  },
  addListener(state, listener) {
    var index = state.listeners.findIndex(l => l.id === listener.id)
    if (index >= 0) state.listeners.splice(index, 1, listener)
    else state.listeners.push(listener)
  },
  removeListener(state, listenerId) {
    state.listeners = state.listeners.filter(l => l.id !== listenerId)
  }
}