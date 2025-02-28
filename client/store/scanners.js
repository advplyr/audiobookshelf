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
      text: 'AudiMeta.com (Audible)',
      value: 'audimeta.us'
    },
    {
      text: 'Audible.com',
      value: 'audible'
    },
    {
      text: 'AudiMeta.ca (Audible)',
      value: 'audimeta.ca'
    },
    {
      text: 'Audible.ca',
      value: 'audible.ca'
    },
    {
      text: 'AudiMeta.co.uk (Audible)',
      value: 'audimeta.uk'
    },
    {
      text: 'Audible.co.uk',
      value: 'audible.uk'
    },
    {
      text: 'AudiMeta.com.au (Audible)',
      value: 'audimeta.au'
    },
    {
      text: 'Audible.com.au',
      value: 'audible.au'
    },
    {
      text: 'AudiMeta.fr (Audible)',
      value: 'audimeta.fr'
    },
    {
      text: 'Audible.fr',
      value: 'audible.fr'
    },
    {
      text: 'AudiMeta.de (Audible)',
      value: 'audimeta.de'
    },
    {
      text: 'Audible.de',
      value: 'audible.de'
    },
    {
      text: 'AudiMeta.jp (Audible)',
      value: 'audimeta.jp'
    },
    {
      text: 'Audible.co.jp',
      value: 'audible.jp'
    },
    {
      text: 'AudiMeta.it (Audible)',
      value: 'audimeta.it'
    },
    {
      text: 'Audible.it',
      value: 'audible.it'
    },
    {
      text: 'AudiMeta.co.in (Audible)',
      value: 'audimeta.in'
    },
    {
      text: 'Audible.co.in',
      value: 'audible.in'
    },
    {
      text: 'AudiMeta.es (Audible)',
      value: 'audimeta.es'
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
