export const state = () => ({
  isListening: false,
  logs: []
})

export const getters = {

}

export const actions = {
  setLogListener({ state, commit, dispatch }) {
    dispatch('$nuxtSocket/emit', {
      label: 'main',
      evt: 'set_log_listener',
      msg: 0
    }, { root: true })
    commit('setIsListening', true)
  }
}

export const mutations = {
  setIsListening(state, val) {
    state.isListening = val
  },
  logEvt(state, payload) {
    state.logs.push(payload)
    if (state.logs.length > 500) {
      state.logs = state.logs.slice(50)
    }
  }
}