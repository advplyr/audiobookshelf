<template>
  <nuxt-link :to="`/audiobook/${audiobookId}`" :style="{ height: height + 32 + 'px', width: width + 32 + 'px' }" class="cursor-pointer p-4">
    <div class="rounded-sm h-full overflow-hidden relative bookCard" @mouseover="isHovering = true" @mouseleave="isHovering = false">
      <div class="w-full relative" :style="{ height: width * 1.6 + 'px' }">
        <cards-book-cover :audiobook="audiobook" :author-override="authorFormat" />

        <div v-show="isHovering" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-40">
          <div class="h-full flex items-center justify-center">
            <div class="hover:text-gray-200 hover:scale-110 transform duration-200" @click.stop.prevent="play">
              <span class="material-icons text-5xl">play_circle_filled</span>
            </div>
          </div>
          <div class="absolute top-1.5 right-1.5 cursor-pointer hover:text-yellow-300 hover:scale-125 transform duration-50" @click.stop.prevent="editClick">
            <span class="material-icons" style="font-size: 16px">edit</span>
          </div>
        </div>
        <div class="absolute bottom-0 left-0 h-1 bg-yellow-400 shadow-sm" :style="{ width: width * userProgressPercent + 'px' }"></div>
      </div>
      <ui-tooltip v-if="showError" :text="errorText" class="absolute top-4 left-0">
        <div class="h-6 w-10 bg-error rounded-r-full shadow-md flex items-center justify-end border-r border-b border-red-300">
          <span class="material-icons text-sm text-red-100 pr-1">priority_high</span>
        </div>
      </ui-tooltip>
    </div>
  </nuxt-link>
</template>

<script>
export default {
  props: {
    audiobook: {
      type: Object,
      default: () => null
    },
    userProgress: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      isHovering: false
    }
  },
  computed: {
    audiobookId() {
      return this.audiobook.id
    },
    book() {
      return this.audiobook.book || {}
    },
    width() {
      return 120
    },
    height() {
      return this.width * 1.6
    },
    title() {
      return this.book.title
    },
    author() {
      return this.book.author
    },
    authorFL() {
      return this.book.authorFL || this.author
    },
    authorLF() {
      return this.book.authorLF || this.author
    },
    authorFormat() {
      if (!this.orderBy || !this.orderBy.startsWith('book.author')) return null
      return this.orderBy === 'book.authorLF' ? this.authorLF : this.authorFL
    },
    volumeNumber() {
      return this.book.volumeNumber || null
    },
    orderBy() {
      return this.$store.getters['user/getUserSetting']('orderBy')
    },
    filterBy() {
      return this.$store.getters['user/getUserSetting']('filterBy')
    },
    userProgressPercent() {
      return this.userProgress ? this.userProgress.progress || 0 : 0
    },
    showError() {
      return this.hasMissingParts || this.hasInvalidParts
    },
    hasMissingParts() {
      return this.audiobook.hasMissingParts
    },
    hasInvalidParts() {
      return this.audiobook.hasInvalidParts
    },
    errorText() {
      var txt = ''
      if (this.hasMissingParts) {
        txt = `${this.hasMissingParts} missing parts.`
      }
      if (this.hasInvalidParts) {
        if (this.hasMissingParts) txt += ' '
        txt += `${this.hasInvalidParts} invalid parts.`
      }
      return txt || 'Unknown Error'
    }
  },
  methods: {
    clickError(e) {
      e.stopPropagation()
      this.$router.push(`/audiobook/${this.audiobookId}`)
    },
    play() {
      this.$store.commit('setStreamAudiobook', this.audiobook)
      this.$root.socket.emit('open_stream', this.audiobookId)
    },
    editClick() {
      this.$store.commit('showEditModal', this.audiobook)
    }
  },
  mounted() {}
}
</script>

<style>
.bookCard {
  box-shadow: 4px 1px 8px #11111166, -4px 1px 8px #11111166, 1px -4px 8px #11111166;
}
</style>