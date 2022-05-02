<template>
  <div class="w-full h-full relative">
    <widgets-book-details-edit v-if="mediaType == 'book'" ref="itemDetailsEdit" :library-item="libraryItem" @submit="submitForm" />
    <widgets-podcast-details-edit v-else ref="itemDetailsEdit" :library-item="libraryItem" @submit="submitForm" />

    <div class="absolute bottom-0 left-0 w-full py-4 bg-bg" :class="isScrollable ? 'box-shadow-md-up' : 'box-shadow-sm-up border-t border-primary border-opacity-50'">
      <div class="flex items-center px-4">
        <ui-btn v-if="userCanDelete" color="error" type="button" class="h-8" :padding-x="3" small @click.stop.prevent="removeItem">Remove</ui-btn>

        <div class="flex-grow" />

        <ui-tooltip v-if="mediaType == 'book'" :disabled="!!quickMatching" :text="`(Root User Only) Populate empty book details & cover with first book result from '${libraryProvider}'. Does not overwrite details.`" direction="bottom" class="mr-4">
          <ui-btn v-if="isRootUser" :loading="quickMatching" color="bg" type="button" class="h-full" small @click.stop.prevent="quickMatch">Quick Match</ui-btn>
        </ui-tooltip>

        <ui-tooltip :disabled="!!libraryScan" text="(Root User Only) Rescan audiobook including metadata" direction="bottom" class="mr-4">
          <ui-btn v-if="isRootUser && !isFile" :loading="rescanning" :disabled="!!libraryScan" color="bg" type="button" class="h-full" small @click.stop.prevent="rescan">Re-Scan</ui-btn>
        </ui-tooltip>

        <ui-btn @click="submitForm">Submit</ui-btn>
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
    mediaType() {
      return this.libraryItem ? this.libraryItem.mediaType : null
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
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
    }
  },
  methods: {
    quickMatch() {
      if (this.quickMatching) return
      if (!this.$refs.itemDetailsEdit) return

      var { title, author } = this.$refs.itemDetailsEdit.getTitleAndAuthorName()
      if (!title) {
        this.$toast.error('Must have a title for quick match')
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
    rescan() {
      this.rescanning = true
      this.$axios
        .$get(`/api/items/${this.libraryItemId}/scan`)
        .then((data) => {
          this.rescanning = false
          var result = data.result
          if (!result) {
            this.$toast.error(`Re-Scan Failed for "${this.title}"`)
          } else if (result === 'UPDATED') {
            this.$toast.success(`Re-Scan complete item was updated`)
          } else if (result === 'UPTODATE') {
            this.$toast.success(`Re-Scan complete item was up to date`)
          } else if (result === 'REMOVED') {
            this.$toast.error(`Re-Scan complete item was removed`)
          }
        })
        .catch((error) => {
          console.error('Failed to scan library item', error)
          this.$toast.error('Failed to scan library item')
          this.rescanning = false
        })
    },
    submitForm() {
      if (this.isProcessing) {
        return
      }
      if (!this.$refs.itemDetailsEdit) {
        return
      }
      var updatedDetails = this.$refs.itemDetailsEdit.getDetails()
      if (!updatedDetails.hasChanges) {
        this.$toast.info('No changes were made')
        return
      }
      this.updateDetails(updatedDetails)
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
          this.$toast.success('Item details updated')
          this.$emit('close')
        } else {
          this.$toast.info('No updates were necessary')
        }
      }
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
.details-form-wrapper {
  height: calc(100% - 70px);
  max-height: calc(100% - 70px);
}
</style>