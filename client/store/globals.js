export const state = () => ({
  isMobile: false,
  isMobileLandscape: false,
  showBatchUserCollectionModal: false,
  showUserCollectionsModal: false,
  showEditCollectionModal: false,
  showEditPodcastEpisode: false,
  showViewPodcastEpisodeModal: false,
  showConfirmPrompt: false,
  confirmPromptOptions: null,
  showEditAuthorModal: false,
  selectedEpisode: null,
  selectedCollection: null,
  selectedAuthor: null,
  isCasting: false, // Actively casting
  isChromecastInitialized: false, // Script loaded
  dateFormats: [
    {
      text: 'MM/DD/YYYY',
      value: 'MM/dd/yyyy'
    },
    {
      text: 'DD/MM/YYYY',
      value: 'dd/MM/yyyy'
    },
    {
      text: 'YYYY-MM-DD',
      value: 'yyyy-MM-dd'
    }
  ]
})

export const getters = {
  getLibraryItemCoverSrc: (state, getters, rootState, rootGetters) => (libraryItem, placeholder = '/book_placeholder.jpg') => {
    if (!libraryItem) return placeholder
    var media = libraryItem.media
    if (!media || !media.coverPath || media.coverPath === placeholder) return placeholder

    // Absolute URL covers (should no longer be used)
    if (media.coverPath.startsWith('http:') || media.coverPath.startsWith('https:')) return media.coverPath

    var userToken = rootGetters['user/getToken']
    var lastUpdate = libraryItem.updatedAt || Date.now()

    if (process.env.NODE_ENV !== 'production') { // Testing
      return `http://localhost:3333/api/items/${libraryItem.id}/cover?token=${userToken}&ts=${lastUpdate}`
    }
    return `/api/items/${libraryItem.id}/cover?token=${userToken}&ts=${lastUpdate}`
  }
}

export const mutations = {
  updateWindowSize(state, { width, height }) {
    state.isMobile = width < 640 || height < 640
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
  setShowEditPodcastEpisodeModal(state, val) {
    state.showEditPodcastEpisode = val
  },
  setShowViewPodcastEpisodeModal(state, val) {
    state.showViewPodcastEpisodeModal = val
  },
  setShowConfirmPrompt(state, val) {
    state.showConfirmPrompt = val
  },
  setConfirmPrompt(state, options) {
    state.confirmPromptOptions = options
    state.showConfirmPrompt = true
  },
  setEditCollection(state, collection) {
    state.selectedCollection = collection
    state.showEditCollectionModal = true
  },
  setSelectedEpisode(state, episode) {
    state.selectedEpisode = episode
  },
  showEditAuthorModal(state, author) {
    state.selectedAuthor = author
    state.showEditAuthorModal = true
  },
  setShowEditAuthorModal(state, val) {
    state.showEditAuthorModal = val
  },
  setSelectedAuthor(state, author) {
    state.selectedAuthor = author
  },
  setChromecastInitialized(state, val) {
    state.isChromecastInitialized = val
  },
  setCasting(state, val) {
    state.isCasting = val
  }
}