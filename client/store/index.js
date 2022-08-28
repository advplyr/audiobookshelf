import { checkForUpdate, currentVersion } from '@/plugins/version'
import Vue from 'vue'
const { Constants } = require('../plugins/constants')

export const state = () => ({
  Source: null,
  versionData: null,
  serverSettings: null,
  streamLibraryItem: null,
  streamEpisodeId: null,
  streamIsPlaying: false,
  playerQueueItems: [],
  playerIsFullscreen: false,
  editModalTab: 'details',
  showEditModal: false,
  showEReader: false,
  selectedLibraryItem: null,
  developerMode: false,
  selectedLibraryItems: [],
  processingBatch: false,
  previousPath: '/',
  showExperimentalFeatures: false,
  backups: [],
  bookshelfBookIds: [],
  openModal: null,
  innerModalOpen: false,
  lastBookshelfScrollData: {}
})

export const getters = {
  getIsLibraryItemSelected: state => libraryItemId => {
    return !!state.selectedLibraryItems.includes(libraryItemId)
  },
  getServerSetting: state => key => {
    if (!state.serverSettings) return null
    return state.serverSettings[key]
  },
  getBookCoverAspectRatio: state => {
    if (!state.serverSettings || isNaN(state.serverSettings.coverAspectRatio)) return 1
    return state.serverSettings.coverAspectRatio === 0 ? 1.6 : 1
  },
  getNumLibraryItemsSelected: state => state.selectedLibraryItems.length,
  getLibraryItemIdStreaming: state => {
    return state.streamLibraryItem ? state.streamLibraryItem.id : null
  },
  getIsMediaStreaming: state => (libraryItemId, episodeId) => {
    if (!state.streamLibraryItem) return null
    if (!episodeId) return state.streamLibraryItem.id == libraryItemId
    return state.streamLibraryItem.id == libraryItemId && state.streamEpisodeId == episodeId
  },
  getBookshelfView: state => {
    if (!state.serverSettings || isNaN(state.serverSettings.bookshelfView)) return Constants.BookshelfView.STANDARD
    return state.serverSettings.bookshelfView
  },
  getHomeBookshelfView: state => {
    if (!state.serverSettings || isNaN(state.serverSettings.homeBookshelfView)) return Constants.BookshelfView.STANDARD
    return state.serverSettings.homeBookshelfView
  }
}

export const actions = {
  updateServerSettings({ commit }, payload) {
    var updatePayload = {
      ...payload
    }
    return this.$axios.$patch('/api/settings', updatePayload).then((result) => {
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
    if (!shouldCheckForUpdate && savedVersionData && savedVersionData.version !== currentVersion) {
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
  setIsPlaying(state, isPlaying) {
    state.streamIsPlaying = isPlaying
  },
  setPlayerQueueItems(state, items) {
    state.playerQueueItems = items || []
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
  showEReader(state, libraryItem) {
    state.selectedLibraryItem = libraryItem

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
  setSelectedLibraryItems(state, items) {
    Vue.set(state, 'selectedLibraryItems', items)
  },
  toggleLibraryItemSelected(state, itemId) {
    if (state.selectedLibraryItems.includes(itemId)) {
      state.selectedLibraryItems = state.selectedLibraryItems.filter(a => a !== itemId)
    } else {
      var newSel = state.selectedLibraryItems.concat([itemId])
      Vue.set(state, 'selectedLibraryItems', newSel)
    }
  },
  setLibraryItemSelected(state, { libraryItemId, selected }) {
    var isThere = state.selectedLibraryItems.includes(libraryItemId)
    if (isThere && !selected) {
      state.selectedLibraryItems = state.selectedLibraryItems.filter(a => a !== libraryItemId)
    } else if (selected && !isThere) {
      var newSel = state.selectedLibraryItems.concat([libraryItemId])
      Vue.set(state, 'selectedLibraryItems', newSel)
    }
  },
  setProcessingBatch(state, val) {
    state.processingBatch = val
  },
  setExperimentalFeatures(state, val) {
    state.showExperimentalFeatures = val
    localStorage.setItem('experimental', val ? 1 : 0)
  },
  setBackups(state, val) {
    state.backups = val.sort((a, b) => b.createdAt - a.createdAt)
  },
  setOpenModal(state, val) {
    state.openModal = val
  },
  setInnerModalOpen(state, val) {
    state.innerModalOpen = val
  }
}