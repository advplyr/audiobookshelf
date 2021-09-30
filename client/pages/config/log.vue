<template>
  <div id="page-wrapper" class="page p-6 overflow-y-auto" :class="streamAudiobook ? 'streaming' : ''">
    <div class="w-full max-w-4xl mx-auto">
      <div class="mb-4 flex items-center justify-between">
        <p class="text-2xl">Logger</p>

        <ui-dropdown v-model="newServerSettings.logLevel" label="Server Log Level" :items="logLevelItems" @input="logLevelUpdated" />
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
          <p class="text-base text-gray-400">Log listening starts when you login</p>
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
      ]
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
      return this.$store.state.logs.logs.filter((log) => {
        return log.level >= this.newServerSettings.logLevel
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

      this.$store.dispatch('logs/setLogListener', this.newServerSettings.logLevel)
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
    }
  },
  updated() {
    this.$nextTick(this.updateScroll)
  },
  mounted() {
    this.init()
  }
}
</script>

<style scoped>
.logmessage {
  width: calc(100% - 208px);
}
</style>