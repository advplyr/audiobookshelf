export const state = () => ({
  bookProviders: [],
  podcastProviders: [],
  bookCoverProviders: [],
  podcastCoverProviders: [],
  providersLoaded: false
})

export const getters = {
  checkBookProviderExists: (state) => (providerValue) => {
    return state.bookProviders.some((p) => p.value === providerValue)
  },
  checkPodcastProviderExists: (state) => (providerValue) => {
    return state.podcastProviders.some((p) => p.value === providerValue)
  },
  areProvidersLoaded: (state) => state.providersLoaded
}

export const actions = {
  async fetchProviders({ commit, state }) {
    // Only fetch if not already loaded
    if (state.providersLoaded) {
      return
    }

    try {
      const response = await this.$axios.$get('/api/search/providers')
      if (response?.providers) {
        commit('setAllProviders', response.providers)
      }
    } catch (error) {
      console.error('Failed to fetch providers', error)
    }
  },
  async refreshProviders({ commit, state }) {
    // if providers are not loaded, do nothing - they will be fetched when required (
    if (!state.providersLoaded) {
      return
    }

    try {
      const response = await this.$axios.$get('/api/search/providers')
      if (response?.providers) {
        commit('setAllProviders', response.providers)
      }
    } catch (error) {
      console.error('Failed to refresh providers', error)
    }
  }
}

export const mutations = {
  setAllProviders(state, providers) {
    state.bookProviders = providers.books || []
    state.podcastProviders = providers.podcasts || []
    state.bookCoverProviders = providers.booksCovers || []
    state.podcastCoverProviders = providers.podcasts || [] // Use same as bookCovers since podcasts use iTunes only
    state.providersLoaded = true
  }
}
