<template>
  <modals-modal v-model="show" name="batchQuickMatch" :processing="processing" :width="500" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>

    <div ref="container" class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full py-4">
        <div class="w-full overflow-y-auto overflow-x-hidden max-h-96">
          <div class="flex px-8 items-center py-2">
            <p class="pr-4">{{ $strings.LabelProvider }}</p>
            <ui-dropdown v-model="options.provider" :items="providers" small />
          </div>
          <p class="text-base px-8 py-2">{{ $strings.MessageBatchQuickMatchDescription }}</p>
          <div class="flex px-8 items-end py-2">
            <ui-toggle-switch v-model="options.overrideCover" />
            <ui-tooltip :text="$strings.LabelUpdateCoverHelp">
              <p class="pl-4">
                {{ $strings.LabelUpdateCover }}
                <span class="material-symbols icon-text">info</span>
              </p>
            </ui-tooltip>
          </div>
          <div class="flex px-8 items-end py-2">
            <ui-toggle-switch v-model="options.overrideDetails" />
            <ui-tooltip :text="$strings.LabelUpdateDetailsHelp">
              <p class="pl-4">
                {{ $strings.LabelUpdateDetails }}
                <span class="material-symbols icon-text">info</span>
              </p>
            </ui-tooltip>
          </div>
          <div class="mt-4 pt-4 text-white text-opacity-80 border-t border-white border-opacity-5">
            <div class="flex items-center px-4">
              <ui-btn type="button" @click="show = false">{{ $strings.ButtonCancel }}</ui-btn>
              <div class="flex-grow" />
              <ui-btn color="success" @click="doBatchQuickMatch">{{ $strings.ButtonSubmit }}</ui-btn>
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
      lastUsedLibrary: undefined,
      options: {
        provider: undefined,
        overrideDetails: true,
        overrideCover: true
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
      return this.$getString('MessageItemsSelected', [this.selectedBookIds.length])
    },
    showBatchQuickMatchModal() {
      return this.$store.state.globals.showBatchQuickMatchModal
    },
    selectedBookIds() {
      return (this.$store.state.globals.selectedMediaItems || []).map((i) => i.id)
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
    }
  },
  methods: {
    init() {
      // If we don't have a set provider (first open of dialog) or we've switched library, set
      // the selected provider to the current library default provider
      if (!this.options.provider || this.lastUsedLibrary != this.currentLibraryId) {
        this.lastUsedLibrary = this.currentLibraryId
        this.options.provider = this.libraryProvider
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
          this.$toast.info(this.$getString('ToastBatchQuickMatchStarted', [this.selectedBookIds.length]))
        })
        .catch((error) => {
          this.$toast.error(this.$strings.ToastBatchQuickMatchFailed)
          console.error('Failed to batch quick match', error)
        })
        .finally(() => {
          this.processing = false
          this.$store.commit('setProcessingBatch', false)
          this.show = false
        })
    }
  },
  mounted() {}
}
</script>

