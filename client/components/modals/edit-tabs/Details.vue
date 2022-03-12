<template>
  <div class="w-full h-full relative">
    <form class="w-full h-full" @submit.prevent="submitForm">
      <div ref="formWrapper" class="px-4 py-6 details-form-wrapper w-full overflow-hidden overflow-y-auto">
        <div class="flex -mx-1">
          <div class="w-1/2 px-1">
            <ui-text-input-with-label v-model="details.title" label="Title" />
          </div>
          <div class="flex-grow px-1">
            <ui-text-input-with-label v-model="details.subtitle" label="Subtitle" />
          </div>
        </div>

        <div class="flex mt-2 -mx-1">
          <div class="w-3/4 px-1">
            <ui-multi-select-query-input ref="authorsSelect" v-model="details.authors" label="Authors" endpoint="authors/search" />
          </div>
          <div class="flex-grow px-1">
            <ui-text-input-with-label v-model="details.publishYear" type="number" label="Publish Year" />
          </div>
        </div>

        <div class="flex mt-2 -mx-1">
          <div class="flex-grow px-1">
            <ui-multi-select-query-input ref="seriesSelect" v-model="seriesItems" text-key="displayName" label="Series" readonly show-edit @edit="editSeriesItem" @add="addNewSeries" />
          </div>
        </div>

        <ui-textarea-with-label v-model="details.description" :rows="3" label="Description" class="mt-2" />

        <div class="flex mt-2 -mx-1">
          <div class="w-1/2 px-1">
            <ui-multi-select ref="genresSelect" v-model="details.genres" label="Genres" :items="genres" />
          </div>
          <div class="flex-grow px-1">
            <ui-multi-select ref="tagsSelect" v-model="newTags" label="Tags" :items="tags" />
          </div>
        </div>

        <div class="flex mt-2 -mx-1">
          <div class="w-1/3 px-1">
            <ui-text-input-with-label v-model="details.narrator" label="Narrator" />
          </div>
          <div class="w-1/3 px-1">
            <ui-text-input-with-label v-model="details.publisher" label="Publisher" />
          </div>
          <div class="flex-grow px-1">
            <ui-text-input-with-label v-model="details.language" label="Language" />
          </div>
        </div>

        <div class="flex mt-2 -mx-1">
          <div class="w-1/3 px-1">
            <ui-text-input-with-label v-model="details.isbn" label="ISBN" />
          </div>
          <div class="w-1/3 px-1">
            <ui-text-input-with-label v-model="details.asin" label="ASIN" />
          </div>
        </div>
      </div>

      <div class="absolute bottom-0 left-0 w-full py-4 bg-bg" :class="isScrollable ? 'box-shadow-md-up' : 'box-shadow-sm-up border-t border-primary border-opacity-50'">
        <div class="flex items-center px-4">
          <ui-btn v-if="userCanDelete" color="error" type="button" class="h-8" :padding-x="3" small @click.stop.prevent="removeItem">Remove</ui-btn>

          <div class="flex-grow" />

          <ui-tooltip v-if="!isMissing" text="(Root User Only) Save a NFO metadata file in your audiobooks directory" direction="bottom" class="mr-4 hidden sm:block">
            <ui-btn v-if="isRootUser" :loading="savingMetadata" color="bg" type="button" class="h-full" small @click.stop.prevent="saveMetadata">Save Metadata</ui-btn>
          </ui-tooltip>

          <ui-tooltip :disabled="!!quickMatching" :text="`(Root User Only) Populate empty book details & cover with first book result from '${libraryProvider}'. Does not overwrite details.`" direction="bottom" class="mr-4">
            <ui-btn v-if="isRootUser" :loading="quickMatching" color="bg" type="button" class="h-full" small @click.stop.prevent="quickMatch">Quick Match</ui-btn>
          </ui-tooltip>

          <ui-tooltip :disabled="!!libraryScan" text="(Root User Only) Rescan audiobook including metadata" direction="bottom" class="mr-4">
            <ui-btn v-if="isRootUser" :loading="rescanning" :disabled="!!libraryScan" color="bg" type="button" class="h-full" small @click.stop.prevent="rescan">Re-Scan</ui-btn>
          </ui-tooltip>

          <ui-btn type="submit">Submit</ui-btn>
        </div>
      </div>
    </form>

    <div v-if="showSeriesForm" class="absolute top-0 left-0 z-20 w-full h-full bg-black bg-opacity-50 rounded-lg flex items-center justify-center" @click="cancelSeriesForm">
      <div class="absolute top-0 right-0 p-4">
        <span class="material-icons text-gray-200 hover:text-white text-4xl cursor-pointer">close</span>
      </div>
      <form @submit.prevent="submitSeriesForm">
        <div class="bg-bg rounded-lg p-8" @click.stop>
          <div class="flex">
            <div class="flex-grow p-1 min-w-80">
              <ui-input-dropdown ref="newSeriesSelect" v-model="selectedSeries.name" :items="existingSeriesNames" :disabled="!selectedSeries.id.startsWith('new')" label="Series Name" />
            </div>
            <div class="w-40 p-1">
              <ui-text-input-with-label v-model="selectedSeries.sequence" label="Sequence" />
            </div>
          </div>
          <div class="flex justify-end mt-2 p-1">
            <ui-btn type="submit">Save</ui-btn>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean,
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      selectedSeries: {},
      showSeriesForm: false,
      details: {
        title: null,
        subtitle: null,
        description: null,
        author: null,
        narrator: null,
        series: null,
        publishYear: null,
        publisher: null,
        language: null,
        isbn: null,
        asin: null,
        genres: []
      },
      newTags: [],
      resettingProgress: false,
      isScrollable: false,
      savingMetadata: false,
      rescanning: false,
      quickMatching: false
    }
  },
  watch: {
    libraryItem: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
    }
  },
  computed: {
    isProcessing: {
      get() {
        return this.processing
      },
      set(val) {
        this.$emit('update:processing', val)
      }
    },
    isRootUser() {
      return this.$store.getters['user/getIsRoot']
    },
    isMissing() {
      return !!this.libraryItem && !!this.libraryItem.isMissing
    },
    libraryItemId() {
      return this.libraryItem ? this.libraryItem.id : null
    },
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    genres() {
      return this.filterData.genres || []
    },
    tags() {
      return this.filterData.tags || []
    },
    series() {
      return this.filterData.series || []
    },
    filterData() {
      return this.$store.state.libraries.filterData || {}
    },
    libraryId() {
      return this.libraryItem ? this.libraryItem.libraryId : null
    },
    libraryProvider() {
      return this.$store.getters['libraries/getLibraryProvider'](this.libraryId) || 'google'
    },
    libraryScan() {
      if (!this.libraryId) return null
      return this.$store.getters['scanners/getLibraryScan'](this.libraryId)
    },
    existingSeriesNames() {
      // Only show series names not already selected
      var alreadySelectedSeriesIds = this.details.series.map((se) => se.id)
      return this.series.filter((se) => !alreadySelectedSeriesIds.includes(se.id)).map((se) => se.name)
    },
    seriesItems: {
      get() {
        return this.details.series.map((se) => {
          return {
            displayName: se.sequence ? `${se.name} #${se.sequence}` : se.name,
            ...se
          }
        })
      },
      set(val) {
        this.details.series = val
      }
    }
  },
  methods: {
    cancelSeriesForm() {
      this.showSeriesForm = false
    },
    editSeriesItem(series) {
      var _series = this.details.series.find((se) => se.id === series.id)
      if (!_series) return
      this.selectedSeries = {
        ..._series
      }
      this.showSeriesForm = true
    },
    submitSeriesForm() {
      if (!this.selectedSeries.name) {
        this.$toast.error('Must enter a series')
        return
      }
      if (this.$refs.newSeriesSelect) {
        this.$refs.newSeriesSelect.blur()
      }
      var existingSeriesIndex = this.details.series.findIndex((se) => se.id === this.selectedSeries.id)

      var seriesSameName = this.series.find((se) => se.name.toLowerCase() === this.selectedSeries.name.toLowerCase())
      if (existingSeriesIndex < 0 && seriesSameName) {
        this.selectedSeries.id = seriesSameName.id
      }

      if (existingSeriesIndex >= 0) {
        this.details.series.splice(existingSeriesIndex, 1, { ...this.selectedSeries })
      } else {
        this.details.series.push({
          ...this.selectedSeries
        })
      }

      this.showSeriesForm = false
    },
    addNewSeries() {
      this.selectedSeries = {
        id: `new-${Date.now()}`,
        name: '',
        sequence: ''
      }
      this.showSeriesForm = true
    },
    quickMatch() {
      this.quickMatching = true
      var matchOptions = {
        provider: this.libraryProvider,
        title: this.details.title,
        author: this.details.author !== this.book.author ? this.details.author : null
      }
      this.$axios
        .$post(`/api/books/${this.libraryItemId}/match`, matchOptions)
        .then((res) => {
          this.quickMatching = false
          if (res.warning) {
            this.$toast.warning(res.warning)
          } else if (res.updated) {
            this.$toast.success('Item details updated')
          } else {
            this.$toast.info('No updates were made')
          }
        })
        .catch((error) => {
          var errMsg = error.response ? error.response.data || '' : ''
          console.error('Failed to match', error)
          this.$toast.error(errMsg || 'Failed to match')
          this.quickMatching = false
        })
    },
    libraryScanComplete(result) {
      this.rescanning = false
      if (!result) {
        this.$toast.error(`Re-Scan Failed for "${this.title}"`)
      } else if (result === 'UPDATED') {
        this.$toast.success(`Re-Scan complete item was updated`)
      } else if (result === 'UPTODATE') {
        this.$toast.success(`Re-Scan complete item was up to date`)
      } else if (result === 'REMOVED') {
        this.$toast.error(`Re-Scan complete item was removed`)
      }
    },
    rescan() {
      this.rescanning = true
      this.$root.socket.once('item_scan_complete', this.libraryScanComplete)
      this.$root.socket.emit('scan_item', this.libraryItemId)
    },
    saveMetadataComplete(result) {
      this.savingMetadata = false
      if (result.error) {
        this.$toast.error(result.error)
      } else if (result.audiobookId) {
        var { savedPath } = result
        if (!savedPath) {
          this.$toast.error(`Failed to save metadata file (${result.audiobookId})`)
        } else {
          this.$toast.success(`Metadata file saved "${result.audiobookTitle}"`)
        }
      }
    },
    saveMetadata() {
      this.savingMetadata = true
      this.$root.socket.once('save_metadata_complete', this.saveMetadataComplete)
      this.$root.socket.emit('save_metadata', this.libraryItemId)
    },
    submitForm() {
      if (this.isProcessing) {
        return
      }
      this.isProcessing = true
      if (this.$refs.authorsSelect && this.$refs.authorsSelect.isFocused) {
        this.$refs.authorsSelect.forceBlur()
      }
      if (this.$refs.genresSelect && this.$refs.genresSelect.isFocused) {
        this.$refs.genresSelect.forceBlur()
      }
      if (this.$refs.tagsSelect && this.$refs.tagsSelect.isFocused) {
        this.$refs.tagsSelect.forceBlur()
      }
      this.$nextTick(this.handleForm)
    },
    async handleForm() {
      const updatePayload = {
        metadata: this.details,
        tags: this.newTags
      }
      console.log('Sending update', updatePayload)
      var updatedAudiobook = await this.$axios.$patch(`/api/items/${this.libraryItemId}/media`, updatePayload).catch((error) => {
        console.error('Failed to update', error)
        return false
      })
      this.isProcessing = false
      if (updatedAudiobook) {
        this.$toast.success('Update Successful')
        this.$emit('close')
      }
    },
    init() {
      this.details.title = this.mediaMetadata.title
      this.details.subtitle = this.mediaMetadata.subtitle
      this.details.description = this.mediaMetadata.description
      this.$set(
        this.details,
        'authors',
        (this.mediaMetadata.authors || []).map((se) => ({ ...se }))
      )
      this.details.narrator = this.mediaMetadata.narrator
      this.details.genres = [...(this.mediaMetadata.genres || [])]
      this.$set(
        this.details,
        'series',
        (this.mediaMetadata.series || []).map((se) => ({ ...se }))
      )
      this.details.publishYear = this.mediaMetadata.publishYear
      this.details.publisher = this.mediaMetadata.publisher || null
      this.details.language = this.mediaMetadata.language || null
      this.details.isbn = this.mediaMetadata.isbn || null
      this.details.asin = this.mediaMetadata.asin || null
      this.newTags = [...(this.media.tags || [])]
    },
    removeItem() {
      if (confirm(`Are you sure you want to remove this item?\n\n*Does not delete your files, only removes the item from audiobookshelf`)) {
        this.isProcessing = true
        this.$axios
          .$delete(`/api/items/${this.libraryItemId}`)
          .then(() => {
            console.log('Item removed')
            this.$toast.success('Item Removed')
            this.$emit('close')
            this.isProcessing = false
          })
          .catch((error) => {
            console.error('Remove item failed', error)
            this.isProcessing = false
          })
      }
    },
    checkIsScrollable() {
      this.$nextTick(() => {
        if (this.$refs.formWrapper) {
          if (this.$refs.formWrapper.scrollHeight > this.$refs.formWrapper.clientHeight) {
            this.isScrollable = true
          } else {
            this.isScrollable = false
          }
        }
      })
    },
    setResizeObserver() {
      try {
        this.$nextTick(() => {
          const resizeObserver = new ResizeObserver(() => {
            this.checkIsScrollable()
          })
          resizeObserver.observe(this.$refs.formWrapper)
        })
      } catch (error) {
        console.error('Failed to set resize observer')
      }
    }
  },
  mounted() {
    this.setResizeObserver()
  }
}
</script>

<style scoped>
.details-form-wrapper {
  height: calc(100% - 70px);
  max-height: calc(100% - 70px);
}
</style>