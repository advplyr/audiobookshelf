<template>
  <div class="w-full px-1 md:px-2 py-2 overflow-hidden relative" @mouseover="mouseover" @mouseleave="mouseleave" :class="isHovering ? 'bg-white bg-opacity-5' : ''">
    <div v-if="book" class="flex h-18 md:h-[5.5rem]">
      <div class="w-10 min-w-10 md:w-16 md:max-w-16 h-full">
        <div class="flex h-full items-center justify-center">
          <span class="material-symbols drag-handle text-lg md:text-xl">menu</span>
        </div>
      </div>
      <div class="h-full flex items-center" :style="{ width: coverWidth + 'px', minWidth: coverWidth + 'px', maxWidth: coverWidth + 'px' }">
        <div class="relative" :style="{ height: coverHeight + 'px', minHeight: coverHeight + 'px', maxHeight: coverHeight + 'px' }">
          <covers-book-cover :library-item="book" :width="coverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />
          <div class="absolute top-0 left-0 flex items-center justify-center bg-black bg-opacity-50 h-full w-full z-10" v-show="isHovering && showPlayBtn">
            <div class="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-40 cursor-pointer" @click="playClick">
              <span class="material-symbols fill text-2xl">play_arrow</span>
            </div>
          </div>
        </div>
      </div>
      <div class="flex-grow overflow-hidden max-w-48 md:max-w-md h-full flex items-center px-2 md:px-3">
        <div>
          <div class="truncate max-w-48 md:max-w-md">
            <nuxt-link :to="`/item/${book.id}`" class="truncate hover:underline text-sm md:text-base">{{ bookTitle }}</nuxt-link>
          </div>
          <div class="truncate max-w-48 md:max-w-md text-xs md:text-sm text-gray-300">
            <nuxt-link v-for="_series in seriesList" :key="_series.id" :to="`/library/${book.libraryId}/series/${_series.id}`" class="hover:underline font-sans text-gray-300"> {{ _series.text }}</nuxt-link>
          </div>
          <div class="truncate max-w-48 md:max-w-md text-xs md:text-sm text-gray-300">
            <template v-for="(author, index) in bookAuthors">
              <nuxt-link :key="author.id" :to="`/author/${author.id}`" class="truncate hover:underline">{{ author.name }}</nuxt-link
              ><span :key="author.id + '-comma'" v-if="index < bookAuthors.length - 1">,&nbsp;</span>
            </template>
          </div>
          <p v-if="media.duration" class="text-xs md:text-sm text-gray-400">{{ bookDuration }}</p>
        </div>
      </div>
    </div>
    <div class="w-40 absolute top-0 -right-24 h-full transform transition-transform" :class="!isHovering ? 'translate-x-0' : translateDistance">
      <div class="flex h-full items-center">
        <ui-tooltip :text="userIsFinished ? $strings.MessageMarkAsNotFinished : $strings.MessageMarkAsFinished" direction="top">
          <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="userIsFinished" borderless class="mx-1 mt-0.5" @click="toggleFinished" />
        </ui-tooltip>
        <div v-if="userCanUpdate" class="mx-1" :class="isHovering ? '' : 'ml-6'">
          <ui-icon-btn icon="edit" borderless @click="clickEdit" />
        </div>
        <div v-if="userCanDelete" class="mx-1">
          <ui-icon-btn icon="close" borderless @click="removeClick" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    collectionId: String,
    book: {
      type: Object,
      default: () => {}
    },
    isDragging: Boolean,
    bookCoverAspectRatio: Number
  },
  data() {
    return {
      isProcessingReadUpdate: false,
      processingRemove: false,
      isHovering: false
    }
  },
  watch: {
    isDragging: {
      handler(newVal) {
        if (newVal) {
          this.isHovering = false
        }
      }
    }
  },
  computed: {
    translateDistance() {
      if (!this.userCanUpdate && !this.userCanDelete) return 'translate-x-0'
      else if (!this.userCanUpdate || !this.userCanDelete) return '-translate-x-12'
      return '-translate-x-24'
    },
    media() {
      return this.book.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    tracks() {
      return this.media.tracks || []
    },
    bookTitle() {
      return this.mediaMetadata.title || ''
    },
    bookAuthors() {
      return this.mediaMetadata.authors || []
    },
    bookDuration() {
      return this.$elapsedPretty(this.media.duration)
    },
    series() {
      return this.mediaMetadata.series || []
    },
    seriesList() {
      return this.series.map((se) => {
        let text = se.name
        if (se.sequence) text += ` #${se.sequence}`
        return {
          ...se,
          text
        }
      })
    },
    isMissing() {
      return this.book.isMissing
    },
    isInvalid() {
      return this.book.isInvalid
    },
    isStreaming() {
      return this.$store.getters['getLibraryItemIdStreaming'] === this.book.id
    },
    showPlayBtn() {
      return !this.isMissing && !this.isInvalid && !this.isStreaming && this.tracks.length
    },
    itemProgress() {
      return this.$store.getters['user/getUserMediaProgress'](this.book.id)
    },
    userIsFinished() {
      return this.itemProgress ? !!this.itemProgress.isFinished : false
    },
    coverSize() {
      return this.$store.state.globals.isMobile ? 30 : 50
    },
    coverHeight() {
      return this.coverSize * 1.6
    },
    coverWidth() {
      if (this.bookCoverAspectRatio === 1) return this.coverSize * 1.6
      return this.coverSize
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    }
  },
  methods: {
    mouseover() {
      if (this.isDragging) return
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    playClick() {
      const queueItems = [
        {
          libraryItemId: this.book.id,
          libraryId: this.book.libraryId,
          episodeId: null,
          title: this.bookTitle,
          subtitle: this.bookAuthors.map((au) => au.name).join(', '),
          caption: '',
          duration: this.media.duration || null,
          coverPath: this.media.coverPath || null
        }
      ]

      this.$eventBus.$emit('play-item', {
        libraryItemId: this.book.id,
        queueItems
      })
    },
    clickEdit() {
      this.$emit('edit', this.book)
    },
    toggleFinished() {
      var updatePayload = {
        isFinished: !this.userIsFinished
      }
      this.isProcessingReadUpdate = true
      this.$axios
        .$patch(`/api/me/progress/${this.book.id}`, updatePayload)
        .then(() => {
          this.isProcessingReadUpdate = false
        })
        .catch((error) => {
          console.error('Failed', error)
          this.isProcessingReadUpdate = false
          this.$toast.error(updatePayload.isFinished ? this.$strings.ToastItemMarkedAsFinishedFailed : this.$strings.ToastItemMarkedAsNotFinishedFailed)
        })
    },
    removeClick() {
      this.processingRemove = true

      this.$axios
        .$delete(`/api/collections/${this.collectionId}/book/${this.book.id}`)
        .then((updatedCollection) => {
          console.log(`Book removed from collection`, updatedCollection)
          this.$toast.success(this.$strings.ToastRemoveItemFromCollectionSuccess)
          this.processingRemove = false
        })
        .catch((error) => {
          console.error('Failed to remove book from collection', error)
          this.$toast.error(this.$strings.ToastRemoveItemFromCollectionFailed)
          this.processingRemove = false
        })
    }
  },
  mounted() {}
}
</script>