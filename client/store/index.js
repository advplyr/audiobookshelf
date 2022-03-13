import { checkForUpdate } from '@/plugins/version'
import Vue from 'vue'

export const state = () => ({
  versionData: null,
  serverSettings: null,
  streamLibraryItem: null,
  editModalTab: 'details',
  showEditModal: false,
  showEReader: false,
  selectedAudiobook: null,
  selectedLibraryItem: null,
  selectedAudiobookFile: null,
  developerMode: false,
  selectedAudiobooks: [],
  processingBatch: false,
  previousPath: '/',
  routeHistory: [],
  isRoutingBack: false,
  showExperimentalFeatures: false,
  backups: [],
  bookshelfBookIds: [],
  openModal: null,
  selectedBookshelfTexture: '/textures/wood_default.jpg'
})

export const getters = {
  getIsAudiobookSelected: state => audiobookId => {
    return !!state.selectedAudiobooks.includes(audiobookId)
  },
  getServerSetting: state => key => {
    if (!state.serverSettings) return null
    return state.serverSettings[key]
  },
  getBookCoverAspectRatio: state => {
    if (!state.serverSettings || !state.serverSettings.coverAspectRatio) return 1.6
    return state.serverSettings.coverAspectRatio === 0 ? 1.6 : 1
  },
  getNumAudiobooksSelected: state => state.selectedAudiobooks.length,
  getLibraryItemIdStreaming: state => {
    return state.streamLibraryItem ? state.streamLibraryItem.id : null
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
  },
  popRoute({ commit, state }) {
    if (!state.routeHistory.length) {
      return null
    }
    var _history = [...state.routeHistory]
    var last = _history.pop()
    commit('setRouteHistory', _history)
    return last
  },
  setBookshelfTexture({ commit, state }, img) {
    let root = document.documentElement;
    commit('setBookshelfTexture', img)
    root.style.setProperty('--bookshelf-texture-img', `url(${img})`);
  }
}

export const mutations = {
  setBookshelfBookIds(state, val) {
    state.bookshelfBookIds = val || []
  },
  setRouteHistory(state, val) {
    state.routeHistory = val
  },
  setIsRoutingBack(state, val) {
    state.isRoutingBack = val
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
  setLibraryItemStream(state, libraryItem) {
    state.streamLibraryItem = libraryItem
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
    state.selectedAudiobookFile = null
    state.selectedLibraryItem = libraryItem

    state.showEReader = true
  },
  showEReaderForFile(state, { libraryItem, file }) {
    state.selectedAudiobookFile = file
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
  setSelectedAudiobooks(state, audiobooks) {
    Vue.set(state, 'selectedAudiobooks', audiobooks)
  },
  toggleAudiobookSelected(state, audiobookId) {
    if (state.selectedAudiobooks.includes(audiobookId)) {
      state.selectedAudiobooks = state.selectedAudiobooks.filter(a => a !== audiobookId)
    } else {
      var newSel = state.selectedAudiobooks.concat([audiobookId])
      Vue.set(state, 'selectedAudiobooks', newSel)
    }
  },
  setAudiobookSelected(state, { audiobookId, selected }) {
    var isThere = state.selectedAudiobooks.includes(audiobookId)
    if (isThere && !selected) {
      state.selectedAudiobooks = state.selectedAudiobooks.filter(a => a !== audiobookId)
    } else if (selected && !isThere) {
      var newSel = state.selectedAudiobooks.concat([audiobookId])
      Vue.set(state, 'selectedAudiobooks', newSel)
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
  setBookshelfTexture(state, val) {
    state.selectedBookshelfTexture = val
  }
}