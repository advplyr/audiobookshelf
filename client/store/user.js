
export const state = () => ({
  user: null,
  settings: {
    orderBy: 'book.title',
    orderDesc: false,
    filterBy: 'all',
    playbackRate: 1,
    bookshelfCoverSize: 120
  },
  settingsListeners: []
})

export const getters = {
  getIsRoot: (state) => state.user && state.user.type === 'root',
  getToken: (state) => {
    return state.user ? state.user.token : null
  },
  getUserAudiobook: (state) => (audiobookId) => {
    return state.user && state.user.audiobooks ? state.user.audiobooks[audiobookId] || null : null
  },
  getUserSetting: (state) => (key) => {
    return state.settings ? state.settings[key] || null : null
  },
  getFilterOrderKey: (state) => {
    return Object.values(state.settings).join('-')
  },
  getUserCanUpdate: (state) => {
    return state.user && state.user.permissions ? !!state.user.permissions.update : false
  },
  getUserCanDelete: (state) => {
    return state.user && state.user.permissions ? !!state.user.permissions.delete : false
  },
  getUserCanDownload: (state) => {
    return state.user && state.user.permissions ? !!state.user.permissions.download : false
  },
  getUserCanUpload: (state) => {
    return state.user && state.user.permissions ? !!state.user.permissions.upload : false
  }
}

export const actions = {
  updateUserSettings({ commit }, payload) {
    var updatePayload = {
      ...payload
    }
    return this.$axios.$patch('/api/user/settings', updatePayload).then((result) => {
      if (result.success) {
        commit('setSettings', result.settings)
        return true
      } else {
        return false
      }
    }).catch((error) => {
      console.error('Failed to update settings', error)
      return false
    })
  }
}

export const mutations = {
  setUser(state, user) {
    state.user = user
    if (user) {
      if (user.token) localStorage.setItem('token', user.token)
    } else {
      localStorage.removeItem('token')
    }
  },
  setSettings(state, settings) {
    if (!settings) return

    var hasChanges = false
    for (const key in settings) {
      if (state.settings[key] !== settings[key]) {
        hasChanges = true
        state.settings[key] = settings[key]
      }
    }
    if (hasChanges) {
      state.settingsListeners.forEach((listener) => {
        listener.meth(state.settings)
      })
    }
  },
  addSettingsListener(state, listener) {
    var index = state.settingsListeners.findIndex(l => l.id === listener.id)
    if (index >= 0) state.settingsListeners.splice(index, 1, listener)
    else state.settingsListeners.push(listener)
  },
  removeSettingsListener(state, listenerId) {
    state.settingsListeners = state.settingsListeners.filter(l => l.id !== listenerId)
  }
}