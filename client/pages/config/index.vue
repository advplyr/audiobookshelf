<template>
  <div>
    <!-- <div class="h-0.5 bg-primary bg-opacity-50 w-full" /> -->

    <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8">
      <div class="flex items-center mb-2">
        <h1 class="text-xl">Settings</h1>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="newServerSettings.storeCoverWithItem" :disabled="updatingServerSettings" @input="(val) => updateSettingsKey('storeCoverWithItem', val)" />
        <ui-tooltip :text="tooltips.storeCoverWithItem">
          <p class="pl-4 text-lg">
            Store covers with item
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="newServerSettings.storeMetadataWithItem" :disabled="updatingServerSettings" @input="(val) => updateSettingsKey('storeMetadataWithItem', val)" />
        <ui-tooltip :text="tooltips.storeMetadataWithItem">
          <p class="pl-4 text-lg">
            Store metadata with item
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="useSquareBookCovers" :disabled="updatingServerSettings" @input="updateBookCoverAspectRatio" />
        <ui-tooltip :text="tooltips.coverAspectRatio">
          <p class="pl-4 text-lg">
            Use square book covers
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="useAlternativeBookshelfView" :disabled="updatingServerSettings" @input="updateAlternativeBookshelfView" />
        <ui-tooltip :text="tooltips.bookshelfView">
          <p class="pl-4 text-lg">
            Use alternative bookshelf view
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="newServerSettings.sortingIgnorePrefix" :disabled="updatingServerSettings" @input="(val) => updateSettingsKey('sortingIgnorePrefix', val)" />
        <ui-tooltip :text="tooltips.sortingIgnorePrefix">
          <p class="pl-4 text-lg">
            Ignore prefixes when sorting title and series
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
      </div>
      <div v-if="newServerSettings.sortingIgnorePrefix" class="w-72 ml-14 mb-2">
        <ui-multi-select v-model="newServerSettings.sortingPrefixes" small :items="newServerSettings.sortingPrefixes" label="Prefixes to Ignore (case insensitive)" @input="updateSortingPrefixes" :disabled="updatingServerSettings" />
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="newServerSettings.chromecastEnabled" :disabled="updatingServerSettings" @input="(val) => updateSettingsKey('chromecastEnabled', val)" />
        <p class="pl-4 text-lg">Enable Chromecast</p>
      </div>

      <div class="flex items-center mb-2 mt-8">
        <h1 class="text-xl">Scanner Settings</h1>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="newServerSettings.scannerParseSubtitle" :disabled="updatingServerSettings" @input="(val) => updateSettingsKey('scannerParseSubtitle', val)" />
        <ui-tooltip :text="tooltips.scannerParseSubtitle">
          <p class="pl-4 text-lg">
            Scanner parse subtitles
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="newServerSettings.scannerFindCovers" :disabled="updatingServerSettings" @input="(val) => updateSettingsKey('scannerFindCovers', val)" />
        <ui-tooltip :text="tooltips.scannerFindCovers">
          <p class="pl-4 text-lg">
            Scanner find covers
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
        <div class="flex-grow" />
      </div>
      <div v-if="newServerSettings.scannerFindCovers" class="w-44 ml-14 mb-2">
        <ui-dropdown v-model="newServerSettings.scannerCoverProvider" small :items="providers" label="Cover Provider" @input="updateScannerCoverProvider" :disabled="updatingServerSettings" />
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="newServerSettings.scannerPreferAudioMetadata" :disabled="updatingServerSettings" @input="(val) => updateSettingsKey('scannerPreferAudioMetadata', val)" />
        <ui-tooltip :text="tooltips.scannerPreferAudioMetadata">
          <p class="pl-4 text-lg">
            Scanner prefer audio metadata
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="newServerSettings.scannerPreferOverdriveMediaMarker" :disabled="updatingServerSettings" @input="(val) => updateSettingsKey('scannerPreferOverdriveMediaMarker', val)" />
        <ui-tooltip :text="tooltips.scannerPreferOverdriveMediaMarker">
          <p class="pl-4 text-lg">
            Scanner prefer Overdrive Media Markers for chapters
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="newServerSettings.scannerPreferOpfMetadata" :disabled="updatingServerSettings" @input="(val) => updateSettingsKey('scannerPreferOpfMetadata', val)" />
        <ui-tooltip :text="tooltips.scannerPreferOpfMetadata">
          <p class="pl-4 text-lg">
            Scanner prefer OPF metadata
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="newServerSettings.scannerPreferMatchedMetadata" :disabled="updatingServerSettings" @input="(val) => updateSettingsKey('scannerPreferMatchedMetadata', val)" />
        <ui-tooltip :text="tooltips.scannerPreferMatchedMetadata">
          <p class="pl-4 text-lg">
            Scanner prefer matched metadata
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="newServerSettings.scannerDisableWatcher" :disabled="updatingServerSettings" @input="(val) => updateSettingsKey('scannerDisableWatcher', val)" />
        <ui-tooltip :text="tooltips.scannerDisableWatcher">
          <p class="pl-4 text-lg">
            Disable Watcher
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
      </div>

      <div class="flex items-center mb-2 mt-8">
        <h1 class="text-xl">Experimental Feature Settings</h1>
      </div>

      <div class="flex items-center py-2">
        <ui-toggle-switch v-model="newServerSettings.enableEReader" :disabled="updatingServerSettings" @input="(val) => updateSettingsKey('enableEReader', val)" />
        <ui-tooltip :text="tooltips.enableEReader">
          <p class="pl-4 text-lg">
            Enable e-reader for all users
            <span class="material-icons icon-text">info_outlined</span>
          </p>
        </ui-tooltip>
      </div>

      <div clas="flex items-center py-2">
          <ui-dropdown v-model="newServerSettings.dateFormat" :items="dateFormats" small @input="(val) => updateSettingsKey('dateFormat', val)" style="width: 10em; display:inline-flex" />
            <p class="pl-4 text-lg" style="display:inline-flex; vertical-align: top;">
              Date Format
              <span class="material-icons icon-text">info_outlined</span>
            </p>
      </div>

    </div>

    <div class="h-0.5 bg-primary bg-opacity-30 w-full" />

    <div class="flex items-center py-4">
      <ui-btn color="bg" small :padding-x="4" class="hidden lg:block mr-2" :loading="isPurgingCache" @click="purgeCache">Purge Cache</ui-btn>
      <ui-btn color="bg" small :padding-x="4" class="hidden lg:block" :loading="isResettingLibraryItems" @click="resetLibraryItems">Remove All Library Items</ui-btn>
      <div class="flex-grow" />
      <p class="pr-2 text-sm font-book text-yellow-400">
        Report bugs, request features, and contribute on
        <a class="underline" href="https://github.com/advplyr/audiobookshelf" target="_blank">github</a>
      </p>
      <a href="https://github.com/advplyr/audiobookshelf" target="_blank" class="text-white hover:text-gray-200 hover:scale-150 hover:rotate-6 transform duration-500">
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24" height="24" viewBox="0 0 24 24">
          <path
            d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
          />
        </svg>
      </a>
      <p class="pl-4 pr-2 text-sm font-book text-yellow-400">
        Join us on
        <a class="underline" href="https://discord.gg/pJsjuNCKRq" target="_blank">discord</a>
      </p>
      <a href="https://discord.gg/pJsjuNCKRq" target="_blank" class="text-white hover:text-gray-200 hover:scale-150 hover:rotate-6 transform duration-500">
        <svg width="31" height="24" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clip-path="url(#clip0)">
            <path
              d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"
              fill="#ffffff"
            />
          </g>
          <defs>
            <clipPath id="clip0">
              <rect width="71" height="55" fill="white" />
            </clipPath>
          </defs>
        </svg>
      </a>
    </div>

    <div class="h-0.5 bg-primary bg-opacity-30 w-full" />

    <div class="py-12 mb-4 opacity-60 hover:opacity-100">
      <div class="flex items-center">
        <div>
          <div class="flex items-center">
            <ui-toggle-switch v-model="showExperimentalFeatures" />
            <ui-tooltip :text="tooltips.experimentalFeatures">
              <p class="pl-4 text-lg">
                Experimental Features
                <a href="https://github.com/advplyr/audiobookshelf/discussions/75" target="_blank">
                  <span class="material-icons icon-text">info_outlined</span>
                </a>
              </p>
            </ui-tooltip>
          </div>
        </div>
      </div>
    </div>

    <prompt-dialog v-model="showConfirmPurgeCache" :width="675">
      <div class="px-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300">
        <p class="text-error text-lg font-semibold">Important Notice!</p>
        <p class="text-lg my-2 text-center">Purge cache will delete the entire directory at <span class="font-mono">/metadata/cache</span>.</p>

        <p class="text-lg text-center mb-8">Are you sure you want to remove the cache directory?</p>
        <div class="flex px-1 items-center">
          <ui-btn color="primary" @click="showConfirmPurgeCache = false">Nevermind</ui-btn>
          <div class="flex-grow" />
          <ui-btn color="success" @click="confirmPurge">Yes, Purge!</ui-btn>
        </div>
      </div>
    </prompt-dialog>
  </div>
</template>

<script>
export default {
  data() {
    return {
      isResettingLibraryItems: false,
      updatingServerSettings: false,
      useSquareBookCovers: false,
      useAlternativeBookshelfView: false,
      isPurgingCache: false,
      newServerSettings: {},
      tooltips: {
        experimentalFeatures: 'Features in development that could use your feedback and help testing. Click to open github discussion.',
        scannerDisableWatcher: 'Disables the automatic adding/updating of items when file changes are detected. *Requires server restart',
        scannerPreferOpfMetadata: 'OPF file metadata will be used for book details over folder names',
        scannerPreferMatchedMetadata: 'Matched data will overide book details when using Quick Match',
        scannerPreferAudioMetadata: 'Audio file ID3 meta tags will be used for book details over folder names',
        scannerParseSubtitle: 'Extract subtitles from audiobook folder names.<br>Subtitle must be seperated by " - "<br>i.e. "Book Title - A Subtitle Here" has the subtitle "A Subtitle Here"',
        sortingIgnorePrefix: 'i.e. for prefix "the" book title "The Book Title" would sort as "Book Title, The"',
        scannerFindCovers: 'If your audiobook does not have an embedded cover or a cover image inside the folder, the scanner will attempt to find a cover.<br>Note: This will extend scan time',
        bookshelfView: 'Alternative view without wooden bookshelf',
        storeCoverWithItem: 'By default covers are stored in /metadata/items, enabling this setting will store covers in your library item folder. Only one file named "cover" will be kept',
        storeMetadataWithItem: 'By default metadata files are stored in /metadata/items, enabling this setting will store metadata files in your library item folders. Uses .abs file extension',
        coverAspectRatio: 'Prefer to use square covers over standard 1.6:1 book covers',
        enableEReader: 'E-reader is still a work in progress, but use this setting to open it up to all your users (or use the "Experimental Features" toggle below just for you)',
        scannerPreferOverdriveMediaMarker: 'MP3 files from Overdrive come with chapter timings embedded as custom metadata. Enabling this will use these tags for chapter timings automatically'
      },
      showConfirmPurgeCache: false
    }
  },
  watch: {
    serverSettings(newVal, oldVal) {
      if (newVal && !oldVal) {
        this.initServerSettings()
      }
    }
  },
  computed: {
    serverSettings() {
      return this.$store.state.serverSettings
    },
    providers() {
      return this.$store.state.scanners.providers
    },
    showExperimentalFeatures: {
      get() {
        return this.$store.state.showExperimentalFeatures
      },
      set(val) {
        this.$store.commit('setExperimentalFeatures', val)
      }
    },
    dateFormats() {
      return this.$store.state.globals.dateFormats
    }
  },
  methods: {
    updateEnableChromecast(val) {
      this.updateServerSettings({ enableChromecast: val })
    },
    updateSortingPrefixes(val) {
      if (!val || !val.length) {
        this.$toast.error('Must have at least 1 prefix')
        return
      }
      var prefixes = val.map((prefix) => prefix.trim().toLowerCase())
      this.updateServerSettings({
        sortingPrefixes: prefixes
      })
    },
    updateScannerCoverProvider(val) {
      this.updateServerSettings({
        scannerCoverProvider: val
      })
    },
    updateBookCoverAspectRatio(val) {
      this.updateServerSettings({
        coverAspectRatio: val ? this.$constants.BookCoverAspectRatio.SQUARE : this.$constants.BookCoverAspectRatio.STANDARD
      })
    },
    updateAlternativeBookshelfView(val) {
      this.updateServerSettings({
        bookshelfView: val ? this.$constants.BookshelfView.TITLES : this.$constants.BookshelfView.STANDARD
      })
    },
    updateSettingsKey(key, val) {
      this.updateServerSettings({
        [key]: val
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
    initServerSettings() {
      this.newServerSettings = this.serverSettings ? { ...this.serverSettings } : {}
      this.newServerSettings.sortingPrefixes = [...(this.newServerSettings.sortingPrefixes || [])]

      this.useSquareBookCovers = this.newServerSettings.coverAspectRatio === this.$constants.BookCoverAspectRatio.SQUARE

      this.useAlternativeBookshelfView = this.newServerSettings.bookshelfView === this.$constants.BookshelfView.TITLES
    },
    resetLibraryItems() {
      if (confirm('WARNING! This action will remove all library items from the database including any updates or matches you have made. This does not do anything to your actual files. Shall we continue?')) {
        this.isResettingLibraryItems = true
        this.$axios
          .$delete('/api/items/all')
          .then(() => {
            this.isResettingLibraryItems = false
            this.$toast.success('Successfully reset items')
            location.reload()
          })
          .catch((error) => {
            console.error('failed to reset items', error)
            this.isResettingLibraryItems = false
            this.$toast.error('Failed to reset items - manually remove the /config/libraryItems folder')
          })
      }
    },
    purgeCache() {
      this.showConfirmPurgeCache = true
    },
    async confirmPurge() {
      this.showConfirmPurgeCache = false
      this.isPurgingCache = true
      await this.$axios
        .$post('/api/purgecache')
        .then(() => {
          this.$toast.success('Cache Purged!')
        })
        .catch((error) => {
          console.error('Failed to purge cache', error)
          this.$toast.error('Failed to purge cache')
        })
      this.isPurgingCache = false
    }
  },
  mounted() {
    this.initServerSettings()
  }
}
</script>