import { checkForUpdate } from '@/plugins/version'
import Vue from 'vue'

export const state = () => ({
  versionData: null,
  serverSettings: null,
  streamAudiobook: null,
  editModalTab: 'details',
  showEditModal: false,
  selectedAudiobook: null,
  playOnLoad: false,
  developerMode: false,
  selectedAudiobooks: [],
  processingBatch: false,
  previousPath: '/',
  routeHistory: [],
  showExperimentalFeatures: false
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
  }
}

export const mutations = {
  setRouteHistory(state, val) {
    state.routeHistory = val
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
  setDeveloperMode(state, val) {
    state.developerMode = val
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
  setProcessingBatch(state, val) {
    state.processingBatch = val
  },
  setExperimentalFeatures(state, val) {
    state.showExperimentalFeatures = val
    localStorage.setItem('experimental', val ? 1 : 0)
  }
}