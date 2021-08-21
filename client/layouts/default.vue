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
    }
  },
  computed: {
    user() {
      return this.$store.state.user
    }
  },
  methods: {
    connect() {
      console.log('[SOCKET] Connected')
      var token = this.$store.getters.getToken
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
        this.$store.commit('setUser', payload.user)
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
    scanComplete() {
      this.$store.commit('setIsScanning', false)
      this.$toast.success('Scan Finished')
    },
    scanStart() {
      this.$store.commit('setIsScanning', true)
    },
    scanProgress(progress) {
      this.$store.commit('setScanProgress', progress)
    },
    userUpdated(user) {
      if (this.$store.state.user.id === user.id) {
        this.$store.commit('setUser', user)
      }
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
    },
    checkVersion() {
      this.$axios.$get('http://github.com/advplyr/audiobookshelf/raw/master/package.json').then((data) => {
        console.log('GOT DATA', data)
      })
    }
  },
  beforeMount() {
    if (!this.$store.state.user) {
      this.$router.replace(`/login?redirect=${this.$route.path}`)
    }
  },
  mounted() {
    this.initializeSocket()
    this.checkVersion()
  }
}
</script>