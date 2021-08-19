
export const state = () => ({
  settings: {
    orderBy: 'book.title',
    orderDesc: false,
    filterBy: 'all'
  },

  listeners: []
})

export const getters = {
  getFilterOrderKey: (state) => {
    return Object.values(state.settings).join('-')
  }
}

export const actions = {

}

export const mutations = {
  setSettings(state, settings) {
    state.settings = {
      ...settings
    }
    state.listeners.forEach((listener) => {
      listener.meth()
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