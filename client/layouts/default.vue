<template>
  <div class="text-white max-h-screen h-screen overflow-hidden bg-bg">
    <app-appbar />
    <Nuxt />
    <app-stream-container ref="streamContainer" />
    <modals-edit-modal />
    <widgets-scan-alert />
  </div>
</template>

<script>
export default {
  middleware: 'authenticated',
  data() {
    return {
      socket: null
    }
  },
  watch: {
    $route(newVal) {
      if (this.$store.state.showEditModal) {
        this.$store.commit('setShowEditModal', false)
      }
      if (this.$store.state.selectedAudiobooks) {
        this.$store.commit('setSelectedAudiobooks', [])
      }
    }
  },
  computed: {
    user() {
      return this.$store.state.user.user
    }
  },
  methods: {
    connect() {
      console.log('[SOCKET] Connected')
      var token = this.$store.getters['user/getToken']
      this.socket.emit('auth', token)
    },
    connectError() {},
    disconnect() {
      console.log('[SOCKET] Disconnected')
    },
    reconnect() {},
    reconnectError() {},
    reconnectFailed() {},
    init(payload) {
      console.log('Init Payload', payload)
      if (payload.stream) {
        if (this.$refs.streamContainer) {
          this.$store.commit('setStream', payload.stream)
          this.$refs.streamContainer.streamOpen(payload.stream)
        }
      }
      if (payload.user) {
        this.$store.commit('user/setUser', payload.user)
        this.$store.commit('user/setSettings', payload.user.settings)
      }
    },
    streamOpen(stream) {
      if (this.$refs.streamContainer) this.$refs.streamContainer.streamOpen(stream)
    },
    streamClosed(streamId) {
      if (this.$refs.streamContainer) this.$refs.streamContainer.streamClosed(streamId)
    },
    streamProgress(data) {
      if (this.$refs.streamContainer) this.$refs.streamContainer.streamProgress(data)
    },
    streamReady() {
      if (this.$refs.streamContainer) this.$refs.streamContainer.streamReady()
    },
    streamReset(payload) {
      if (this.$refs.streamContainer) this.$refs.streamContainer.streamReset(payload)
    },
    audiobookAdded(audiobook) {
      this.$store.commit('audiobooks/addUpdate', audiobook)
    },
    audiobookUpdated(audiobook) {
      this.$store.commit('audiobooks/addUpdate', audiobook)
    },
    audiobookRemoved(audiobook) {
      if (this.$route.name.startsWith('audiobook')) {
        if (this.$route.params.id === audiobook.id) {
          this.$router.replace('/')
        }
      }
      this.$store.commit('audiobooks/remove', audiobook)
    },
    scanComplete({ scanType, results }) {
      if (scanType === 'covers') {
        this.$store.commit('setIsScanningCovers', false)
        if (results) {
          this.$toast.success(`Scan Finished\nUpdated ${results.found} covers`)
        }
      } else {
        this.$store.commit('setIsScanning', false)
        if (results) {
          var scanResultMsgs = []
          if (results.added) scanResultMsgs.push(`${results.added} added`)
          if (results.updated) scanResultMsgs.push(`${results.updated} updated`)
          if (results.removed) scanResultMsgs.push(`${results.removed} removed`)
          if (!scanResultMsgs.length) this.$toast.success('Scan Finished\nEverything was up to date')
          else this.$toast.success('Scan Finished\n' + scanResultMsgs.join('\n'))
        }
      }
    },
    scanStart(scanType) {
      if (scanType === 'covers') {
        this.$store.commit('setIsScanningCovers', true)
      } else {
        this.$store.commit('setIsScanning', true)
      }
    },
    scanProgress({ scanType, progress }) {
      if (scanType === 'covers') {
        this.$store.commit('setCoverScanProgress', progress)
      } else {
        this.$store.commit('setScanProgress', progress)
      }
    },
    userUpdated(user) {
      if (this.$store.state.user.user.id === user.id) {
        this.$store.commit('user/setUser', user)
        this.$store.commit('user/setSettings', user.settings)
      }
    },
    downloadStarted(download) {
      var filename = download.filename
      this.$toast.success(`Preparing download for "${filename}"`)

      download.isPending = true
      this.$store.commit('downloads/addUpdateDownload', download)
    },
    downloadReady(download) {
      var filename = download.filename
      this.$toast.success(`Download "${filename}" is ready!`)

      download.isPending = false
      this.$store.commit('downloads/addUpdateDownload', download)
    },
    downloadFailed(download) {
      var filename = download.filename
      this.$toast.error(`Download "${filename}" is failed`)

      download.isFailed = true
      download.isReady = false
      download.isPending = false
      this.$store.commit('downloads/addUpdateDownload', download)
    },
    downloadKilled(download) {
      var filename = download.filename
      this.$toast.error(`Download "${filename}" was terminated`)

      this.$store.commit('downloads/removeDownload', download)
    },
    downloadExpired(download) {
      download.isExpired = true
      download.isReady = false
      download.isPending = false
      this.$store.commit('downloads/addUpdateDownload', download)
    },
    initializeSocket() {
      this.socket = this.$nuxtSocket({
        name: process.env.NODE_ENV === 'development' ? 'dev' : 'prod',
        persist: 'main',
        teardown: true,
        transports: ['websocket'],
        upgrade: false
      })
      this.$root.socket = this.socket

      // Connection Listeners
      this.socket.on('connect', this.connect)
      this.socket.on('connect_error', this.connectError)
      this.socket.on('disconnect', this.disconnect)
      this.socket.on('reconnecting', this.reconnecting)
      this.socket.on('reconnect', this.reconnect)
      this.socket.on('reconnect_error', this.reconnectError)
      this.socket.on('reconnect_failed', this.reconnectFailed)

      this.socket.on('init', this.init)

      // Stream Listeners
      this.socket.on('stream_open', this.streamOpen)
      this.socket.on('stream_closed', this.streamClosed)
      this.socket.on('stream_progress', this.streamProgress)
      this.socket.on('stream_ready', this.streamReady)
      this.socket.on('stream_reset', this.streamReset)

      // Audiobook Listeners
      this.socket.on('audiobook_updated', this.audiobookUpdated)
      this.socket.on('audiobook_added', this.audiobookAdded)
      this.socket.on('audiobook_removed', this.audiobookRemoved)

      // User Listeners
      this.socket.on('user_updated', this.userUpdated)

      // Scan Listeners
      this.socket.on('scan_start', this.scanStart)
      this.socket.on('scan_complete', this.scanComplete)
      this.socket.on('scan_progress', this.scanProgress)

      // Download Listeners
      this.socket.on('download_started', this.downloadStarted)
      this.socket.on('download_ready', this.downloadReady)
      this.socket.on('download_failed', this.downloadFailed)
      this.socket.on('download_killed', this.downloadKilled)
      this.socket.on('download_expired', this.downloadExpired)
    }
  },
  mounted() {
    this.initializeSocket()

    if (this.$route.query.error) {
      this.$toast.error(this.$route.query.error)
      this.$router.replace(this.$route.path)
    }
  }
}
</script>