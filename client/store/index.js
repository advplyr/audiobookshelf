import Vue from 'vue'

export const state = () => ({
  serverSettings: null,
  streamAudiobook: null,
  editModalTab: 'details',
  showEditModal: false,
  selectedAudiobook: null,
  playOnLoad: false,
  isScanning: false,
  isScanningCovers: false,
  scanProgress: null,
  coverScanProgress: null,
  developerMode: false,
  selectedAudiobooks: [],
  processingBatch: false
})

export const getters = {
  getIsAudiobookSelected: state => audiobookId => {
    return !!state.selectedAudiobooks.includes(audiobookId)
  },
  getNumAudiobooksSelected: state => state.selectedAudiobooks.length
}

export const actions = {
  updateServerSettings({ commit }, payload) {
    var updatePayload = {
      ...payload
    }
    return this.$axios.$patch('/api/serverSettings', updatePayload).then((result) => {
      if (result.success) {
        commit('setServerSettings', result.settings)
        return true
      } else {
        return false
      }
    }).catch((error) => {
      console.error('Failed to update server settings', error)
      return false
    })
  }
}

export const mutations = {
  setServerSettings(state, settings) {
    state.serverSettings = settings
  },
  setStreamAudiobook(state, audiobook) {
    state.playOnLoad = true
    state.streamAudiobook = audiobook
  },
  setStream(state, stream) {
    state.playOnLoad = false
    state.streamAudiobook = stream ? stream.audiobook : null
  },
  clearStreamAudiobook(state, audiobookId) {
    if (state.streamAudiobook && state.streamAudiobook.id === audiobookId) {
      state.playOnLoad = false
      state.streamAudiobook = null
    }
  },
  setPlayOnLoad(state, val) {
    state.playOnLoad = val
  },
  showEditModal(state, audiobook) {
    state.editModalTab = 'details'
    state.selectedAudiobook = audiobook
    state.showEditModal = true
  },
  showEditModalOnTab(state, { audiobook, tab }) {
    state.editModalTab = tab
    state.selectedAudiobook = audiobook
    state.showEditModal = true
  },
  setEditModalTab(state, tab) {
    state.editModalTab = tab
  },
  setShowEditModal(state, val) {
    state.showEditModal = val
  },
  setIsScanning(state, isScanning) {
    state.isScanning = isScanning
  },
  setScanProgress(state, scanProgress) {
    if (scanProgress && scanProgress.progress > 0) state.isScanning = true
    state.scanProgress = scanProgress
  },
  setIsScanningCovers(state, isScanningCovers) {
    state.isScanningCovers = isScanningCovers
  },
  setCoverScanProgress(state, coverScanProgress) {
    if (coverScanProgress && coverScanProgress.progress > 0) state.isScanningCovers = true
    state.coverScanProgress = coverScanProgress
  },
  setDeveloperMode(state, val) {
    state.developerMode = val
  },
  setSelectedAudiobooks(state, audiobooks) {
    state.selectedAudiobooks = audiobooks
  },
  toggleAudiobookSelected(state, audiobookId) {
    if (state.selectedAudiobooks.includes(audiobookId)) {
      state.selectedAudiobooks = state.selectedAudiobooks.filter(a => a !== audiobookId)
    } else {
      state.selectedAudiobooks.push(audiobookId)
    }
  },
  setProcessingBatch(state, val) {
    state.processingBatch = val
  }
}