<template>
  <div class="w-full h-full px-1 md:px-4 py-1 mb-4">
    <div class="flex items-center py-2">
      <ui-toggle-switch v-model="useSquareBookCovers" @input="formUpdated" />
      <ui-tooltip :text="tooltips.coverAspectRatio">
        <p class="pl-4 text-base">
          Use square book covers
          <span class="material-icons icon-text text-sm">info_outlined</span>
        </p>
      </ui-tooltip>
    </div>
    <div class="py-3">
      <div class="flex items-center">
        <ui-toggle-switch v-if="!globalWatcherDisabled" v-model="disableWatcher" @input="formUpdated" />
        <ui-toggle-switch v-else disabled :value="false" />
        <p class="pl-4 text-base">Disable folder watcher for library</p>
      </div>
      <p v-if="globalWatcherDisabled" class="text-xs text-warning">*Watcher is disabled globally in server settings</p>
    </div>
    <div v-if="mediaType == 'book'" class="py-3">
      <div class="flex items-center">
        <ui-toggle-switch v-model="skipMatchingMediaWithAsin" @input="formUpdated" />
        <p class="pl-4 text-base">Skip matching books that already have an ASIN</p>
      </div>
    </div>
    <div v-if="mediaType == 'book'" class="py-3">
      <div class="flex items-center">
        <ui-toggle-switch v-model="skipMatchingMediaWithIsbn" @input="formUpdated" />
        <p class="pl-4 text-base">Skip matching books that already have an ISBN</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    library: {
      type: Object,
      default: () => null
    },
    processing: Boolean
  },
  data() {
    return {
      provider: null,
      useSquareBookCovers: false,
      disableWatcher: false,
      skipMatchingMediaWithAsin: false,
      skipMatchingMediaWithIsbn: false,
      tooltips: {
        coverAspectRatio: 'Prefer to use square covers over standard 1.6:1 book covers'
      }
    }
  },
  computed: {
    librarySettings() {
      return this.library.settings || {}
    },
    globalWatcherDisabled() {
      return this.$store.getters['getServerSetting']('scannerDisableWatcher')
    },
    mediaType() {
      return this.library.mediaType
    },
    providers() {
      if (this.mediaType === 'podcast') return this.$store.state.scanners.podcastProviders
      return this.$store.state.scanners.providers
    }
  },
  methods: {
    getLibraryData() {
      return {
        settings: {
          coverAspectRatio: this.useSquareBookCovers ? this.$constants.BookCoverAspectRatio.SQUARE : this.$constants.BookCoverAspectRatio.STANDARD,
          disableWatcher: !!this.disableWatcher,
          skipMatchingMediaWithAsin: !!this.skipMatchingMediaWithAsin,
          skipMatchingMediaWithIsbn: !!this.skipMatchingMediaWithIsbn
        }
      }
    },
    formUpdated() {
      this.$emit('update', this.getLibraryData())
    },
    init() {
      this.useSquareBookCovers = this.librarySettings.coverAspectRatio === this.$constants.BookCoverAspectRatio.SQUARE
      this.disableWatcher = !!this.librarySettings.disableWatcher
      this.skipMatchingMediaWithAsin = !!this.librarySettings.skipMatchingMediaWithAsin
      this.skipMatchingMediaWithIsbn = !!this.librarySettings.skipMatchingMediaWithIsbn
    }
  },
  mounted() {
    this.init()
  }
}
</script>