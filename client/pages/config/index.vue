<template>
  <div id="page-wrapper" class="page p-6 overflow-y-auto" :class="streamAudiobook ? 'streaming' : ''">
    <div class="w-full max-w-4xl mx-auto">
      <tables-users-table />
      <!-- <div class="h-0.5 bg-primary bg-opacity-50 w-full" /> -->

      <tables-libraries-table />
      <!-- <div class="h-0.5 bg-primary bg-opacity-50 w-full" /> -->
      <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8">
        <div class="flex items-center mb-2">
          <h1 class="text-xl">Settings</h1>
        </div>

        <div class="flex items-center py-2">
          <ui-toggle-switch v-model="newServerSettings.scannerParseSubtitle" small :disabled="updatingServerSettings" @input="updateScannerParseSubtitle" />
          <ui-tooltip :text="parseSubtitleTooltip">
            <p class="pl-4 text-lg">Scanner parse subtitles <span class="material-icons icon-text">info_outlined</span></p>
          </ui-tooltip>
        </div>

        <div class="flex items-center py-2">
          <ui-toggle-switch v-model="newServerSettings.scannerFindCovers" :disabled="updatingServerSettings" @input="updateScannerFindCovers" />
          <ui-tooltip :text="scannerFindCoversTooltip">
            <p class="pl-4 text-lg">Scanner find covers <span class="material-icons icon-text">info_outlined</span></p>
          </ui-tooltip>
        </div>

        <div class="flex items-center py-2">
          <ui-toggle-switch v-model="storeCoversInAudiobookDir" :disabled="updatingServerSettings" @input="updateCoverStorageDestination" />
          <ui-tooltip :text="coverDestinationTooltip">
            <p class="pl-4 text-lg">Store covers with audiobook <span class="material-icons icon-text">info_outlined</span></p>
          </ui-tooltip>
        </div>
      </div>

      <!-- <div class="py-4">
        <p class="text-2xl">Scanner</p>
        <div class="flex items-start py-2">
          <div class="py-2">
            <div class="flex items-center">
              <ui-toggle-switch v-model="newServerSettings.scannerParseSubtitle" :disabled="updatingServerSettings" @input="updateScannerParseSubtitle" />
              <ui-tooltip :text="parseSubtitleTooltip">
                <p class="pl-4 text-lg">Parse subtitles <span class="material-icons icon-text">info_outlined</span></p>
              </ui-tooltip>
            </div>
          </div>
          <div class="flex-grow" />
          <div class="w-40 flex flex-col">
            <ui-btn color="success" class="mb-4" :loading="isScanning" :disabled="isScanningCovers" @click="scan">Scan</ui-btn>

            <div class="w-full mb-4">
              <ui-tooltip direction="bottom" text="(Warning: Long running task!) Attempts to lookup and match a cover with all audiobooks that don't have one." class="w-full">
                <ui-btn color="primary" class="w-full" small :padding-x="2" :loading="isScanningCovers" :disabled="isScanning" @click="scanCovers">Scan for Covers</ui-btn>
              </ui-tooltip>
            </div>
          </div>
        </div>
      </div>

      <div class="h-0.5 bg-primary bg-opacity-50 w-full" />

      <div class="py-4 mb-4">
        <p class="text-2xl">Metadata</p>
        <div class="flex items-start py-2">
          <div class="py-2">
            <div class="flex items-center">
              <ui-toggle-switch v-model="storeCoversInAudiobookDir" :disabled="updatingServerSettings" @input="updateCoverStorageDestination" />
              <ui-tooltip :text="coverDestinationTooltip">
                <p class="pl-4 text-lg">Store covers with audiobook <span class="material-icons icon-text">info_outlined</span></p>
              </ui-tooltip>
            </div>
          </div>
          <div class="flex-grow" />
          <div class="w-40 flex flex-col">
            <ui-tooltip :text="saveMetadataTooltip" direction="bottom" class="w-full">
              <ui-btn color="primary" small class="w-full" @click="saveMetadataFiles">Save Metadata</ui-btn>
            </ui-tooltip>
          </div>
        </div>
      </div> -->

      <div class="h-0.5 bg-primary bg-opacity-50 w-full" />

      <div class="flex items-center py-4">
        <ui-btn color="bg" small :padding-x="4" :loading="isResettingAudiobooks" @click="resetAudiobooks">Reset All Audiobooks</ui-btn>
        <div class="flex-grow" />
        <ui-btn to="/config/log">View Logger</ui-btn>
      </div>

      <div class="h-0.5 bg-primary bg-opacity-50 w-full" />

      <div class="flex items-center py-4">
        <p class="font-mono">v{{ $config.version }}</p>
        <div class="flex-grow" />
        <p class="pr-2 text-sm font-book text-yellow-400">Report bugs, request features, provide feedback, and contribute on <a class="underline" href="https://github.com/advplyr/audiobookshelf" target="_blank">github</a>.</p>
        <a href="https://github.com/advplyr/audiobookshelf" target="_blank" class="text-white hover:text-gray-200 hover:scale-150 hover:rotate-6 transform duration-500">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24" height="24" viewBox="0 0 24 24">
            <path
              d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
            />
          </svg>
        </a>
      </div>

      <div class="h-0.5 bg-primary bg-opacity-30 w-full" />

      <div class="py-12 mb-4 opacity-60 hover:opacity-100">
        <div class="flex items-center">
          <div>
            <div class="flex items-center">
              <ui-toggle-switch v-model="showExperimentalFeatures" @input="toggleShowExperimentalFeatures" />
              <ui-tooltip :text="experimentalFeaturesTooltip">
                <p class="pl-4 text-lg">Experimental Features <span class="material-icons icon-text">info_outlined</span></p>
              </ui-tooltip>
            </div>
          </div>
          <!-- <div class="flex-grow" /> -->
          <div>
            <a href="https://github.com/advplyr/audiobookshelf/discussions/75#discussion-3604812" target="_blank" class="text-blue-500 hover:text-blue-300 underline">Join the discussion</a>
          </div>
        </div>
      </div>
    </div>

    <div class="fixed bottom-0 left-0 w-10 h-10" @dblclick="setDeveloperMode"></div>
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
      storeCoversInAudiobookDir: false,
      isResettingAudiobooks: false,
      newServerSettings: {},
      updatingServerSettings: false
    }
  },
  watch: {
    serverSettings(newVal, oldVal) {
      if (newVal && !oldVal) {
        this.newServerSettings = { ...this.serverSettings }
        this.storeCoversInAudiobookDir = this.newServerSettings.coverDestination === this.$constants.CoverDestination.AUDIOBOOK
      }
    }
  },
  computed: {
    parseSubtitleTooltip() {
      return 'Extract subtitles from audiobook directory names.<br>Subtitle must be seperated by " - "<br>i.e. "Book Title - A Subtitle Here" has the subtitle "A Subtitle Here"'
    },
    coverDestinationTooltip() {
      return 'By default covers are stored in /metadata/books, enabling this setting will store covers inside your audiobooks directory. Only one file named "cover" will be kept.'
    },
    scannerFindCoversTooltip() {
      return 'If your audiobook does not have an embedded cover or a cover image inside the folder, the scanner will attempt to find a cover.<br>Note: This will extend scan time'
    },
    saveMetadataTooltip() {
      return 'This will write a "metadata.nfo" file in all of your audiobook directories.'
    },
    experimentalFeaturesTooltip() {
      return 'Features in development that could use your feedback and help testing.'
    },
    serverSettings() {
      return this.$store.state.serverSettings
    },
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    isScanning() {
      return this.$store.state.isScanning
    },
    isScanningCovers() {
      return this.$store.state.isScanningCovers
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    }
  },
  methods: {
    toggleShowExperimentalFeatures() {
      this.$store.commit('setExperimentalFeatures', !this.showExperimentalFeatures)
    },
    updateScannerFindCovers(val) {
      this.updateServerSettings({
        scannerFindCovers: !!val
      })
    },
    updateCoverStorageDestination(val) {
      this.newServerSettings.coverDestination = val ? this.$constants.CoverDestination.AUDIOBOOK : this.$constants.CoverDestination.METADATA
      this.updateServerSettings({
        coverDestination: this.newServerSettings.coverDestination
      })
    },
    updateScannerParseSubtitle(val) {
      this.updateServerSettings({
        scannerParseSubtitle: !!val
      })
    },
    updateServerSettings(payload) {
      this.updatingServerSettings = true
      this.$store
        .dispatch('updateServerSettings', payload)
        .then((success) => {
          console.log('Updated Server Settings', success)
          this.updatingServerSettings = false
        })
        .catch((error) => {
          console.error('Failed to update server settings', error)
          this.updatingServerSettings = false
        })
    },
    setDeveloperMode() {
      var value = !this.$store.state.developerMode
      this.$store.commit('setDeveloperMode', value)
      this.$toast.info(`Developer Mode ${value ? 'Enabled' : 'Disabled'}`)
    },
    scan() {
      this.$root.socket.emit('scan', this.$store.state.libraries.currentLibraryId)
    },
    scanCovers() {
      this.$root.socket.emit('scan_covers')
    },
    saveMetadataComplete(result) {
      this.savingMetadata = false
      if (!result) return
      this.$toast.success(`Metadata saved for ${result.success} audiobooks`)
    },
    saveMetadataFiles() {
      this.savingMetadata = true
      this.$root.socket.once('save_metadata_complete', this.saveMetadataComplete)
      this.$root.socket.emit('save_metadata')
    },
    resetAudiobooks() {
      if (confirm('WARNING! This action will remove all audiobooks from the database including any updates or matches you have made. This does not do anything to your actual files. Shall we continue?')) {
        this.isResettingAudiobooks = true
        this.$axios
          .$delete('/api/audiobooks')
          .then(() => {
            this.isResettingAudiobooks = false
            this.$toast.success('Successfully reset audiobooks')
            location.reload()
          })
          .catch((error) => {
            console.error('failed to reset audiobooks', error)
            this.isResettingAudiobooks = false
            this.$toast.error('Failed to reset audiobooks - manually remove the /config/audiobooks folder')
          })
      }
    },
    init() {
      this.newServerSettings = this.serverSettings ? { ...this.serverSettings } : {}
      this.storeCoversInAudiobookDir = this.newServerSettings.coverDestination === this.$constants.CoverDestination.AUDIOBOOK
    }
  },
  mounted() {
    this.init()
  }
}
</script>

<style>
#accounts {
  table-layout: fixed;
  border-collapse: collapse;
  width: 100%;
}

#accounts td,
#accounts th {
  border: 1px solid #2e2e2e;
  padding: 8px 8px;
  text-align: left;
}

#accounts tr:nth-child(even) {
  background-color: #3a3a3a;
}

#accounts tr:hover {
  background-color: #444;
}

#accounts th {
  font-size: 0.8rem;
  font-weight: 600;
  padding-top: 5px;
  padding-bottom: 5px;
  background-color: #333;
}
</style>