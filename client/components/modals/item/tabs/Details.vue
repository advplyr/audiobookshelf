<template>
  <div class="w-full h-full relative">
    <div id="formWrapper" class="w-full overflow-y-auto">
      <widgets-book-details-edit v-if="mediaType == 'book'" ref="itemDetailsEdit" :library-item="libraryItem" @submit="saveAndClose" />
      <widgets-podcast-details-edit v-else ref="itemDetailsEdit" :library-item="libraryItem" @submit="saveAndClose" />
    </div>

    <div class="absolute bottom-0 left-0 w-full py-2 md:py-4 bg-bg" :class="isScrollable ? 'box-shadow-md-up' : 'border-t border-white/5'">
      <div class="flex items-center px-4">
        <ui-tooltip :disabled="!!quickMatching" :text="$getString('MessageQuickMatchDescription', [libraryProvider])" direction="bottom" class="mr-2 md:mr-4">
          <ui-btn v-if="userIsAdminOrUp" :loading="quickMatching" color="bg-bg" type="button" class="h-full" small @click.stop.prevent="quickMatch">{{ $strings.ButtonQuickMatch }}</ui-btn>
        </ui-tooltip>

        <ui-btn v-if="userIsAdminOrUp && !isFile" :loading="rescanning" :disabled="isLibraryScanning" color="bg-bg" type="button" class="h-full" small @click.stop.prevent="rescan">{{ $strings.ButtonReScan }}</ui-btn>

        <div class="grow" />

        <!-- desktop -->
        <ui-btn @click="save" class="mx-2 hidden md:block">{{ $strings.ButtonSave }}</ui-btn>
        <ui-btn @click="saveAndClose" class="mx-2 hidden md:block">{{ $strings.ButtonSaveAndClose }}</ui-btn>
        <!-- mobile -->
        <ui-btn @click="saveAndClose" class="mx-2 md:hidden">{{ $strings.ButtonSave }}</ui-btn>
      </div>
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
      resettingProgress: false,
      isScrollable: false,
      rescanning: false,
      quickMatching: false
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
    isFile() {
      return !!this.libraryItem && this.libraryItem.isFile
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
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
    mediaType() {
      return this.libraryItem ? this.libraryItem.mediaType : null
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    libraryId() {
      return this.libraryItem ? this.libraryItem.libraryId : null
    },
    libraryProvider() {
      return this.$store.getters['libraries/getLibraryProvider'](this.libraryId) || 'google'
    },
    isLibraryScanning() {
      if (!this.libraryId) return null
      return !!this.$store.getters['tasks/getRunningLibraryScanTask'](this.libraryId)
    }
  },
  methods: {
    quickMatch() {
      if (this.quickMatching) return
      if (!this.$refs.itemDetailsEdit) return

      var { title, author } = this.$refs.itemDetailsEdit.getTitleAndAuthorName()
      if (!title) {
        this.$toast.error(this.$strings.ToastTitleRequired)
        return
      }
      this.quickMatching = true
      var matchOptions = {
        provider: this.libraryProvider,
        title: title || null,
        author: author || null
      }
      this.$axios
        .$post(`/api/items/${this.libraryItemId}/match`, matchOptions)
        .then((res) => {
          this.quickMatching = false
          if (res.warning) {
            this.$toast.warning(res.warning)
          } else if (res.updated) {
            this.$toast.success(this.$strings.ToastItemDetailsUpdateSuccess)
          } else {
            this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
          }
        })
        .catch((error) => {
          var errMsg = error.response ? error.response.data || '' : ''
          console.error('Failed to match', error)
          this.$toast.error(errMsg || 'Failed to match')
          this.quickMatching = false
        })
    },
    rescan() {
      this.rescanning = true
      this.$axios
        .$post(`/api/items/${this.libraryItemId}/scan`)
        .then((data) => {
          this.rescanning = false
          var result = data.result
          if (!result) {
            this.$toast.error(this.$getString('ToastRescanFailed', [this.title]))
          } else if (result === 'UPDATED') {
            this.$toast.success(this.$strings.ToastRescanUpdated)
          } else if (result === 'UPTODATE') {
            this.$toast.success(this.$strings.ToastRescanUpToDate)
          } else if (result === 'REMOVED') {
            this.$toast.error(this.$strings.ToastRescanRemoved)
          }
        })
        .catch((error) => {
          console.error('Failed to scan library item', error)
          this.$toast.error(this.$strings.ToastScanFailed)
          this.rescanning = false
        })
    },
    async saveAndClose() {
      const wasUpdated = await this.save()
      if (wasUpdated !== null) this.$emit('close')
    },
    async save() {
      if (this.isProcessing) {
        return null
      }
      if (!this.$refs.itemDetailsEdit) {
        return null
      }
      var updatedDetails = this.$refs.itemDetailsEdit.getDetails()
      if (!updatedDetails.hasChanges) {
        this.$toast.info(this.$strings.MessageNoUpdatesWereNecessary)
        return false
      }
      return this.updateDetails(updatedDetails)
    },
    async updateDetails(updatedDetails) {
      this.isProcessing = true
      var updateResult = await this.$axios.$patch(`/api/items/${this.libraryItemId}/media`, updatedDetails.updatePayload).catch((error) => {
        console.error('Failed to update', error)
        return false
      })
      this.isProcessing = false
      if (updateResult) {
        if (updateResult.updated) {
          this.$toast.success(this.$strings.ToastItemDetailsUpdateSuccess)
          return true
        } else {
          this.$toast.info(this.$strings.MessageNoUpdatesWereNecessary)
        }
      }
      return false
    },
    checkIsScrollable() {
      this.$nextTick(() => {
        var formWrapper = document.getElementById('formWrapper')
        if (formWrapper) {
          if (formWrapper.scrollHeight > formWrapper.clientHeight) {
            this.isScrollable = true
          } else {
            this.isScrollable = false
          }
        }
      })
    },
    setResizeObserver() {
      try {
        var formWrapper = document.getElementById('formWrapper')
        if (formWrapper) {
          this.$nextTick(() => {
            const resizeObserver = new ResizeObserver(() => {
              this.checkIsScrollable()
            })
            resizeObserver.observe(formWrapper)
          })
        }
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
#formWrapper {
  height: calc(100% - 80px);
  max-height: calc(100% - 80px);
}
</style>
