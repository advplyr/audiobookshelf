export const state = () => ({
  isMobile: false,
  isMobileLandscape: false,
  showBatchCollectionModal: false,
  showCollectionsModal: false,
  showEditCollectionModal: false,
  showPlaylistsModal: false,
  showEditPodcastEpisode: false,
  showViewPodcastEpisodeModal: false,
  showConfirmPrompt: false,
  confirmPromptOptions: null,
  showEditAuthorModal: false,
  selectedEpisode: null,
  selectedPlaylistItems: null,
  selectedCollection: null,
  selectedAuthor: null,
  isCasting: false, // Actively casting
  isChromecastInitialized: false, // Script loaded
  showBatchQuickMatchModal: false,
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
  ],
  libraryIcons: ['database', 'audiobookshelf', 'books-1', 'books-2', 'book-1', 'microphone-1', 'microphone-3', 'radio', 'podcast', 'rss', 'headphones', 'music', 'file-picture', 'rocket', 'power', 'star', 'heart']
})

export const getters = {
  getLibraryItemCoverSrc: (state, getters, rootState, rootGetters) => (libraryItem, placeholder = null) => {
    if (!placeholder) placeholder = `${rootState.routerBasePath}/book_placeholder.jpg`
    if (!libraryItem) return placeholder
    var media = libraryItem.media
    if (!media || !media.coverPath || media.coverPath === placeholder) return placeholder

    // Absolute URL covers (should no longer be used)
    if (media.coverPath.startsWith('http:') || media.coverPath.startsWith('https:')) return media.coverPath

    const userToken = rootGetters['user/getToken']
    const lastUpdate = libraryItem.updatedAt || Date.now()
    const libraryItemId = libraryItem.libraryItemId || libraryItem.id // Workaround for /users/:id page showing media progress covers

    if (process.env.NODE_ENV !== 'production') { // Testing
      return `http://localhost:3333${rootState.routerBasePath}/api/items/${libraryItemId}/cover?token=${userToken}&ts=${lastUpdate}`
    }

    return `${rootState.routerBasePath}/api/items/${libraryItemId}/cover?token=${userToken}&ts=${lastUpdate}`
  },
  getLibraryItemCoverSrcById: (state, getters, rootState, rootGetters) => (libraryItemId, placeholder = null) => {
    if (!placeholder) placeholder = `${rootState.routerBasePath}/book_placeholder.jpg`
    if (!libraryItemId) return placeholder
    var userToken = rootGetters['user/getToken']
    if (process.env.NODE_ENV !== 'production') { // Testing
      return `http://localhost:3333${rootState.routerBasePath}/api/items/${libraryItemId}/cover?token=${userToken}`
    }
    return `${rootState.routerBasePath}/api/items/${libraryItemId}/cover?token=${userToken}`
  }
}

export const mutations = {
  updateWindowSize(state, { width, height }) {
    state.isMobile = width < 640 || height < 640
    state.isMobileLandscape = state.isMobile && height > width
  },
  setShowCollectionsModal(state, val) {
    state.showBatchCollectionModal = false
    state.showCollectionsModal = val
  },
  setShowBatchCollectionsModal(state, val) {
    state.showBatchCollectionModal = true
    state.showCollectionsModal = val
  },
  setShowEditCollectionModal(state, val) {
    state.showEditCollectionModal = val
  },
  setShowPlaylistsModal(state, val) {
    state.showPlaylistsModal = val
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
  setSelectedPlaylistItems(state, items) {
    state.selectedPlaylistItems = items
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
  },
  setShowBatchQuickMatchModal(state, val) {
    state.showBatchQuickMatchModal = val
  }
}