
export const state = () => ({
  isMobile: false,
  isMobileLandscape: false,
  showBatchUserCollectionModal: false,
  showUserCollectionsModal: false,
  showEditCollectionModal: false,
  selectedCollection: null,
  showBookshelfTextureModal: false
})

export const getters = {}

export const mutations = {
  updateWindowSize(state, { width, height }) {
    state.isMobile = width < 768 || height < 768
    state.isMobileLandscape = state.isMobile && height > width
  },
  setShowUserCollectionsModal(state, val) {
    state.showBatchUserCollectionModal = false
    state.showUserCollectionsModal = val
  },
  setShowBatchUserCollectionsModal(state, val) {
    state.showBatchUserCollectionModal = true
    state.showUserCollectionsModal = val
  },
  setShowEditCollectionModal(state, val) {
    state.showEditCollectionModal = val
  },
  setEditCollection(state, collection) {
    state.selectedCollection = collection
    state.showEditCollectionModal = true
  },
  setShowBookshelfTextureModal(state, val) {
    state.showBookshelfTextureModal = val
  }
}