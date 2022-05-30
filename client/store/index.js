import { checkForUpdate } from '@/plugins/version'
import Vue from 'vue'

export const state = () => ({
  Source: null,
  versionData: null,
  serverSettings: null,
  streamLibraryItem: null,
  streamEpisodeId: null,
  streamIsPlaying: false,
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
  getIsEpisodeStreaming: state => (libraryItemId, episodeId) => {
    if (!state.streamLibraryItem) return null
    return state.streamLibraryItem.id == libraryItemId && state.streamEpisodeId == episodeId
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
    return checkForUpdate()
      .then((res) => {
        commit('setVersionData', res)
        return res
      })
      .catch((error) => {
        console.error('Update check failed', error)
        return false
      })
  }
}

export const mutations = {
  setSource(state, source) {
    state.Source = source
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
    } else {
      state.streamLibraryItem = payload.libraryItem
      state.streamEpisodeId = payload.episodeId || null
    }
  },
  setIsPlaying(state, isPlaying) {
    state.streamIsPlaying = isPlaying
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