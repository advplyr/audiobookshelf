<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderLogs" :description="$strings.MessageLogsDescription">
      <template #header-items>
        <ui-tooltip :text="$strings.LabelClickForMoreInfo" class="inline-flex ml-2">
          <a href="https://www.audiobookshelf.org/guides/server_logs" target="_blank" class="inline-flex">
            <span class="material-symbols text-xl w-5 text-gray-200">help_outline</span>
          </a>
        </ui-tooltip>
      </template>

      <div class="flex justify-between mb-2 place-items-end">
        <ui-text-input ref="input" v-model="search" :placeholder="$strings.PlaceholderSearch" @input="inputUpdate" clearable class="w-full sm:w-40 h-8 text-sm sm:mb-0" />

        <ui-dropdown v-model="newServerSettings.logLevel" :label="$strings.LabelServerLogLevel" :items="logLevelItems" @input="logLevelUpdated" class="w-full sm:w-44" />
      </div>

      <div class="relative">
        <div ref="container" id="log-container" class="relative w-full h-full bg-primary border-bg overflow-x-hidden overflow-y-auto text-red shadow-inner rounded-md" style="min-height: 550px">
          <template v-for="(log, index) in logs">
            <div :key="index" class="flex flex-nowrap px-2 py-1 items-start text-sm" :class="`${bgColors[log.level]}`">
              <p class="text-gray-400 w-36 font-mono text-xs">{{ log.timestamp }}</p>
              <p class="font-semibold w-12 text-right text-sm" :class="`${textColors[log.level]}`">{{ log.levelName }}</p>
              <p class="px-4 logmessage">{{ log.message }}</p>
            </div>
          </template>
        </div>

        <div v-if="!logs.length" class="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center text-center">
          <p class="text-xl text-gray-200 mb-2">{{ $strings.MessageNoLogs }}</p>
        </div>
      </div>
    </app-settings-content>
  </div>
</template>

<script>
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
    }
  },
  data() {
    return {
      search: null,
      searchTimeout: null,
      searchText: null,
      newServerSettings: {},
      textColors: ['text-yellow-200', 'text-gray-400', 'text-info', 'text-warning', 'text-error', 'text-red-800', 'text-blue-400'],
      bgColors: ['bg-yellow-200/10', 'bg-gray-400/10', 'bg-info/10', 'bg-warning/10', 'bg-error/10', 'bg-red-800/10', 'bg-blue-400/10'],
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
    logLevels() {
      return [
        {
          value: 1,
          text: this.$strings.LabelLogLevelDebug
        },
        {
          value: 2,
          text: this.$strings.LabelLogLevelInfo
        },
        {
          value: 3,
          text: this.$strings.LabelLogLevelWarn
        }
      ]
    },
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
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
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
    async loadLoggerData() {
      const loggerData = await this.$axios.$get('/api/logger-data').catch((error) => {
        console.error('Failed to load logger data', error)
        this.$toast.error(this.$strings.ToastFailedToLoadData)
      })

      this.loadedLogs = loggerData?.currentDailyLogs || []
    },
    async init(attempts = 0) {
      if (!this.$root.socket) {
        if (attempts > 10) {
          return console.error('Failed to setup socket listeners')
        }
        setTimeout(() => {
          this.init(++attempts)
        }, 250)
        return
      }

      await this.loadLoggerData()

      this.newServerSettings = this.serverSettings ? { ...this.serverSettings } : {}
      this.$root.socket.on('log', this.logEvtReceived)
      this.$root.socket.emit('set_log_listener', this.newServerSettings.logLevel)
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
    this.$root.socket.emit('remove_log_listener')
    this.$root.socket.off('log', this.logEvtReceived)
  }
}
</script>

<style scoped>
#log-container {
  height: calc(100vh - 285px);
}
.logmessage {
  width: calc(100% - 208px);
}
</style>
