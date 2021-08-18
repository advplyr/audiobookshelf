
export const state = () => ({
  user: null,
  streamAudiobook: null,
  showEditModal: false,
  selectedAudiobook: null,
  playOnLoad: false,
  isScanning: false,
  scanProgress: null
})

export const getters = {
  getToken: (state) => {
    return state.user ? state.user.token : null
  },
  getUserAudiobook: (state) => (audiobookId) => {
    return state.user && state.user.audiobooks ? state.user.audiobooks[audiobookId] || null : null
  }
}

export const actions = {

}

export const mutations = {
  setUser(state, user) {
    state.user = user
    if (user.token) {
      localStorage.setItem('token', user.token)
    }
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
    state.selectedAudiobook = audiobook
    state.showEditModal = true
  },
  setShowEditModal(state, val) {
    state.showEditModal = val
  },
  setIsScanning(state, isScanning) {
    state.isScanning = isScanning
  },
  setScanProgress(state, progress) {
    if (progress > 0) state.isScanning = true
    state.scanProgress = progress
  }
}