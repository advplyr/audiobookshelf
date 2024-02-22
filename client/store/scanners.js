export const state = () => ({
  providers: [
    {
      text: 'Google Books',
      value: 'google'
    },
    {
      text: 'Open Library',
      value: 'openlibrary'
    },
    {
      text: 'iTunes',
      value: 'itunes'
    },
    {
      text: 'Audible.com',
      value: 'audible'
    },
    {
      text: 'Audible.ca',
      value: 'audible.ca'
    },
    {
      text: 'Audible.co.uk',
      value: 'audible.uk'
    },
    {
      text: 'Audible.com.au',
      value: 'audible.au'
    },
    {
      text: 'Audible.fr',
      value: 'audible.fr'
    },
    {
      text: 'Audible.de',
      value: 'audible.de'
    },
    {
      text: 'Audible.co.jp',
      value: 'audible.jp'
    },
    {
      text: 'Audible.it',
      value: 'audible.it'
    },
    {
      text: 'Audible.co.in',
      value: 'audible.in'
    },
    {
      text: 'Audible.es',
      value: 'audible.es'
    },
    {
      text: 'FantLab.ru',
      value: 'fantlab'
    }
  ],
  podcastProviders: [
    {
      text: 'iTunes',
      value: 'itunes'
    }
  ],
  coverOnlyProviders: [
    {
      text: 'AudiobookCovers.com',
      value: 'audiobookcovers'
    }
  ]
})

export const getters = {
  checkBookProviderExists: state => (providerValue) => {
    return state.providers.some(p => p.value === providerValue)
  },
  checkPodcastProviderExists: state => (providerValue) => {
    return state.podcastProviders.some(p => p.value === providerValue)
  }
}

export const actions = {}

export const mutations = {
  addCustomMetadataProvider(state, provider) {
    if (provider.mediaType === 'book') {
      if (state.providers.some(p => p.value === provider.slug)) return
      state.providers.push({
        text: provider.name,
        value: provider.slug
      })
    } else {
      if (state.podcastProviders.some(p => p.value === provider.slug)) return
      state.podcastProviders.push({
        text: provider.name,
        value: provider.slug
      })
    }
  },
  removeCustomMetadataProvider(state, provider) {
    if (provider.mediaType === 'book') {
      state.providers = state.providers.filter(p => p.value !== provider.slug)
    } else {
      state.podcastProviders = state.podcastProviders.filter(p => p.value !== provider.slug)
    }
  },
  setCustomMetadataProviders(state, providers) {
    if (!providers?.length) return

    const mediaType = providers[0].mediaType
    if (mediaType === 'book') {
      // clear previous values, and add new values to the end
      state.providers = state.providers.filter((p) => !p.value.startsWith('custom-'))
      state.providers = [
        ...state.providers,
        ...providers.map((p) => ({
          text: p.name,
          value: p.slug
        }))
      ]
    } else {
      // Podcast providers not supported yet
    }
  }
}