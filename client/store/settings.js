export const state = () => ({
  SSOSettings: null,
  serverSettings: null
})

export const getters = {
  getServerSetting: state => key => {
    if (!state.serverSettings) return null
    return state.serverSettings[key]
  },
  getBookCoverAspectRatio: state => {
    if (!state.serverSettings || !state.serverSettings.coverAspectRatio) return 1.6
    return state.serverSettings.coverAspectRatio === 0 ? 1.6 : 1
  }
}

export const actions = {
  updateServerSettings({ commit }, payload) {
    var updatePayload = {
      ...payload
    }
    return this.$axios.$patch('/api/serverSettings', updatePayload).then((result) => {
      if (result.success) {
        commit('setServerSettings', result.serverSettings)
        return true
      } else {
        return false
      }
    }).catch((error) => {
      console.error('Failed to update server settings', error)
      return false
    })
  },
  updateSSOSettings({ commit }, payload) {
    var updatePayload = {
      ...payload
    }
    // Immediately update
    commit('setSSOSettings', updatePayload)
    return this.$axios.$patch('/api/SSOSettings', updatePayload).then((result) => {
      if (result.success) {
        commit('setSSOSettings', result.settings)
        return true
      } else {
        return false
      }
    }).catch((error) => {
      console.error('Failed to update sso settings', error)
      return false
    })
  }
}

export const mutations = {
  setServerSettings(state, settings) {
    if (!settings) return
    state.serverSettings = settings
  },
  setSSOSettings(state, settings) {
    if (!settings || !settings.oidc || !settings.user) return
    state.SSOSettings = settings
  }
}