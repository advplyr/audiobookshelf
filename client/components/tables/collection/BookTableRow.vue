<template>
  <div class="w-full px-2 py-2 overflow-hidden relative" @mouseover="mouseover" @mouseleave="mouseleave" :class="isHovering ? 'bg-white bg-opacity-5' : ''">
    <div v-if="book" class="flex h-20">
      <div class="w-16 max-w-16 h-full">
        <div class="flex h-full items-center justify-center">
          <span class="material-icons drag-handle text-xl">menu</span>
        </div>
      </div>
      <covers-book-cover :audiobook="book" :width="50" />
      <div class="w-80 h-full px-2 flex items-center">
        <div>
          <p class="truncate">{{ bookTitle }}</p>
          <p class="truncate text-gray-400 text-sm">{{ bookAuthor }}</p>
        </div>
      </div>
      <div class="flex-grow flex items-center">
        <p class="font-mono text-sm">{{ bookDuration }}</p>
      </div>

      <!-- <div class="w-12 flex items-center justify-center">
        <span class="material-icons text-lg text-white text-opacity-70 hover:text-opacity-100 cursor-pointer">radio_button_unchecked</span>
      </div> -->
    </div>
    <!-- <div class="absolute top-0 left-0 z-40 bg-red-500 w-full h-full">
      <div class="w-24 h-full absolute top-0 -right-24 transform transition-transform" :class="isHovering ? 'translate-x-0' : '-translate-x-24'">
        <span class="material-icons">edit</span>
      </div>
    </div> -->
    <div class="w-40 absolute top-0 -right-40 h-full transform transition-transform" :class="!isHovering ? 'translate-x-0' : '-translate-x-40'">
      <div class="flex h-full items-center">
        <ui-tooltip :text="isRead ? 'Mark as Not Read' : 'Mark as Read'" direction="top">
          <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="isRead" borderless class="mx-1 mt-0.5" @click="toggleRead" />
        </ui-tooltip>
        <div class="mx-1">
          <ui-icon-btn icon="edit" borderless @click="clickEdit" />
        </div>
        <div class="mx-1">
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
    }
  },
  data() {
    return {
      isProcessingReadUpdate: false,
      processingRemove: false,
      isHovering: false
    }
  },
  watch: {
    userIsRead: {
      immediate: true,
      handler(newVal) {
        this.isRead = newVal
      }
    }
  },
  computed: {
    _book() {
      return this.book.book || {}
    },
    bookTitle() {
      return this._book.title || ''
    },
    bookAuthor() {
      return this._book.authorFL || ''
    },
    bookDuration() {
      return this.$secondsToTimestamp(this.book.duration)
    },
    userAudiobooks() {
      return this.$store.state.user.user ? this.$store.state.user.user.audiobooks || {} : {}
    },
    userAudiobook() {
      return this.userAudiobooks[this.book.id] || null
    },
    userIsRead() {
      return this.userAudiobook ? !!this.userAudiobook.isRead : false
    }
  },
  methods: {
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    clickRemove() {},
    clickEdit() {
      this.$emit('edit', this.book)
    },
    toggleRead() {
      var updatePayload = {
        isRead: !this.isRead
      }
      this.isProcessingReadUpdate = true
      this.$axios
        .$patch(`/api/user/audiobook/${this.book.id}`, updatePayload)
        .then(() => {
          this.isProcessingReadUpdate = false
          this.$toast.success(`"${this.title}" Marked as ${updatePayload.isRead ? 'Read' : 'Not Read'}`)
        })
        .catch((error) => {
          console.error('Failed', error)
          this.isProcessingReadUpdate = false
          this.$toast.error(`Failed to mark as ${updatePayload.isRead ? 'Read' : 'Not Read'}`)
        })
    },
    removeClick() {
      this.processingRemove = true

      this.$axios
        .$delete(`/api/collection/${this.collectionId}/book/${this.book.id}`)
        .then((updatedCollection) => {
          console.log(`Book removed from collection`, updatedCollection)
          this.$toast.success('Book removed from collection')
          this.processingRemove = false
        })
        .catch((error) => {
          console.error('Failed to remove book from collection', error)
          this.$toast.error('Failed to remove book from collection')
          this.processingRemove = false
        })
    }
  },
  mounted() {}
}
</script>