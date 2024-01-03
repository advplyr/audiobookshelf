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

export const getters = {}

export const actions = {
  reFetchCustom({ dispatch, commit }) {
    return this.$axios
        .$get(`/api/custom-metadata-providers`)
        .then((data) => {
          const providers = data.providers

          commit('setCustomProviders', providers)
          return data
        })
        .catch((error) => {
          console.error('Failed', error)
          return false
        })
  },
}

export const mutations = {
  setCustomProviders(state, providers) {
    // clear previous values, and add new values to the end
    state.providers = state.providers.filter((p) => !p.value.startsWith("custom-"));
    state.providers = [
        ...state.providers,
        ...providers.map((p) => {return {
          text: p.name,
          value: p.slug,
        }})
    ]
  },
}