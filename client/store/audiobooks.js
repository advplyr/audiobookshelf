import { sort } from '@/assets/fastSort'

const STANDARD_GENRES = ['adventure', 'autobiography', 'biography', 'childrens', 'comedy', 'crime', 'dystopian', 'fantasy', 'fiction', 'health', 'history', 'horror', 'mystery', 'new_adult', 'nonfiction', 'philosophy', 'politics', 'religion', 'romance', 'sci-fi', 'self-help', 'short_story', 'technology', 'thriller', 'true_crime', 'western', 'young_adult']

export const state = () => ({
  audiobooks: [],
  listeners: [],
  genres: [...STANDARD_GENRES],
  tags: []
})

export const getters = {
  getFiltered: (state, getters, rootState) => () => {
    var filtered = state.audiobooks
    var settings = rootState.settings.settings || {}
    var filterBy = settings.filterBy || ''
    var filterByParts = filterBy.split('.')
    if (filterByParts.length > 1) {
      var primary = filterByParts[0]
      var secondary = filterByParts[1]
      if (primary === 'genres') {
        filtered = filtered.filter(ab => {
          return ab.book && ab.book.genres.includes(secondary)
        })
      } else if (primary === 'tags') {
        filtered = filtered.filter(ab => ab.tags.includes(secondary))
      }
    }
    // TODO: Add filters
    return filtered
  },
  getFilteredAndSorted: (state, getters, rootState) => () => {
    var settings = rootState.settings.settings
    var direction = settings.orderDesc ? 'desc' : 'asc'

    var filtered = getters.getFiltered()
    return sort(filtered)[direction]((ab) => {
      // Supports dot notation strings i.e. "book.title"
      return settings.orderBy.split('.').reduce((a, b) => a[b], ab)
    })
  }
}

export const actions = {
  load({ commit }) {
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
  set(state, audiobooks) {
    // GENRES
    var genres = [...state.genres]
    audiobooks.forEach((ab) => {
      if (!ab.book) return
      genres = genres.concat(ab.book.genres)
    })
    state.genres = [...new Set(genres)] // Remove Duplicates

    // TAGS
    var tags = []
    audiobooks.forEach((ab) => {
      tags = tags.concat(ab.tags)
    })
    state.tags = [...new Set(tags)] // Remove Duplicates

    state.audiobooks = audiobooks
    state.listeners.forEach((listener) => {
      listener.meth()
    })
  },
  addUpdate(state, audiobook) {
    var index = state.audiobooks.findIndex(a => a.id === audiobook.id)
    if (index >= 0) {
      state.audiobooks.splice(index, 1, audiobook)
    } else {
      state.audiobooks.push(audiobook)
    }

    // GENRES
    if (audiobook.book) {
      var newGenres = []
      audiobook.book.genres.forEach((genre) => {
        if (!state.genres.includes(genre)) newGenres.push(genre)
      })
      if (newGenres.length) state.genres = state.genres.concat(newGenres)
    }

    // TAGS
    var newTags = []
    audiobook.tags.forEach((tag) => {
      if (!state.tags.includes(tag)) newTags.push(tag)
    })
    if (newTags.length) state.tags = state.tags.concat(newTags)


    state.listeners.forEach((listener) => {
      if (!listener.audiobookId || listener.audiobookId === audiobook.id) {
        listener.meth()
      }
    })
  },
  remove(state, audiobook) {
    state.audiobooks = state.audiobooks.filter(a => a.id !== audiobook.id)

    // GENRES
    if (audiobook.book) {
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