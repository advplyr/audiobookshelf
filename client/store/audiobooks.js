const STANDARD_GENRES = ['Adventure', 'Autobiography', 'Biography', 'Childrens', 'Comedy', 'Crime', 'Dystopian', 'Fantasy', 'Fiction', 'Health', 'History', 'Horror', 'Mystery', 'New Adult', 'Nonfiction', 'Philosophy', 'Politics', 'Religion', 'Romance', 'Sci-Fi', 'Self-Help', 'Short Story', 'Technology', 'Thriller', 'True Crime', 'Western', 'Young Adult']

export const state = () => ({
  audiobooks: [],
  loadedLibraryId: '',
  listeners: [],
  genres: [...STANDARD_GENRES],
  tags: [],
  series: [],
  keywordFilter: null,
  selectedSeries: null
})

export const getters = {
  getBookCoverSrc: (state, getters, rootState, rootGetters) => (bookItem, placeholder = '/book_placeholder.jpg') => {
    if (!bookItem) return placeholder
    var book = bookItem.book
    if (!book || !book.cover || book.cover === placeholder) return placeholder

    // Absolute URL covers (should no longer be used)
    if (book.cover.startsWith('http:') || book.cover.startsWith('https:')) return book.cover

    var userToken = rootGetters['user/getToken']
    var bookLastUpdate = book.lastUpdate || Date.now()

    if (process.env.NODE_ENV !== 'production') { // Testing
      return `http://localhost:3333/api/books/${bookItem.id}/cover?token=${userToken}&ts=${bookLastUpdate}`
    }
    return `/api/books/${bookItem.id}/cover?token=${userToken}`
  }
}

export const actions = {

}

export const mutations = {
  setKeywordFilter(state, val) {
    state.keywordFilter = val
  },
  setSelectedSeries(state, val) {
    state.selectedSeries = val
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
  },
  audiobookUpdated(state, audiobook) {
    state.listeners.forEach((listener) => {
      if (!listener.audiobookId || listener.audiobookId === audiobook.id) {
        listener.meth()
      }
    })
  }
}