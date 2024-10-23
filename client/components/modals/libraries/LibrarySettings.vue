<template>
  <div class="w-full h-full px-1 md:px-4 py-1 mb-4">
    <div class="flex flex-wrap">
      <div class="flex items-center p-2 w-full md:w-1/2">
        <ui-toggle-switch v-model="useSquareBookCovers" size="sm" @input="formUpdated" />
        <ui-tooltip :text="$strings.LabelSettingsSquareBookCoversHelp">
          <p class="pl-4 text-sm">
            {{ $strings.LabelSettingsSquareBookCovers }}
            <span class="material-symbols icon-text text-sm">info</span>
          </p>
        </ui-tooltip>
      </div>
      <div class="p-2 w-full md:w-1/2">
        <div class="flex items-center">
          <ui-toggle-switch v-if="!globalWatcherDisabled" v-model="enableWatcher" size="sm" @input="formUpdated" />
          <ui-toggle-switch v-else disabled size="sm" :value="false" />
          <p class="pl-4 text-sm">{{ $strings.LabelSettingsEnableWatcherForLibrary }}</p>
        </div>
        <p v-if="globalWatcherDisabled" class="text-xs text-warning">*{{ $strings.MessageWatcherIsDisabledGlobally }}</p>
      </div>
      <div v-if="isBookLibrary" class="flex items-center p-2 w-full md:w-1/2">
        <ui-toggle-switch v-model="audiobooksOnly" size="sm" @input="formUpdated" />
        <ui-tooltip :text="$strings.LabelSettingsAudiobooksOnlyHelp">
          <p class="pl-4 text-sm">
            {{ $strings.LabelSettingsAudiobooksOnly }}
            <span class="material-symbols icon-text text-sm">info</span>
          </p>
        </ui-tooltip>
      </div>
      <div v-if="isBookLibrary" class="p-2 w-full md:w-1/2">
        <div class="flex items-center">
          <ui-toggle-switch v-model="skipMatchingMediaWithAsin" size="sm" @input="formUpdated" />
          <p class="pl-4 text-sm">{{ $strings.LabelSettingsSkipMatchingBooksWithASIN }}</p>
        </div>
      </div>
      <div v-if="isBookLibrary" class="p-2 w-full md:w-1/2">
        <div class="flex items-center">
          <ui-toggle-switch v-model="skipMatchingMediaWithIsbn" size="sm" @input="formUpdated" />
          <p class="pl-4 text-sm">{{ $strings.LabelSettingsSkipMatchingBooksWithISBN }}</p>
        </div>
      </div>
      <div v-if="isBookLibrary" class="p-2 w-full md:w-1/2">
        <div class="flex items-center">
          <ui-toggle-switch v-model="hideSingleBookSeries" size="sm" @input="formUpdated" />
          <ui-tooltip :text="$strings.LabelSettingsHideSingleBookSeriesHelp">
            <p class="pl-4 text-sm">
              {{ $strings.LabelSettingsHideSingleBookSeries }}
              <span class="material-symbols icon-text text-sm">info</span>
            </p>
          </ui-tooltip>
        </div>
      </div>
      <div v-if="isBookLibrary" class="p-2 w-full md:w-1/2">
        <div class="flex items-center">
          <ui-toggle-switch v-model="onlyShowLaterBooksInContinueSeries" size="sm" @input="formUpdated" />
          <ui-tooltip :text="$strings.LabelSettingsOnlyShowLaterBooksInContinueSeriesHelp">
            <p class="pl-4 text-sm">
              {{ $strings.LabelSettingsOnlyShowLaterBooksInContinueSeries }}
              <span class="material-symbols icon-text text-sm">info</span>
            </p>
          </ui-tooltip>
        </div>
      </div>
      <div v-if="isBookLibrary" class="p-2 w-full md:w-1/2">
        <div class="flex items-center">
          <ui-toggle-switch v-model="epubsAllowScriptedContent" size="sm" @input="formUpdated" />
          <ui-tooltip :text="$strings.LabelSettingsEpubsAllowScriptedContentHelp">
            <p class="pl-4 text-sm">
              {{ $strings.LabelSettingsEpubsAllowScriptedContent }}
              <span class="material-symbols icon-text text-sm">info</span>
            </p>
          </ui-tooltip>
        </div>
      </div>
      <div v-if="isPodcastLibrary" class="p-2 w-full md:w-1/2">
        <ui-dropdown :label="$strings.LabelPodcastSearchRegion" v-model="podcastSearchRegion" :items="$podcastSearchRegionOptions" small class="max-w-72" menu-max-height="200px" @input="formUpdated" />
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
      enableWatcher: false,
      skipMatchingMediaWithAsin: false,
      skipMatchingMediaWithIsbn: false,
      audiobooksOnly: false,
      epubsAllowScriptedContent: false,
      hideSingleBookSeries: false,
      onlyShowLaterBooksInContinueSeries: false,
      podcastSearchRegion: 'us'
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
    isBookLibrary() {
      return this.mediaType === 'book'
    },
    isPodcastLibrary() {
      return this.mediaType === 'podcast'
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
          disableWatcher: !this.enableWatcher,
          skipMatchingMediaWithAsin: !!this.skipMatchingMediaWithAsin,
          skipMatchingMediaWithIsbn: !!this.skipMatchingMediaWithIsbn,
          audiobooksOnly: !!this.audiobooksOnly,
          epubsAllowScriptedContent: !!this.epubsAllowScriptedContent,
          hideSingleBookSeries: !!this.hideSingleBookSeries,
          onlyShowLaterBooksInContinueSeries: !!this.onlyShowLaterBooksInContinueSeries,
          podcastSearchRegion: this.podcastSearchRegion
        }
      }
    },
    formUpdated() {
      this.$emit('update', this.getLibraryData())
    },
    init() {
      this.useSquareBookCovers = this.librarySettings.coverAspectRatio === this.$constants.BookCoverAspectRatio.SQUARE
      this.enableWatcher = !this.librarySettings.disableWatcher
      this.skipMatchingMediaWithAsin = !!this.librarySettings.skipMatchingMediaWithAsin
      this.skipMatchingMediaWithIsbn = !!this.librarySettings.skipMatchingMediaWithIsbn
      this.audiobooksOnly = !!this.librarySettings.audiobooksOnly
      this.epubsAllowScriptedContent = !!this.librarySettings.epubsAllowScriptedContent
      this.hideSingleBookSeries = !!this.librarySettings.hideSingleBookSeries
      this.onlyShowLaterBooksInContinueSeries = !!this.librarySettings.onlyShowLaterBooksInContinueSeries
      this.podcastSearchRegion = this.librarySettings.podcastSearchRegion || 'us'
    }
  },
  mounted() {
    this.init()
  }
}
</script>
