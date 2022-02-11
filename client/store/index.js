import { checkForUpdate } from '@/plugins/version'
import Vue from 'vue'

export const state = () => ({
  versionData: null,
  streamAudiobook: null,
  editModalTab: 'details',
  showEditModal: false,
  showEReader: false,
  selectedAudiobook: null,
  selectedAudiobookFile: null,
  playOnLoad: false,
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
  getNumAudiobooksSelected: state => state.selectedAudiobooks.length,
  getAudiobookIdStreaming: state => {
    return state.streamAudiobook ? state.streamAudiobook.id : null
  }
}

export const actions = {
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
  setStreamAudiobook(state, audiobook) {
    state.playOnLoad = true
    state.streamAudiobook = audiobook
  },
  updateStreamAudiobook(state, audiobook) { // Initial stream audiobook is minified, on open audiobook is updated to full
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
  showEReader(state, audiobook) {
    state.selectedAudiobookFile = null
    state.selectedAudiobook = audiobook

    state.showEReader = true
  },
  showEReaderForFile(state, { audiobook, file }) {
    state.selectedAudiobookFile = file
    state.selectedAudiobook = audiobook

    state.showEReader = true
  },
  setShowEReader(state, val) {
    state.showEReader = val
  },
  setDeveloperMode(state, val) {
    state.developerMode = val
  },
  setSelectedAudiobook(state, val) {
    Vue.set(state, 'selectedAudiobook', val)
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