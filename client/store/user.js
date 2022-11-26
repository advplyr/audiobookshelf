export const state = () => ({
  user: null,
  settings: {
    orderBy: 'media.metadata.title',
    orderDesc: false,
    filterBy: 'all',
    playbackRate: 1,
    bookshelfCoverSize: 120,
    collapseSeries: false,
    collapseBookSeries: false
  },
  settingsListeners: [],
  playlists: []
})

export const getters = {
  getIsRoot: (state) => state.user && state.user.type === 'root',
  getIsAdminOrUp: (state) => state.user && (state.user.type === 'admin' || state.user.type === 'root'),
  getToken: (state) => {
    return state.user ? state.user.token : null
  },
  getUserMediaProgress: (state) => (libraryItemId, episodeId = null) => {
    if (!state.user.mediaProgress) return null
    return state.user.mediaProgress.find(li => {
      if (episodeId && li.episodeId !== episodeId) return false
      return li.libraryItemId == libraryItemId
    })
  },
  getUserBookmarksForItem: (state) => (libraryItemId) => {
    if (!state.user.bookmarks) return []
    return state.user.bookmarks.filter(bm => bm.libraryItemId === libraryItemId)
  },
  getUserSetting: (state) => (key) => {
    return state.settings ? state.settings[key] : null
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
  },
  getUserCanAccessAllLibraries: (state) => {
    return state.user && state.user.permissions ? !!state.user.permissions.accessAllLibraries : false
  },
  getLibrariesAccessible: (state, getters) => {
    if (!state.user) return []
    if (getters.getUserCanAccessAllLibraries) return []
    return state.user.librariesAccessible || []
  },
  getCanAccessLibrary: (state, getters) => (libraryId) => {
    if (!state.user) return false
    if (getters.getUserCanAccessAllLibraries) return true
    return getters.getLibrariesAccessible.includes(libraryId)
  },
  getIsSeriesRemovedFromContinueListening: (state) => (seriesId) => {
    if (!state.user || !state.user.seriesHideFromContinueListening || !state.user.seriesHideFromContinueListening.length) return false
    return state.user.seriesHideFromContinueListening.includes(seriesId)
  }
}

export const actions = {
  // When changing libraries make sure sort and filter is still valid
  checkUpdateLibrarySortFilter({ state, dispatch, commit }, mediaType) {
    var settingsUpdate = {}
    if (mediaType == 'podcast') {
      if (state.settings.orderBy == 'media.metadata.authorName' || state.settings.orderBy == 'media.metadata.authorNameLF') {
        settingsUpdate.orderBy = 'media.metadata.author'
      }
      if (state.settings.orderBy == 'media.duration') {
        settingsUpdate.orderBy = 'media.numTracks'
      }
      if (state.settings.orderBy == 'media.metadata.publishedYear') {
        settingsUpdate.orderBy = 'media.metadata.title'
      }
      var invalidFilters = ['series', 'authors', 'narrators', 'languages', 'progress', 'issues']
      var filterByFirstPart = (state.settings.filterBy || '').split('.').shift()
      if (invalidFilters.includes(filterByFirstPart)) {
        settingsUpdate.filterBy = 'all'
      }
    } else {
      if (state.settings.orderBy == 'media.metadata.author') {
        settingsUpdate.orderBy = 'media.metadata.authorName'
      }
      if (state.settings.orderBy == 'media.numTracks') {
        settingsUpdate.orderBy = 'media.duration'
      }
    }
    if (Object.keys(settingsUpdate).length) {
      dispatch('updateUserSettings', settingsUpdate)
    }
  },
  updateUserSettings({ commit }, payload) {
    var updatePayload = {
      ...payload
    }
    // Immediately update
    commit('setSettings', updatePayload)
    return this.$axios.$patch('/api/me/settings', updatePayload).then((result) => {
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
    state.settings = user.settings
    if (user) {
      if (user.token) localStorage.setItem('token', user.token)
    } else {
      localStorage.removeItem('token')
    }
  },
  setUserToken(state, token) {
    state.user.token = token
    localStorage.setItem('token', user.token)
  },
  updateMediaProgress(state, { id, data }) {
    if (!state.user) return
    if (!data) {
      state.user.mediaProgress = state.user.mediaProgress.filter(lip => lip.id != id)
    } else {
      var indexOf = state.user.mediaProgress.findIndex(lip => lip.id == id)
      if (indexOf >= 0) {
        state.user.mediaProgress.splice(indexOf, 1, data)
      } else {
        state.user.mediaProgress.push(data)
      }
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
  },
  setPlaylists(state, playlists) {
    state.playlists = playlists
  },
  addUpdatePlaylist(state, playlist) {
    const indexOf = state.playlists.findIndex(p => p.id == playlist.id)
    if (indexOf >= 0) {
      state.playlists.splice(indexOf, 1, playlist)
    } else {
      state.playlists.push(playlist)
    }
  },
  removePlaylist(state, playlist) {
    state.playlists = state.playlists.filter(p => p.id !== playlist.id)
  }
}