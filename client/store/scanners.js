export const state = () => ({
  bookProviders: [],
  podcastProviders: [],
  bookCoverProviders: [],
  podcastCoverProviders: []
})

export const getters = {
  checkBookProviderExists: (state) => (providerValue) => {
    return state.bookProviders.some((p) => p.value === providerValue)
  },
  checkPodcastProviderExists: (state) => (providerValue) => {
    return state.podcastProviders.some((p) => p.value === providerValue)
  }
}

export const actions = {
  async fetchBookProviders({ commit }) {
    try {
      const response = await this.$axios.$get('/api/search/providers/books')
      if (response?.providers) {
        commit('setBookProviders', response.providers)
      }
    } catch (error) {
      console.error('Failed to fetch book providers', error)
    }
  },
  async fetchPodcastProviders({ commit }) {
    try {
      const response = await this.$axios.$get('/api/search/providers/podcasts')
      if (response?.providers) {
        commit('setPodcastProviders', response.providers)
      }
    } catch (error) {
      console.error('Failed to fetch podcast providers', error)
    }
  },
  async fetchBookCoverProviders({ commit }) {
    try {
      const response = await this.$axios.$get('/api/search/providers/books/covers')
      if (response?.providers) {
        commit('setBookCoverProviders', response.providers)
      }
    } catch (error) {
      console.error('Failed to fetch book cover providers', error)
    }
  },
  async fetchPodcastCoverProviders({ commit }) {
    try {
      const response = await this.$axios.$get('/api/search/providers/podcasts/covers')
      if (response?.providers) {
        commit('setPodcastCoverProviders', response.providers)
      }
    } catch (error) {
      console.error('Failed to fetch podcast cover providers', error)
    }
  }
}

export const mutations = {
  setBookProviders(state, providers) {
    state.bookProviders = providers
  },
  setPodcastProviders(state, providers) {
    state.podcastProviders = providers
  },
  setBookCoverProviders(state, providers) {
    state.bookCoverProviders = providers
  },
  setPodcastCoverProviders(state, providers) {
    state.podcastCoverProviders = providers
  }
}
