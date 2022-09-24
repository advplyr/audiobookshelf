<template>
  <modals-modal v-model="show" name="batchQuickMatch" :processing="processing" :width="500" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>

    <div ref="container" class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full">
        <div class="py-4 px-4">
          <h1 class="text-2xl">Quick Match {{ selectedBookIds.length }} Books</h1>
        </div>
        
        <div class="w-full overflow-y-auto overflow-x-hidden max-h-96">
          <div class="flex px-8 items-center py-2">
            <p class="pr-4">Provider</p>
            <ui-dropdown v-model="options.provider" :items="providers" small />
          </div>
          <p class="text-base px-8 py-2">Quick Match will attempt to add missing covers and metadata for the selected books.  Enable the options below to allow Quick Match to overwrite existing covers and/or metadata.</p>
          <div class="flex px-8 items-end py-2">
            <ui-toggle-switch v-model="options.overrideCover"/>
            <ui-tooltip :text="tooltips.updateCovers">
              <p class="pl-4">
                Update Covers
                <span class="material-icons icon-text text-sm">info_outlined</span>
              </p>
            </ui-tooltip>
          </div>
          <div class="flex px-8 items-end py-2">
            <ui-toggle-switch v-model="options.overrideDetails"/>
            <ui-tooltip :text="tooltips.updateDetails">
              <p class="pl-4">
                Update Details
                <span class="material-icons icon-text text-sm">info_outlined</span>
              </p>
            </ui-tooltip>
          </div>
          <div class="mt-4 py-4 border-b border-white border-opacity-10 text-white text-opacity-80" :class="isScrollable ? 'box-shadow-md-up' : 'border-t border-white border-opacity-5'">
            <div class="flex items-center px-4">
              <ui-btn type="button" @click="show = false">Cancel</ui-btn>
              <div class="flex-grow" />
              <ui-btn color="success" @click="doBatchQuickMatch">Continue</ui-btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false,
      isScrollable: false,
      lastUsedLibrary: undefined,
      options: {
        provider: undefined,
        overrideDetails: true,
        overrideCover: true,
        overrideDefaults: true
      },
      tooltips: {
          updateCovers: 'Allow overwriting of existing covers for the selected books when a match is located.',
          updateDetails: 'Allow overwriting of existing details for the selected books when a match is located.'
      }
    }
  },
  watch: {
    show: {
      handler(newVal) {
        this.init()
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showBatchQuickMatchModal
      },
      set(val) {
        this.$store.commit('globals/setShowBatchQuickMatchModal', val)
      }
    },
    title() {
      return `${this.selectedBookIds.length} Items Selected`
    },
    showBatchQuickMatchModal() {
      return this.$store.state.globals.showBatchQuickMatchModal
    },
    selectedBookIds() {
      return this.$store.state.selectedLibraryItems || []
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    providers() {
      if (this.isPodcast) return this.$store.state.scanners.podcastProviders
      return this.$store.state.scanners.providers
    },
    libraryProvider() {
      return this.$store.getters['libraries/getLibraryProvider'](this.currentLibraryId) || 'google'
    },
  },
  methods: {
    init() {
      // If we don't have a set provider (first open of dialog) or we've switched library, set
      // the selected provider to the current library default provider
      if (!this.options.provider || (this.options.lastUsedLibrary != this.currentLibraryId)) {
        this.options.lastUsedLibrary = this.currentLibraryId
        this.options.provider = this.libraryProvider;
      }
    },
    doBatchQuickMatch() {
      if (!this.selectedBookIds.length) return
      if (this.processing) return
         
      this.processing = true
      this.$store.commit('setProcessingBatch', true)
      this.$axios
        .$post(`/api/items/batch/quickmatch`, {
          options: this.options,
          libraryItemIds: this.selectedBookIds
        })
        .then(() => {
          this.$toast.success('Batch quick match success!')
          this.processing = false
          this.$store.commit('setProcessingBatch', false)
          this.show = false
        })
        .catch((error) => {
          this.$toast.error('Batch quick match failed')
          console.error('Failed to batch quick match', error)
          this.processing = false
          this.$store.commit('setProcessingBatch', false)
          this.show = false
        })
    }
  },
  mounted() {}
}
</script>

