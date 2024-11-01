<template>
  <div class="text-white max-h-screen h-screen overflow-hidden bg-bg">
    <app-appbar />

    <app-side-rail v-if="isShowingSideRail" class="hidden md:block" />
    <div id="app-content" class="h-full" :class="{ 'has-siderail': isShowingSideRail }">
      <Nuxt :key="currentLang" />
    </div>

    <app-media-player-container ref="mediaPlayerContainer" />

    <modals-item-edit-modal />
    <modals-collections-add-create-modal />
    <modals-collections-edit-modal />
    <modals-playlists-add-create-modal />
    <modals-playlists-edit-modal />
    <modals-podcast-edit-episode />
    <modals-podcast-view-episode />
    <modals-authors-edit-modal />
    <modals-batch-quick-match-model />
    <modals-rssfeed-open-close-modal />
    <modals-raw-cover-preview-modal />
    <modals-share-modal />
    <prompt-confirm />
    <readers-reader />
  </div>
</template>

<script>
export default {
  middleware: 'authenticated',
  data() {
    return {
      socket: null,
      isSocketConnected: false,
      isFirstSocketConnection: true,
      socketConnectionToastId: null,
      currentLang: null,
      multiSessionOtherSessionId: null, // Used for multiple sessions open warning toast
      multiSessionCurrentSessionId: null // Used for multiple sessions open warning toast
    }
  },
  watch: {
    $route(newVal) {
      if (this.$store.state.showEditModal) {
        this.$store.commit('setShowEditModal', false)
      }

      this.$store.commit('globals/resetSelectedMediaItems', [])
      this.updateBodyClass()
    }
  },
  computed: {
    user() {
      return this.$store.state.user.user
    },
    isCasting() {
      return this.$store.state.globals.isCasting
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    isShowingSideRail() {
      if (!this.$route.name) return false
      return !this.$route.name.startsWith('config') && this.currentLibraryId
    },
    isShowingToolbar() {
      return this.isShowingSideRail && this.$route.name !== 'upload' && this.$route.name !== 'account'
    },
    appContentMarginLeft() {
      return this.isShowingSideRail ? 80 : 0
    }
  },
  methods: {
    updateBodyClass() {
      if (this.isShowingToolbar) {
        document.body.classList.remove('no-bars', 'app-bar')
        document.body.classList.add('app-bar-and-toolbar')
      } else {
        document.body.classList.remove('no-bars', 'app-bar-and-toolbar')
        document.body.classList.add('app-bar')
      }
    },
    updateSocketConnectionToast(content, type, timeout) {
      if (this.socketConnectionToastId !== null && this.socketConnectionToastId !== undefined) {
        this.$toast.update(this.socketConnectionToastId, { content: content, options: { timeout: timeout, type: type, closeButton: false, position: 'bottom-center', onClose: () => null, closeOnClick: timeout !== null } }, false)
      } else {
        this.socketConnectionToastId = this.$toast[type](content, { position: 'bottom-center', timeout: timeout, closeButton: false, closeOnClick: timeout !== null })
      }
    },
    connect() {
      console.log('[SOCKET] Connected')
      var token = this.$store.getters['user/getToken']
      this.socket.emit('auth', token)

      if (!this.isFirstSocketConnection || this.socketConnectionToastId !== null) {
        this.updateSocketConnectionToast(this.$strings.ToastSocketConnected, 'success', 5000)
      }
      this.isFirstSocketConnection = false
      this.isSocketConnected = true
    },
    connectError() {
      console.error('[SOCKET] connect error')
      this.updateSocketConnectionToast(this.$strings.ToastSocketFailedToConnect, 'error', null)
    },
    disconnect() {
      console.log('[SOCKET] Disconnected')
      this.isSocketConnected = false
      this.updateSocketConnectionToast(this.$strings.ToastSocketDisconnected, 'error', null)
    },
    reconnect() {
      console.error('[SOCKET] reconnected')
    },
    reconnectAttempt(val) {
      console.log(`[SOCKET] reconnect attempt ${val}`)
    },
    reconnectError() {
      // console.error('[SOCKET] reconnect error')
    },
    reconnectFailed() {
      console.error('[SOCKET] reconnect failed')
    },
    init(payload) {
      console.log('Init Payload', payload)

      if (payload.usersOnline) {
        this.$store.commit('users/setUsersOnline', payload.usersOnline)
      }

      this.$eventBus.$emit('socket_init')
    },
    streamOpen(stream) {
      if (this.$refs.mediaPlayerContainer) this.$refs.mediaPlayerContainer.streamOpen(stream)
    },
    streamClosed(streamId) {
      if (this.$refs.mediaPlayerContainer) this.$refs.mediaPlayerContainer.streamClosed(streamId)
    },
    streamProgress(data) {
      if (this.$refs.mediaPlayerContainer) this.$refs.mediaPlayerContainer.streamProgress(data)
    },
    streamReady() {
      if (this.$refs.mediaPlayerContainer) this.$refs.mediaPlayerContainer.streamReady()
    },
    streamReset(payload) {
      if (this.$refs.mediaPlayerContainer) this.$refs.mediaPlayerContainer.streamReset(payload)
    },
    streamError({ id, errorMessage }) {
      this.$toast.error(`Stream Failed: ${errorMessage}`)
      if (this.$refs.mediaPlayerContainer) this.$refs.mediaPlayerContainer.streamError(id)
    },
    libraryAdded(library) {
      this.$store.commit('libraries/addUpdate', library)
    },
    libraryUpdated(library) {
      this.$store.commit('libraries/addUpdate', library)
    },
    async libraryRemoved(library) {
      console.log('Library removed', library)
      this.$store.commit('libraries/remove', library)

      // When removed currently selected library then set next accessible library
      const currLibraryId = this.currentLibraryId
      if (currLibraryId === library.id) {
        var nextLibrary = this.$store.getters['libraries/getNextAccessibleLibrary']
        if (nextLibrary) {
          await this.$store.dispatch('libraries/fetch', nextLibrary.id)

          if (this.$route.name.startsWith('config')) {
            // No need to refresh
          } else if (this.$route.name.startsWith('library')) {
            var newRoute = this.$route.path.replace(currLibraryId, nextLibrary.id)
            this.$router.push(newRoute)
          } else {
            this.$router.push(`/library/${nextLibrary.id}`)
          }
        } else {
          console.error('User has no more accessible libraries')
          this.$store.commit('libraries/setCurrentLibrary', null)
        }
      }
    },
    libraryItemAdded(libraryItem) {
      this.$store.commit('libraries/updateFilterDataWithItem', libraryItem)
    },
    libraryItemUpdated(libraryItem) {
      if (this.$store.state.selectedLibraryItem && this.$store.state.selectedLibraryItem.id === libraryItem.id) {
        this.$store.commit('setSelectedLibraryItem', libraryItem)
        if (this.$store.state.globals.selectedEpisode && libraryItem.mediaType === 'podcast') {
          const episode = libraryItem.media.episodes.find((ep) => ep.id === this.$store.state.globals.selectedEpisode.id)
          if (episode) {
            this.$store.commit('globals/setSelectedEpisode', episode)
          }
        }
      }
      this.$eventBus.$emit(`${libraryItem.id}_updated`, libraryItem)
      this.$store.commit('libraries/updateFilterDataWithItem', libraryItem)
    },
    libraryItemRemoved(item) {
      if (this.$route.name.startsWith('item')) {
        if (this.$route.params.id === item.id) {
          this.$router.replace(`/library/${this.currentLibraryId}`)
        }
      }
    },
    libraryItemsUpdated(libraryItems) {
      libraryItems.forEach((li) => {
        this.libraryItemUpdated(li)
      })
    },
    libraryItemsAdded(libraryItems) {
      libraryItems.forEach((ab) => {
        this.libraryItemAdded(ab)
      })
    },
    trackStarted(data) {
      this.$store.commit('tasks/updateAudioFilesEncoding', { libraryItemId: data.libraryItemId, ino: data.ino, progress: '0%' })
    },
    trackProgress(data) {
      this.$store.commit('tasks/updateAudioFilesEncoding', { libraryItemId: data.libraryItemId, ino: data.ino, progress: `${Math.round(data.progress)}%` })
    },
    trackFinished(data) {
      this.$store.commit('tasks/updateAudioFilesEncoding', { libraryItemId: data.libraryItemId, ino: data.ino, progress: '100%' })
      this.$store.commit('tasks/updateAudioFilesFinished', { libraryItemId: data.libraryItemId, ino: data.ino, finished: true })
    },
    taskStarted(task) {
      console.log('Task started', task)
      this.$store.commit('tasks/addUpdateTask', task)
    },
    taskFinished(task) {
      console.log('Task finished', task)
      this.$store.commit('tasks/addUpdateTask', task)
    },
    taskProgress(data) {
      this.$store.commit('tasks/updateTaskProgress', { libraryItemId: data.libraryItemId, progress: `${Math.round(data.progress)}%` })
    },
    metadataEmbedQueueUpdate(data) {
      if (data.queued) {
        this.$store.commit('tasks/addQueuedEmbedLId', data.libraryItemId)
      } else {
        this.$store.commit('tasks/removeQueuedEmbedLId', data.libraryItemId)
      }
    },
    userUpdated(user) {
      if (this.$store.state.user.user.id === user.id) {
        this.$store.commit('user/setUser', user)
      }
    },
    userOnline(user) {
      this.$store.commit('users/updateUserOnline', user)
    },
    userOffline(user) {
      this.$store.commit('users/removeUserOnline', user)
    },
    userStreamUpdate(user) {
      this.$store.commit('users/updateUserOnline', user)
    },
    userSessionClosed(sessionId) {
      // If this session or other session is closed then dismiss multiple sessions warning toast
      if (sessionId === this.multiSessionOtherSessionId || this.multiSessionCurrentSessionId === sessionId) {
        this.multiSessionOtherSessionId = null
        this.multiSessionCurrentSessionId = null
        this.$toast.dismiss('multiple-sessions')
      }
      if (this.$refs.mediaPlayerContainer) this.$refs.mediaPlayerContainer.sessionClosedEvent(sessionId)
    },
    userMediaProgressUpdate(payload) {
      this.$store.commit('user/updateMediaProgress', payload)

      if (payload.data) {
        if (this.$store.getters['getIsMediaStreaming'](payload.data.libraryItemId, payload.data.episodeId) && this.$store.state.playbackSessionId !== payload.sessionId) {
          this.multiSessionOtherSessionId = payload.sessionId
          this.multiSessionCurrentSessionId = this.$store.state.playbackSessionId
          console.log(`Media progress was updated from another session (${this.multiSessionOtherSessionId}) for currently open media. Device description=${payload.deviceDescription}. Current session id=${this.multiSessionCurrentSessionId}`)
          if (this.$store.state.streamIsPlaying) {
            this.$toast.update('multiple-sessions', { content: `Another session is open for this item on device ${payload.deviceDescription}`, options: { timeout: 20000, type: 'warning', pauseOnFocusLoss: false } }, true)
          } else {
            this.$eventBus.$emit('playback-time-update', payload.data.currentTime)
          }
        }
      }
    },
    collectionAdded(collection) {
      if (this.currentLibraryId !== collection.libraryId) return
      this.$store.commit('libraries/addUpdateCollection', collection)
    },
    collectionUpdated(collection) {
      if (this.currentLibraryId !== collection.libraryId) return
      this.$store.commit('libraries/addUpdateCollection', collection)
    },
    collectionRemoved(collection) {
      if (this.currentLibraryId !== collection.libraryId) return
      if (this.$route.name.startsWith('collection')) {
        if (this.$route.params.id === collection.id) {
          this.$router.replace(`/library/${this.currentLibraryId}/bookshelf/collections`)
        }
      }
      this.$store.commit('libraries/removeCollection', collection)
    },
    seriesRemoved({ id, libraryId }) {
      if (this.currentLibraryId !== libraryId) return
      this.$store.commit('libraries/removeSeriesFromFilterData', id)
    },
    playlistAdded(playlist) {
      if (playlist.userId !== this.user.id || this.currentLibraryId !== playlist.libraryId) return
      this.$store.commit('libraries/addUpdateUserPlaylist', playlist)
    },
    playlistUpdated(playlist) {
      if (playlist.userId !== this.user.id || this.currentLibraryId !== playlist.libraryId) return
      this.$store.commit('libraries/addUpdateUserPlaylist', playlist)
    },
    playlistRemoved(playlist) {
      if (playlist.userId !== this.user.id || this.currentLibraryId !== playlist.libraryId) return

      if (this.$route.name.startsWith('playlist')) {
        if (this.$route.params.id === playlist.id) {
          this.$router.replace(`/library/${this.currentLibraryId}/bookshelf/playlists`)
        }
      }
      this.$store.commit('libraries/removeUserPlaylist', playlist)
    },
    backupApplied() {
      // Force refresh
      location.reload()
    },
    batchQuickMatchComplete(result) {
      var success = result.success || false
      var toast = 'Batch quick match complete!\n' + result.updates + ' Updated'
      if (result.unmatched && result.unmatched > 0) {
        toast += '\n' + result.unmatched + ' with no matches'
      }
      if (success) {
        this.$toast.success(toast)
      } else {
        this.$toast.info(toast)
      }
    },
    adminMessageEvt(message) {
      this.$toast.info(message)
    },
    ereaderDevicesUpdated(data) {
      if (!data?.ereaderDevices) return

      this.$store.commit('libraries/setEReaderDevices', data.ereaderDevices)
    },
    customMetadataProviderAdded(provider) {
      if (!provider?.id) return
      this.$store.commit('scanners/addCustomMetadataProvider', provider)
    },
    customMetadataProviderRemoved(provider) {
      if (!provider?.id) return
      this.$store.commit('scanners/removeCustomMetadataProvider', provider)
    },
    initializeSocket() {
      this.socket = this.$nuxtSocket({
        name: process.env.NODE_ENV === 'development' ? 'dev' : 'prod',
        persist: 'main',
        teardown: false,
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        path: `${this.$config.routerBasePath}/socket.io`
      })
      this.$root.socket = this.socket
      console.log('Socket initialized')

      // Pre-defined socket events
      this.socket.on('connect', this.connect)
      this.socket.on('connect_error', this.connectError)
      this.socket.on('disconnect', this.disconnect)
      this.socket.io.on('reconnect_attempt', this.reconnectAttempt)
      this.socket.io.on('reconnect', this.reconnect)
      this.socket.io.on('reconnect_error', this.reconnectError)
      this.socket.io.on('reconnect_failed', this.reconnectFailed)

      // Event received after authorizing socket
      this.socket.on('init', this.init)

      // Stream Listeners
      this.socket.on('stream_open', this.streamOpen)
      this.socket.on('stream_closed', this.streamClosed)
      this.socket.on('stream_progress', this.streamProgress)
      this.socket.on('stream_ready', this.streamReady)
      this.socket.on('stream_reset', this.streamReset)
      this.socket.on('stream_error', this.streamError)

      // Library Listeners
      this.socket.on('library_updated', this.libraryUpdated)
      this.socket.on('library_added', this.libraryAdded)
      this.socket.on('library_removed', this.libraryRemoved)

      // Library Item Listeners
      this.socket.on('item_added', this.libraryItemAdded)
      this.socket.on('item_updated', this.libraryItemUpdated)
      this.socket.on('item_removed', this.libraryItemRemoved)
      this.socket.on('items_updated', this.libraryItemsUpdated)
      this.socket.on('items_added', this.libraryItemsAdded)

      // User Listeners
      this.socket.on('user_updated', this.userUpdated)
      this.socket.on('user_online', this.userOnline)
      this.socket.on('user_offline', this.userOffline)
      this.socket.on('user_stream_update', this.userStreamUpdate)
      this.socket.on('user_session_closed', this.userSessionClosed)
      this.socket.on('user_item_progress_updated', this.userMediaProgressUpdate)

      // Collection Listeners
      this.socket.on('collection_added', this.collectionAdded)
      this.socket.on('collection_updated', this.collectionUpdated)
      this.socket.on('collection_removed', this.collectionRemoved)

      // Series Listeners
      this.socket.on('series_removed', this.seriesRemoved)

      // User Playlist Listeners
      this.socket.on('playlist_added', this.playlistAdded)
      this.socket.on('playlist_updated', this.playlistUpdated)
      this.socket.on('playlist_removed', this.playlistRemoved)

      // Task Listeners
      this.socket.on('task_started', this.taskStarted)
      this.socket.on('task_finished', this.taskFinished)
      this.socket.on('metadata_embed_queue_update', this.metadataEmbedQueueUpdate)
      this.socket.on('track_started', this.trackStarted)
      this.socket.on('track_finished', this.trackFinished)
      this.socket.on('track_progress', this.trackProgress)
      this.socket.on('task_progress', this.taskProgress)

      // EReader Device Listeners
      this.socket.on('ereader-devices-updated', this.ereaderDevicesUpdated)

      this.socket.on('backup_applied', this.backupApplied)

      this.socket.on('batch_quickmatch_complete', this.batchQuickMatchComplete)

      this.socket.on('admin_message', this.adminMessageEvt)

      // Custom metadata provider Listeners
      this.socket.on('custom_metadata_provider_added', this.customMetadataProviderAdded)
      this.socket.on('custom_metadata_provider_removed', this.customMetadataProviderRemoved)
    },
    showUpdateToast(versionData) {
      var ignoreVersion = localStorage.getItem('ignoreVersion')
      var latestVersion = versionData.latestVersion

      if (!ignoreVersion || ignoreVersion !== latestVersion) {
        this.$toast.info(`Update is available!\nCheck release notes for v${versionData.latestVersion}`, {
          position: 'top-center',
          toastClassName: 'cursor-pointer',
          bodyClassName: 'custom-class-1',
          timeout: 20000,
          closeOnClick: false,
          draggable: false,
          hideProgressBar: false,
          onClick: () => {
            window.open(versionData.githubTagUrl, '_blank')
          },
          onClose: () => {
            localStorage.setItem('ignoreVersion', versionData.latestVersion)
          }
        })
      } else {
        console.warn(`Update is available but user chose to dismiss it! v${versionData.latestVersion}`)
      }
    },
    checkActiveElementIsInput() {
      const activeElement = document.activeElement
      const inputs = ['input', 'select', 'button', 'textarea', 'trix-editor']
      return activeElement && inputs.some((i) => i === activeElement.tagName.toLowerCase())
    },
    getHotkeyName(e) {
      var keyCode = e.keyCode || e.which
      if (!this.$keynames[keyCode]) {
        // Unused hotkey
        return null
      }

      var keyName = this.$keynames[keyCode]
      var name = keyName
      if (e.shiftKey) name = 'Shift-' + keyName
      if (process.env.NODE_ENV !== 'production') {
        console.log('Hotkey command', name)
      }
      return name
    },
    keyDown(e) {
      var name = this.getHotkeyName(e)
      if (!name) return

      // Input is focused then ignore key press
      if (this.checkActiveElementIsInput()) {
        return
      }

      // Modal is open
      if (this.$store.state.openModal && Object.values(this.$hotkeys.Modal).includes(name)) {
        this.$eventBus.$emit('modal-hotkey', name)
        e.preventDefault()
        return
      }

      // EReader is open
      if (this.$store.state.showEReader && Object.values(this.$hotkeys.EReader).includes(name)) {
        this.$eventBus.$emit('reader-hotkey', name)
        e.preventDefault()
        return
      }

      // Batch selecting
      if (this.$store.getters['globals/getIsBatchSelectingMediaItems'] && name === 'Escape') {
        // ESCAPE key cancels batch selection
        this.$store.commit('globals/resetSelectedMediaItems', [])
        this.$eventBus.$emit('bookshelf_clear_selection')
        e.preventDefault()
        return
      }

      // Playing audiobook
      if (this.$store.state.streamLibraryItem && Object.values(this.$hotkeys.AudioPlayer).includes(name)) {
        this.$eventBus.$emit('player-hotkey', name)
        e.preventDefault()
      }
    },
    resize() {
      this.$store.commit('globals/updateWindowSize', { width: window.innerWidth, height: window.innerHeight })
    },
    checkVersionUpdate() {
      this.$store
        .dispatch('checkForUpdate')
        .then((res) => {
          if (res && res.hasUpdate) this.showUpdateToast(res)
        })
        .catch((err) => console.error(err))
    },
    initLocalStorage() {
      // Queue auto play
      var playerQueueAutoPlay = localStorage.getItem('playerQueueAutoPlay')
      this.$store.commit('setPlayerQueueAutoPlay', playerQueueAutoPlay !== '0')
    },
    loadTasks() {
      this.$axios
        .$get('/api/tasks?include=queue')
        .then((payload) => {
          console.log('Fetched tasks', payload)
          if (payload.tasks) {
            this.$store.commit('tasks/setTasks', payload.tasks)
          }
          if (payload.queuedTaskData?.embedMetadata?.length) {
            this.$store.commit(
              'tasks/setQueuedEmbedLIds',
              payload.queuedTaskData.embedMetadata.map((td) => td.libraryItemId)
            )
          }
        })
        .catch((error) => {
          console.error('Failed to load tasks', error)
        })
    },
    changeLanguage(code) {
      console.log('Changed lang', code)
      this.currentLang = code
      document.documentElement.lang = code
    }
  },
  beforeMount() {
    this.initializeSocket()
  },
  mounted() {
    this.updateBodyClass()
    this.resize()
    this.$eventBus.$on('change-lang', this.changeLanguage)
    window.addEventListener('resize', this.resize)
    window.addEventListener('keydown', this.keyDown)

    this.$store.dispatch('libraries/load')

    this.initLocalStorage()

    this.checkVersionUpdate()

    this.loadTasks()

    if (this.$route.query.error) {
      this.$toast.error(this.$route.query.error)
      this.$router.replace(this.$route.path)
    }

    // Set lang on HTML tag
    if (this.$languageCodes?.current) {
      document.documentElement.lang = this.$languageCodes.current
    }
  },
  beforeDestroy() {
    this.$eventBus.$off('change-lang', this.changeLanguage)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('keydown', this.keyDown)
  }
}
</script>

<style>
.Vue-Toastification__toast-body.custom-class-1 {
  font-size: 14px;
}

#app-content {
  width: 100%;
}
#app-content.has-siderail {
  width: calc(100% - 80px);
  max-width: calc(100% - 80px);
  margin-left: 80px;
}
@media (max-width: 768px) {
  #app-content.has-siderail {
    width: 100%;
    max-width: 100%;
    margin-left: 0px;
  }
}
</style>
