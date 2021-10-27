<template>
  <modals-modal v-model="show" name="bookmarks" :width="500" :height="'unset'">
    <div ref="container" class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div class="w-full h-full px-6 py-6" v-show="showBookmarkTitleInput">
        <div class="flex mb-4 items-center">
          <div class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-10 cursor-pointer" @click="showBookmarkTitleInput = false">
            <span class="material-icons text-3xl">arrow_back</span>
          </div>
          <p class="text-xl pl-2">{{ selectedBookmark ? 'Edit Bookmark' : 'New Bookmark' }}</p>
          <div class="flex-grow" />
          <p class="text-xl font-mono">
            {{ this.$secondsToTimestamp(currentTime) }}
          </p>
        </div>
        <form @submit.prevent="submitBookmark">
          <ui-text-input-with-label v-model="newBookmarkTitle" label="Note" />
          <div class="flex justify-end mt-6">
            <ui-btn color="success" class="w-1/2" type="submit">{{ selectedBookmark ? 'Update' : 'Create' }} Bookmark</ui-btn>
          </div>
        </form>
      </div>
      <div class="w-full h-full" v-show="!showBookmarkTitleInput">
        <template v-for="bookmark in bookmarks">
          <modals-bookmarks-bookmark-item :key="bookmark.id" :highlight="currentTime === bookmark.time" :bookmark="bookmark" @click="clickBookmark" @edit="editBookmark" @delete="deleteBookmark" />
        </template>
        <div v-if="!bookmarks.length" class="flex h-32 items-center justify-center">
          <p class="text-xl">No Bookmarks</p>
        </div>
        <div v-show="canCreateBookmark" class="flex px-4 py-2 items-center text-center justify-between border-b border-white border-opacity-10 bg-blue-500 bg-opacity-20 cursor-pointer text-white text-opacity-80 hover:bg-opacity-40 hover:text-opacity-100" @click="createBookmark">
          <span class="material-icons">add</span>
          <p class="text-base pl-2">Create Bookmark</p>
          <p class="text-sm font-mono">
            {{ this.$secondsToTimestamp(currentTime) }}
          </p>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    bookmarks: {
      type: Array,
      default: () => []
    },
    currentTime: {
      type: Number,
      default: 0
    },
    audiobookId: String
  },
  data() {
    return {
      selectedBookmark: null,
      showBookmarkTitleInput: false,
      newBookmarkTitle: ''
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.showBookmarkTitleInput = false
        this.newBookmarkTitle = ''
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    canCreateBookmark() {
      return !this.bookmarks.find((bm) => bm.time === this.currentTime)
    }
  },
  methods: {
    editBookmark(bm) {
      this.selectedBookmark = bm
      this.newBookmarkTitle = bm.title
      this.showBookmarkTitleInput = true
    },
    deleteBookmark(bm) {
      var bookmark = { ...bm, audiobookId: this.audiobookId }
      this.$emit('delete', bookmark)
    },
    clickBookmark(bm) {
      this.$emit('select', bm)
    },
    createBookmark() {
      this.selectedBookmark = null
      this.newBookmarkTitle = this.$formatDate(Date.now(), 'MMM dd, yyyy HH:mm')
      this.showBookmarkTitleInput = true
    },
    submitBookmark() {
      if (this.selectedBookmark) {
        if (this.selectedBookmark.title !== this.newBookmarkTitle) {
          var bookmark = { ...this.selectedBookmark }
          bookmark.audiobookId = this.audiobookId
          bookmark.title = this.newBookmarkTitle
          this.$emit('update', bookmark)
        }
      } else {
        var bookmark = {
          audiobookId: this.audiobookId,
          title: this.newBookmarkTitle,
          time: this.currentTime
        }
        this.$emit('create', bookmark)
      }
      this.newBookmarkTitle = ''
      this.showBookmarkTitleInput = false
    }
  }
}
</script>