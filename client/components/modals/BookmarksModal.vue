<template>
  <modals-modal v-model="show" name="bookmarks" :width="500" :height="'unset'">
    <div ref="container" class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div class="w-full h-full px-6 py-6" v-show="showBookmarkTitleInput">
        <div class="flex mb-4 items-center">
          <div class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white hover:bg-opacity-10 cursor-pointer" @click="showBookmarkTitleInput = false">
            <span class="material-icons text-3xl">arrow_back</span>
          </div>
          <p class="text-xl pl-2">New Bookmark</p>
          <div class="flex-grow" />
          <p class="text-xl font-mono">
            {{ this.$secondsToTimestamp(currentTime) }}
          </p>
        </div>
        <form @submit.prevent="submitBookmark">
          <ui-text-input-with-label v-model="newBookmarkTitle" label="Note" />
          <div class="flex justify-end mt-6">
            <ui-btn color="success" class="w-1/2" type="submit">Create Bookmark</ui-btn>
          </div>
        </form>
      </div>
      <div class="w-full h-full" v-show="!showBookmarkTitleInput">
        <template v-for="bookmark in bookmarks">
          <div :key="bookmark.id" :id="`bookmark-row-${bookmark.id}`" class="flex items-center px-4 py-4 justify-start cursor-pointer bg-opacity-20 hover:bg-bg relative" @click="clickBookmark(bookmark)">
            <span class="material-icons text-white text-opacity-60">bookmark_border</span>
            <p class="pl-2 pr-16 truncate">{{ bookmark.title }}</p>

            <div class="absolute right-0 top-0 h-full flex items-center pr-4">
              <span class="font-mono text-sm text-gray-300">{{ $secondsToTimestamp(bookmark.time) }}</span>
            </div>
          </div>
        </template>
        <div v-if="!bookmarks.length" class="flex h-32 items-center justify-center">
          <p class="text-xl">No Bookmarks</p>
        </div>
        <div class="flex px-4 py-2 items-center text-center justify-between border-b border-white border-opacity-10 bg-blue-500 bg-opacity-20 cursor-pointer text-white text-opacity-80 hover:bg-opacity-40 hover:text-opacity-100" @click="createBookmark">
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
    }
  },
  methods: {
    clickBookmark(bm) {
      this.$emit('select', bm)
    },
    createBookmark() {
      this.showBookmarkTitleInput = true
    },
    submitBookmark() {
      var bookmark = {
        audiobookId: this.audiobookId,
        title: this.newBookmarkTitle,
        time: this.currentTime
      }
      this.$emit('create', bookmark)
      this.newBookmarkTitle = ''
      this.showBookmarkTitleInput = false
    }
  }
}
</script>