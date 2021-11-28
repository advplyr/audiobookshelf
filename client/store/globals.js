
export const state = () => ({
  showBatchUserCollectionModal: false,
  showUserCollectionsModal: false,
  showEditCollectionModal: false,
  selectedCollection: null,
  showBookshelfTextureModal: false
})

export const getters = {

}

export const actions = {

}

export const mutations = {
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
    console.log('shopw', val)
  }
}