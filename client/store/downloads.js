
export const state = () => ({
  downloads: []
})

export const getters = {
  getDownloads: (state) => (audiobookId) => {
    return state.downloads.filter(d => d.audiobookId === audiobookId)
  },
  getDownload: (state) => (id) => {
    return state.downloads.find(d => d.id === id)
  }
}

export const actions = {

}

export const mutations = {
  addUpdateDownload(state, download) {
    // Remove older downloads of matching type
    state.downloads = state.downloads.filter(d => {
      if (d.id !== download.id && d.type === download.type) {
        return false
      }
      return true
    })

    var index = state.downloads.findIndex(d => d.id === download.id)
    if (index >= 0) {
      state.downloads.splice(index, 1, download)
    } else {
      state.downloads.push(download)
    }
  },
  removeDownload(state, download) {
    state.downloads = state.downloads.filter(d => d.id !== download.id)
  }
}