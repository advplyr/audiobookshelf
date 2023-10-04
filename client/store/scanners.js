export const state = () => ({
  libraryScans: [],
  providers: [
    {
      text: 'Google Books',
      value: 'google'
    },
    {
      text: 'Kindle',
      value: 'kindle'
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
  getLibraryScan: state => id => {
    return state.libraryScans.find(ls => ls.id === id)
  }
}

export const actions = {

}

export const mutations = {
  addUpdate(state, data) {
    var index = state.libraryScans.findIndex(lib => lib.id === data.id)
    if (index >= 0) {
      state.libraryScans.splice(index, 1, data)
    } else {
      state.libraryScans.push(data)
    }
  },
  remove(state, data) {
    state.libraryScans = state.libraryScans.filter(scan => scan.id !== data.id)
  }
}
