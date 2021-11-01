<template>
  <div id="page-wrapper" class="page p-6 overflow-y-auto" :class="streamAudiobook ? 'streaming' : ''">
    <div class="w-full max-w-4xl mx-auto">
      <div class="mb-4 flex items-end">
        <p class="text-2xl mr-4">Logger</p>

        <ui-text-input ref="input" v-model="search" placeholder="Search filter.." @input="inputUpdate" clearable class="w-40 h-8 text-sm" />

        <div class="flex-grow" />

        <div class="w-44">
          <ui-dropdown v-model="newServerSettings.logLevel" label="Server Log Level" :items="logLevelItems" @input="logLevelUpdated" />
        </div>
      </div>

      <div class="relative">
        <div ref="container" class="relative w-full h-full bg-primary border-bg overflow-x-hidden overflow-y-auto text-red shadow-inner rounded-md" style="max-height: 550px; min-height: 550px">
          <template v-for="(log, index) in logs">
            <div :key="index" class="flex flex-nowrap px-2 py-1 items-start text-sm bg-opacity-10" :class="`bg-${logColors[log.level]}`">
              <p class="text-gray-400 w-40 font-mono">{{ log.timestamp.split('.')[0].split('T').join(' ') }}</p>
              <p class="font-semibold w-12 text-right" :class="`text-${logColors[log.level]}`">{{ log.levelName }}</p>
              <p class="px-4 logmessage">{{ log.message }}</p>
            </div>
          </template>
        </div>

        <div v-if="!logs.length" class="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center text-center">
          <p class="text-xl text-gray-200 mb-2">No Logs</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsRoot']) {
      redirect('/?error=unauthorized')
    }
  },
  data() {
    return {
      search: null,
      searchTimeout: null,
      searchText: null,
      newServerSettings: {},
      logColors: ['yellow-200', 'gray-400', 'info', 'warning', 'error', 'red-800', 'blue-400'],
      logLevels: [
        {
          value: 1,
          text: 'Debug'
        },
        {
          value: 2,
          text: 'Info'
        },
        {
          value: 3,
          text: 'Warn'
        }
      ],
      loadedLogs: []
    }
  },
  watch: {
    serverSettings(newVal, oldVal) {
      if (newVal && !oldVal) {
        this.newServerSettings = { ...this.serverSettings }
      }
    },
    logs() {
      this.updateScroll()
    }
  },
  computed: {
    logLevelItems() {
      if (process.env.NODE_ENV === 'production') return this.logLevels
      this.logLevels.unshift({ text: 'Trace', value: 0 })
      return this.logLevels
    },
    logs() {
      return this.loadedLogs.filter((log) => {
        if (log.level >= this.newServerSettings.logLevel) {
          if (this.searchText) {
            return log.message.toLowerCase().includes(this.searchText)
          }
          return true
        }
        return false
      })
    },
    serverSettings() {
      return this.$store.state.serverSettings
    },
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    }
  },
  methods: {
    inputUpdate() {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = setTimeout(() => {
        if (!this.search || !this.search.trim()) {
          this.searchText = ''
          return
        }
        this.searchText = this.search.toLowerCase().trim()
      }, 500)
    },
    updateScroll() {
      if (this.$refs.container) {
        this.$refs.container.scrollTop = this.$refs.container.scrollHeight - this.$refs.container.clientHeight
      }
    },
    logLevelUpdated(val) {
      var payload = {
        logLevel: Number(val)
      }
      this.updateServerSettings(payload)

      this.$root.socket.emit('set_log_listener', this.newServerSettings.logLevel)
      this.$nextTick(this.updateScroll)
    },
    updateServerSettings(payload) {
      this.$store
        .dispatch('updateServerSettings', payload)
        .then((success) => {
          console.log('Updated Server Settings', success)
        })
        .catch((error) => {
          console.error('Failed to update server settings', error)
        })
    },
    logEvtReceived(payload) {
      this.loadedLogs.push(payload)

      // Dont let logs get too large
      if (this.loadedLogs.length > 5050) {
        this.loadedLogs = this.loadedLogs.slice(-5000)
      }
    },
    init(attempts = 0) {
      if (!this.$root.socket) {
        if (attempts > 10) {
          return console.error('Failed to setup socket listeners')
        }
        setTimeout(() => {
          this.init(++attempts)
        }, 250)
        return
      }

      this.newServerSettings = this.serverSettings ? { ...this.serverSettings } : {}
      this.$root.socket.on('daily_logs', this.dailyLogsLoaded)
      this.$root.socket.on('log', this.logEvtReceived)
      this.$root.socket.emit('set_log_listener', this.newServerSettings.logLevel)
      this.$root.socket.emit('fetch_daily_logs')
    },
    dailyLogsLoaded(lines) {
      this.loadedLogs = lines
    }
  },
  updated() {
    this.$nextTick(this.updateScroll)
  },
  mounted() {
    this.init()
  },
  beforeDestroy() {
    if (!this.$root.socket) return
    this.$root.socket.off('daily_logs', this.dailyLogsLoaded)
    this.$root.socket.off('log', this.logEvtReceived)
  }
}
</script>

<style scoped>
.logmessage {
  width: calc(100% - 208px);
}
</style>