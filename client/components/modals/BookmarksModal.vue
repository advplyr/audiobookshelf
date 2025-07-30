<template>
  <modals-modal v-model="show" name="bookmarks" :width="500" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ $strings.LabelYourBookmarks }}</p>
      </div>
    </template>
    <div v-if="show" class="w-full rounded-lg bg-bg box-shadow-md relative" style="max-height: 80vh">
      <div v-if="bookmarks.length" class="h-full max-h-[calc(80vh-60px)] w-full relative overflow-y-auto overflow-x-hidden">
        <template v-for="bookmark in bookmarks">
          <modals-bookmarks-bookmark-item :key="bookmark.id" :highlight="currentTime === bookmark.time" :bookmark="bookmark" :playback-rate="playbackRate" @click="clickBookmark" @delete="deleteBookmark" />
        </template>
      </div>
      <div v-else class="flex h-32 items-center justify-center">
        <p class="text-xl">{{ $strings.MessageNoBookmarks }}</p>
      </div>

      <div v-if="canCreateBookmark && !hideCreate" class="w-full border-t border-white/10">
        <form @submit.prevent="submitCreateBookmark">
          <div class="flex px-4 py-2 items-center text-center border-b border-white/10 text-white/80">
            <div class="w-16 max-w-16 text-center">
              <p class="text-sm font-mono text-gray-400">
                {{ this.$secondsToTimestamp(currentTime / playbackRate) }}
              </p>
            </div>
            <div class="grow px-2">
              <ui-text-input v-model="newBookmarkTitle" placeholder="Note" class="w-full h-10" />
            </div>
            <ui-btn type="submit" color="bg-success" :padding-x="4" class="h-10"><span class="material-symbols text-2xl -mt-px">add</span></ui-btn>
          </div>
        </form>
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
    libraryItemId: String,
    playbackRate: Number,
    hideCreate: Boolean
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
        this.selectedBookmark = null
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
      return !this.bookmarks.find((bm) => Math.abs(this.currentTime - bm.time) < 1)
    },
    dateFormat() {
      return this.$store.getters['getServerSetting']('dateFormat')
    },
    timeFormat() {
      return this.$store.getters['getServerSetting']('timeFormat')
    }
  },
  methods: {
    editBookmark(bm) {
      this.selectedBookmark = bm
      this.newBookmarkTitle = bm.title
      this.showBookmarkTitleInput = true
    },
    deleteBookmark(bm) {
      this.$axios
        .$delete(`/api/me/item/${this.libraryItemId}/bookmark/${bm.time}`)
        .then(() => {
          this.$toast.success(this.$strings.ToastBookmarkRemoveSuccess)
        })
        .catch((error) => {
          this.$toast.error(this.$strings.ToastRemoveFailed)
          console.error(error)
        })
      this.show = false
    },
    clickBookmark(bm) {
      this.$emit('select', bm)
    },
    submitCreateBookmark() {
      if (!this.newBookmarkTitle) {
        this.newBookmarkTitle = this.$formatDatetime(Date.now(), this.dateFormat, this.timeFormat)
      }
      var bookmark = {
        title: this.newBookmarkTitle,
        time: Math.floor(this.currentTime)
      }
      this.$axios
        .$post(`/api/me/item/${this.libraryItemId}/bookmark`, bookmark)
        .then(() => {
          this.$toast.success(this.$strings.ToastBookmarkCreateSuccess)
        })
        .catch((error) => {
          this.$toast.error(this.$strings.ToastBookmarkCreateFailed)
          console.error(error)
        })

      this.newBookmarkTitle = ''
      this.showBookmarkTitleInput = false

      this.show = false
    }
  }
}
</script>
