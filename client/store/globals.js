
export const state = () => ({
  showUserCollectionsModal: false,
  showEditCollectionModal: false,
  selectedCollection: null
})

export const getters = {

}

export const actions = {

}

export const mutations = {
  setShowUserCollectionsModal(state, val) {
    state.showUserCollectionsModal = val
  },
  setShowEditCollectionModal(state, val) {
    state.showEditCollectionModal = val
  },
  setEditCollection(state, collection) {
    state.selectedCollection = collection
    state.showEditCollectionModal = true
  }
}