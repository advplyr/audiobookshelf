<template>
  <div class="w-full h-full relative">
    <form class="w-full h-full" @submit.prevent="submitForm">
      <div ref="formWrapper" class="px-4 py-6 details-form-wrapper w-full overflow-hidden overflow-y-auto">
        <!-- <div v-if="userProgress" class="bg-success bg-opacity-40 rounded-md w-full px-4 py-1 mb-4 border border-success border-opacity-50">
        <div class="w-full flex items-center">
          <p>
            Your progress: <span class="font-mono text-lg">{{ (userProgress * 100).toFixed(0) }}%</span>
          </p>
          <div class="flex-grow" />
          <ui-btn v-if="!resettingProgress" small :padding-x="2" class="-mr-3" @click="resetProgress">Reset</ui-btn>
        </div>
      </div> -->

        <ui-text-input-with-label v-model="details.title" label="Title" />

        <ui-text-input-with-label v-model="details.subtitle" label="Subtitle" class="mt-2" />

        <div class="flex mt-2 -mx-1">
          <div class="w-3/4 px-1">
            <ui-text-input-with-label v-model="details.author" label="Author" />
          </div>
          <div class="flex-grow px-1">
            <ui-text-input-with-label v-model="details.publishYear" type="number" label="Publish Year" />
          </div>
        </div>

        <div class="flex mt-2 -mx-1">
          <div class="w-3/4 px-1">
            <ui-input-dropdown v-model="details.series" label="Series" :items="series" />
          </div>
          <div class="flex-grow px-1">
            <ui-text-input-with-label v-model="details.volumeNumber" label="Volume #" />
          </div>
        </div>

        <ui-textarea-with-label v-model="details.description" :rows="3" label="Description" class="mt-2" />

        <div class="flex mt-2 -mx-1">
          <div class="w-1/2 px-1">
            <ui-multi-select v-model="details.genres" label="Genres" :items="genres" />
          </div>
          <div class="flex-grow px-1">
            <ui-multi-select v-model="newTags" label="Tags" :items="tags" />
          </div>
        </div>

        <div class="flex mt-2 -mx-1">
          <div class="w-1/2 px-1">
            <ui-text-input-with-label v-model="details.narrator" label="Narrator" />
          </div>
        </div>
      </div>

      <div class="absolute bottom-0 left-0 w-full py-4 bg-bg" :class="isScrollable ? 'box-shadow-md-up' : 'box-shadow-sm-up border-t border-primary border-opacity-50'">
        <div class="flex items-center px-4">
          <ui-btn v-if="userCanDelete" color="error" type="button" class="h-8" :padding-x="3" small @click.stop.prevent="deleteAudiobook">Remove</ui-btn>

          <div class="flex-grow" />

          <ui-tooltip v-if="!isMissing" text="(Root User Only) Save a NFO metadata file in your audiobooks directory" direction="bottom" class="mr-4">
            <ui-btn v-if="isRootUser" :loading="savingMetadata" color="bg" type="button" class="h-full" small @click.stop.prevent="saveMetadata">Save Metadata</ui-btn>
          </ui-tooltip>

          <ui-tooltip :disabled="!!libraryScan" text="(Root User Only) Rescan audiobook including metadata" direction="bottom" class="mr-4">
            <ui-btn v-if="isRootUser" :loading="rescanning" :disabled="!!libraryScan" color="bg" type="button" class="h-full" small @click.stop.prevent="rescan">Re-Scan</ui-btn>
          </ui-tooltip>

          <ui-btn type="submit">Submit</ui-btn>
        </div>
      </div>
    </form>
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean,
    audiobook: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      details: {
        title: null,
        subtitle: null,
        description: null,
        author: null,
        narrator: null,
        series: null,
        volumeNumber: null,
        publishYear: null,
        genres: []
      },
      newTags: [],
      resettingProgress: false,
      isScrollable: false,
      savingMetadata: false,
      rescanning: false
    }
  },
  watch: {
    audiobook: {
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
      return !!this.audiobook && !!this.audiobook.isMissing
    },
    audiobookId() {
      return this.audiobook ? this.audiobook.id : null
    },
    book() {
      return this.audiobook ? this.audiobook.book || {} : {}
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    genres() {
      return this.$store.state.audiobooks.genres
    },
    tags() {
      return this.$store.state.audiobooks.tags
    },
    series() {
      return this.$store.state.audiobooks.series
    },
    libraryId() {
      return this.audiobook ? this.audiobook.libraryId : null
    },
    libraryScan() {
      if (!this.libraryId) return null
      return this.$store.getters['scanners/getLibraryScan'](this.libraryId)
    }
  },
  methods: {
    audiobookScanComplete(result) {
      this.rescanning = false
      if (!result) {
        this.$toast.error(`Re-Scan Failed for "${this.title}"`)
      } else if (result === 'UPDATED') {
        this.$toast.success(`Re-Scan complete audiobook was updated`)
      } else if (result === 'UPTODATE') {
        this.$toast.success(`Re-Scan complete audiobook was up to date`)
      } else if (result === 'REMOVED') {
        this.$toast.error(`Re-Scan complete audiobook was removed`)
      }
    },
    rescan() {
      this.rescanning = true
      this.$root.socket.once('audiobook_scan_complete', this.audiobookScanComplete)
      this.$root.socket.emit('scan_audiobook', this.audiobookId)
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
      this.$root.socket.emit('save_metadata', this.audiobookId)
    },
    async submitForm() {
      if (this.isProcessing) {
        return
      }
      this.isProcessing = true
      const updatePayload = {
        book: this.details,
        tags: this.newTags
      }

      var updatedAudiobook = await this.$axios.$patch(`/api/audiobook/${this.audiobook.id}`, updatePayload).catch((error) => {
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
      this.details.title = this.book.title
      this.details.subtitle = this.book.subtitle
      this.details.description = this.book.description
      this.details.author = this.book.author
      this.details.narrator = this.book.narrator
      this.details.genres = this.book.genres || []
      this.details.series = this.book.series
      this.details.volumeNumber = this.book.volumeNumber
      this.details.publishYear = this.book.publishYear

      this.newTags = this.audiobook.tags || []
    },
    resetProgress() {
      if (confirm(`Are you sure you want to reset your progress?`)) {
        this.resettingProgress = true
        this.$axios
          .$delete(`/api/user/audiobook/${this.audiobookId}`)
          .then(() => {
            console.log('Progress reset complete')
            this.$toast.success(`Your progress was reset`)
            this.resettingProgress = false
          })
          .catch((error) => {
            console.error('Progress reset failed', error)
            this.resettingProgress = false
          })
      }
    },
    deleteAudiobook() {
      if (confirm(`Are you sure you want to remove this audiobook?\n\n*Does not delete your files, only removes the audiobook from AudioBookshelf`)) {
        this.isProcessing = true
        this.$axios
          .$delete(`/api/audiobook/${this.audiobookId}`)
          .then(() => {
            console.log('Audiobook removed')
            this.$toast.success('Audiobook Removed')
            this.$emit('close')
            this.isProcessing = false
          })
          .catch((error) => {
            console.error('Remove Audiobook failed', error)
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
    // this.init()
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