export const state = () => ({
  user: null,
  accessToken: null,
  settings: {
    orderBy: 'media.metadata.title',
    orderDesc: false,
    filterBy: 'all',
    playbackRate: 1,
    playbackRateIncrementDecrement: 0.1,
    bookshelfCoverSize: 120,
    collapseSeries: false,
    collapseBookSeries: false,
    showSubtitles: false,
    useChapterTrack: false,
    seriesSortBy: 'name',
    seriesSortDesc: false,
    seriesFilterBy: 'all',
    authorSortBy: 'name',
    authorSortDesc: false,
    jumpForwardAmount: 10,
    jumpBackwardAmount: 10
  }
})

export const getters = {
  getIsRoot: (state) => state.user && state.user.type === 'root',
  getIsAdminOrUp: (state) => state.user && (state.user.type === 'admin' || state.user.type === 'root'),
  getToken: (state) => {
    return state.accessToken || null
  },
  getUserMediaProgress:
    (state) =>
    (libraryItemId, episodeId = null) => {
      if (!state.user?.mediaProgress) return null
      return state.user.mediaProgress.find((li) => {
        if (episodeId && li.episodeId !== episodeId) return false
        return li.libraryItemId == libraryItemId
      })
    },
  getUserBookmarksForItem: (state) => (libraryItemId) => {
    if (!state.user?.bookmarks) return []
    return state.user.bookmarks.filter((bm) => bm.libraryItemId === libraryItemId)
  },
  getUserSetting: (state) => (key) => {
    return state.settings?.[key] || null
  },
  getUserCanUpdate: (state) => {
    return !!state.user?.permissions?.update
  },
  getUserCanDelete: (state) => {
    return !!state.user?.permissions?.delete
  },
  getUserCanDownload: (state) => {
    return !!state.user?.permissions?.download
  },
  getUserCanUpload: (state) => {
    return !!state.user?.permissions?.upload
  },
  getUserCanAccessAllLibraries: (state) => {
    return !!state.user?.permissions?.accessAllLibraries
  },
  getUserCanAccessExplicitContent: (state) => {
    return !!state.user?.permissions?.accessExplicitContent
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
  },
  getSizeMultiplier: (state) => {
    return state.settings.bookshelfCoverSize / 120
  }
}

export const actions = {
  // When changing libraries make sure sort and filter is still valid
  checkUpdateLibrarySortFilter({ state, dispatch, commit }, mediaType) {
    const settingsUpdate = {}
    if (mediaType == 'podcast') {
      if (state.settings.orderBy == 'media.metadata.authorName' || state.settings.orderBy == 'media.metadata.authorNameLF') {
        settingsUpdate.orderBy = 'media.metadata.author'
      }
      if (state.settings.orderBy == 'media.duration') {
        settingsUpdate.orderBy = 'media.numTracks'
      }
      if (state.settings.orderBy == 'media.metadata.publishedYear' || state.settings.orderBy == 'progress') {
        settingsUpdate.orderBy = 'media.metadata.title'
      }
      const invalidFilters = ['series', 'authors', 'narrators', 'publishers', 'publishedDecades', 'languages', 'progress', 'issues', 'ebooks', 'abridged']
      const filterByFirstPart = (state.settings.filterBy || '').split('.').shift()
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
  updateUserSettings({ state, commit }, payload) {
    if (!payload) return false

    let hasChanges = false
    const existingSettings = { ...state.settings }
    for (const key in existingSettings) {
      if (payload[key] !== undefined && existingSettings[key] !== payload[key]) {
        hasChanges = true
        existingSettings[key] = payload[key]
      }
    }
    if (hasChanges) {
      commit('setSettings', existingSettings)
      this.$eventBus.$emit('user-settings', state.settings)
    }
  },
  loadUserSettings({ state, commit }) {
    // Load settings from local storage
    try {
      let userSettingsFromLocal = localStorage.getItem('userSettings')
      if (userSettingsFromLocal) {
        userSettingsFromLocal = JSON.parse(userSettingsFromLocal)
        const userSettings = { ...state.settings }
        for (const key in userSettings) {
          if (userSettingsFromLocal[key] !== undefined) {
            userSettings[key] = userSettingsFromLocal[key]
          }
        }
        commit('setSettings', userSettings)
        this.$eventBus.$emit('user-settings', state.settings)
      }
    } catch (error) {
      console.error('Failed to load userSettings from local storage', error)
    }
  },
  refreshToken({ state, commit }) {
    return this.$axios
      .$post('/auth/refresh')
      .then(async (response) => {
        const newAccessToken = response.user.accessToken
        commit('setAccessToken', newAccessToken)
        // Emit event used to re-authenticate socket in default.vue since $root is not available here
        if (this.$eventBus) {
          this.$eventBus.$emit('token_refreshed', newAccessToken)
        }
        return newAccessToken
      })
      .catch((error) => {
        console.error('Failed to refresh token', error)
        commit('setUser', null)
        commit('setAccessToken', null)
        // Calling function handles redirect to login
        throw error
      })
  }
}

export const mutations = {
  setUser(state, user) {
    state.user = user
  },
  setAccessToken(state, token) {
    if (!token) {
      localStorage.removeItem('token')
      state.accessToken = null
    } else {
      state.accessToken = token
      localStorage.setItem('token', token)
    }
  },
  updateMediaProgress(state, { id, data }) {
    if (!state.user) return
    if (!data) {
      state.user.mediaProgress = state.user.mediaProgress.filter((lip) => lip.id != id)
    } else {
      var indexOf = state.user.mediaProgress.findIndex((lip) => lip.id == id)
      if (indexOf >= 0) {
        state.user.mediaProgress.splice(indexOf, 1, data)
      } else {
        state.user.mediaProgress.push(data)
      }
    }
  },
  setSettings(state, settings) {
    if (!settings) return
    localStorage.setItem('userSettings', JSON.stringify(settings))
    state.settings = settings
  }
}
