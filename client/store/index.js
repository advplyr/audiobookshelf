import { checkForUpdate, currentVersion } from '@/plugins/version'
import Vue from 'vue'
const { Constants } = require('../plugins/constants')

export const state = () => ({
  Source: null,
  versionData: null,
  serverSettings: null,
  playbackSessionId: null,
  streamLibraryItem: null,
  streamEpisodeId: null,
  streamIsPlaying: false,
  playerQueueItems: [],
  playerQueueAutoPlay: true,
  playerIsFullscreen: false,
  editModalTab: 'details',
  editPodcastModalTab: 'details',
  showEditModal: false,
  showEReader: false,
  ereaderKeepProgress: false,
  ereaderFileId: null,
  selectedLibraryItem: null,
  developerMode: false,
  processingBatch: false,
  previousPath: '/',
  bookshelfBookIds: [],
  episodeTableEpisodeIds: [],
  openModal: null,
  innerModalOpen: false,
  lastBookshelfScrollData: {},
  routerBasePath: '/'
})

export const getters = {
  getServerSetting: (state) => (key) => {
    if (!state.serverSettings) return null
    return state.serverSettings[key]
  },
  getLibraryItemIdStreaming: (state) => {
    return state.streamLibraryItem?.id || null
  },
  getIsStreamingFromDifferentLibrary: (state, getters, rootState) => {
    if (!state.streamLibraryItem) return false
    return state.streamLibraryItem.libraryId !== rootState.libraries.currentLibraryId
  },
  getIsMediaStreaming: (state) => (libraryItemId, episodeId) => {
    if (!state.streamLibraryItem) return null
    if (!episodeId) return state.streamLibraryItem.id == libraryItemId
    return state.streamLibraryItem.id == libraryItemId && state.streamEpisodeId == episodeId
  },
  getIsMediaQueued: (state) => (libraryItemId, episodeId) => {
    return state.playerQueueItems.some((i) => {
      if (!episodeId) return i.libraryItemId === libraryItemId
      return i.libraryItemId === libraryItemId && i.episodeId === episodeId
    })
  },
  getBookshelfView: (state) => {
    if (!state.serverSettings || isNaN(state.serverSettings.bookshelfView)) return Constants.BookshelfView.STANDARD
    return state.serverSettings.bookshelfView
  },
  getHomeBookshelfView: (state) => {
    if (!state.serverSettings || isNaN(state.serverSettings.homeBookshelfView)) return Constants.BookshelfView.STANDARD
    return state.serverSettings.homeBookshelfView
  }
}

export const actions = {
  updateServerSettings({ commit }, payload) {
    const updatePayload = {
      ...payload
    }
    return this.$axios
      .$patch('/api/settings', updatePayload)
      .then((result) => {
        if (result.serverSettings) {
          commit('setServerSettings', result.serverSettings)
        }
        return result
      })
      .catch((error) => {
        console.error('Failed to update server settings', error)
        const errorMsg = error.response?.data || 'Unknown error'
        return {
          error: errorMsg
        }
      })
  },
  checkForUpdate({ commit }) {
    const VERSION_CHECK_BUFF = 1000 * 60 * 5 // 5 minutes
    var lastVerCheck = localStorage.getItem('lastVerCheck') || 0
    var savedVersionData = localStorage.getItem('versionData')
    if (savedVersionData) {
      try {
        savedVersionData = JSON.parse(localStorage.getItem('versionData'))
      } catch (error) {
        console.error('Failed to parse version data', error)
        savedVersionData = null
        localStorage.removeItem('versionData')
      }
    }

    var shouldCheckForUpdate = Date.now() - Number(lastVerCheck) > VERSION_CHECK_BUFF
    if (!shouldCheckForUpdate && savedVersionData && (savedVersionData.version !== currentVersion || !savedVersionData.releasesToShow)) {
      // Version mismatch between saved data so check for update anyway
      shouldCheckForUpdate = true
    }

    if (shouldCheckForUpdate) {
      return checkForUpdate()
        .then((res) => {
          if (res) {
            localStorage.setItem('lastVerCheck', Date.now())
            localStorage.setItem('versionData', JSON.stringify(res))

            commit('setVersionData', res)
          }
          return res && res.hasUpdate
        })
        .catch((error) => {
          console.error('Update check failed', error)
          return false
        })
    } else if (savedVersionData) {
      commit('setVersionData', savedVersionData)
    }
    return null
  }
}

export const mutations = {
  setRouterBasePath(state, rbp) {
    state.routerBasePath = rbp
  },
  setSource(state, source) {
    state.Source = source
  },
  setPlayerIsFullscreen(state, val) {
    state.playerIsFullscreen = val
  },
  setLastBookshelfScrollData(state, { scrollTop, path, name }) {
    state.lastBookshelfScrollData[name] = { scrollTop, path }
  },
  setBookshelfBookIds(state, val) {
    state.bookshelfBookIds = val || []
  },
  setEpisodeTableEpisodeIds(state, val) {
    state.episodeTableEpisodeIds = val || []
  },
  setPreviousPath(state, val) {
    state.previousPath = val
  },
  setVersionData(state, versionData) {
    state.versionData = versionData
  },
  setServerSettings(state, settings) {
    if (!settings) return
    state.serverSettings = settings
  },
  setPlaybackSessionId(state, playbackSessionId) {
    state.playbackSessionId = playbackSessionId
  },
  setMediaPlaying(state, payload) {
    if (!payload) {
      state.streamLibraryItem = null
      state.streamEpisodeId = null
      state.streamIsPlaying = false
      state.playerQueueItems = []
    } else {
      state.streamLibraryItem = payload.libraryItem
      state.streamEpisodeId = payload.episodeId || null
      state.playerQueueItems = payload.queueItems || []
    }
  },
  updateStreamLibraryItem(state, libraryItem) {
    if (!libraryItem) return
    state.streamLibraryItem = libraryItem
  },
  setIsPlaying(state, isPlaying) {
    state.streamIsPlaying = isPlaying
  },
  setPlayerQueueItems(state, items) {
    state.playerQueueItems = items || []
  },
  removeItemFromQueue(state, item) {
    state.playerQueueItems = state.playerQueueItems.filter((i) => {
      if (!i.episodeId) return i.libraryItemId !== item.libraryItemId
      return i.libraryItemId !== item.libraryItemId || i.episodeId !== item.episodeId
    })
  },
  addItemToQueue(state, item) {
    const exists = state.playerQueueItems.some((i) => {
      if (!i.episodeId) return i.libraryItemId === item.libraryItemId
      return i.libraryItemId === item.libraryItemId && i.episodeId === item.episodeId
    })
    if (!exists) {
      state.playerQueueItems.push(item)
    }
  },
  setPlayerQueueAutoPlay(state, autoPlay) {
    state.playerQueueAutoPlay = !!autoPlay
    localStorage.setItem('playerQueueAutoPlay', !!autoPlay ? '1' : '0')
  },
  showEditModal(state, libraryItem) {
    state.editModalTab = 'details'
    state.selectedLibraryItem = libraryItem
    state.showEditModal = true
  },
  showEditModalOnTab(state, { libraryItem, tab }) {
    state.editModalTab = tab
    state.selectedLibraryItem = libraryItem
    state.showEditModal = true
  },
  setEditModalTab(state, tab) {
    state.editModalTab = tab
  },
  setShowEditModal(state, val) {
    state.showEditModal = val
  },
  setEditPodcastModalTab(state, tab) {
    state.editPodcastModalTab = tab
  },
  showEReader(state, { libraryItem, keepProgress, fileId }) {
    state.selectedLibraryItem = libraryItem
    state.ereaderKeepProgress = keepProgress
    state.ereaderFileId = fileId

    state.showEReader = true
  },
  setShowEReader(state, val) {
    state.showEReader = val
  },
  setDeveloperMode(state, val) {
    state.developerMode = val
  },
  setSelectedLibraryItem(state, val) {
    Vue.set(state, 'selectedLibraryItem', val)
  },
  setProcessingBatch(state, val) {
    state.processingBatch = val
  },
  setOpenModal(state, val) {
    state.openModal = val
  },
  setInnerModalOpen(state, val) {
    state.innerModalOpen = val
  }
}
