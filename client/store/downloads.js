
export const state = () => ({
  downloads: []
})

export const getters = {
  getDownloads: (state) => (libraryItemId) => {
    return state.downloads.filter(d => d.libraryItemId === libraryItemId)
  },
  getDownload: (state) => (id) => {
    return state.downloads.find(d => d.id === id)
  }
}

export const actions = {

}

export const mutations = {
  setDownloads(state, downloads) {
    state.downloads = downloads
  },
  addUpdateDownload(state, download) {
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