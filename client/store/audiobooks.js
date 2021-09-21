import { sort } from '@/assets/fastSort'
import { decode } from '@/plugins/init.client'

const STANDARD_GENRES = ['Adventure', 'Autobiography', 'Biography', 'Childrens', 'Comedy', 'Crime', 'Dystopian', 'Fantasy', 'Fiction', 'Health', 'History', 'Horror', 'Mystery', 'New Adult', 'Nonfiction', 'Philosophy', 'Politics', 'Religion', 'Romance', 'Sci-Fi', 'Self-Help', 'Short Story', 'Technology', 'Thriller', 'True Crime', 'Western', 'Young Adult']

export const state = () => ({
  audiobooks: [],
  listeners: [],
  genres: [...STANDARD_GENRES],
  tags: [],
  series: [],
  keywordFilter: null
})

export const getters = {
  getAudiobook: (state) => id => {
    return state.audiobooks.find(ab => ab.id === id)
  },
  getFiltered: (state, getters, rootState, rootGetters) => () => {
    var filtered = state.audiobooks
    var settings = rootState.user.settings || {}
    var filterBy = settings.filterBy || ''

    var searchGroups = ['genres', 'tags', 'series', 'authors', 'progress']
    var group = searchGroups.find(_group => filterBy.startsWith(_group + '.'))
    if (group) {
      var filter = decode(filterBy.replace(`${group}.`, ''))
      if (group === 'genres') filtered = filtered.filter(ab => ab.book && ab.book.genres.includes(filter))
      else if (group === 'tags') filtered = filtered.filter(ab => ab.tags.includes(filter))
      else if (group === 'series') filtered = filtered.filter(ab => ab.book && ab.book.series === filter)
      else if (group === 'authors') filtered = filtered.filter(ab => ab.book && ab.book.author === filter)
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
    }
    if (state.keywordFilter) {
      const keywordFilterKeys = ['title', 'subtitle', 'author', 'series', 'narrarator']
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
  getUniqueAuthors: (state) => {
    var _authors = state.audiobooks.filter(ab => !!(ab.book && ab.book.author)).map(ab => ab.book.author)
    return [...new Set(_authors)].sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)
  },
  getGenresUsed: (state) => {
    var _genres = []
    state.audiobooks.filter(ab => !!(ab.book && ab.book.genres)).forEach(ab => _genres = _genres.concat(ab.book.genres))
    return [...new Set(_genres)].sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)
  }
}

export const actions = {
  load({ commit, rootState }) {
    if (!rootState.user || !rootState.user.user) {
      console.error('audiobooks/load - User not set')
      return
    }
    this.$axios
      .$get(`/api/audiobooks`)
      .then((data) => {
        commit('set', data)
      })
      .catch((error) => {
        console.error('Failed', error)
        commit('set', [])
      })
  },

}

export const mutations = {
  setKeywordFilter(state, val) {
    state.keywordFilter = val
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