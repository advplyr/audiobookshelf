export const state = () => ({
  libraryScans: [],
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
      text: 'Audible',
      value: 'audible'
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