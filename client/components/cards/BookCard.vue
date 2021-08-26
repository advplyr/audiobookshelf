<template>
  <nuxt-link :to="`/audiobook/${audiobookId}`" :style="{ padding: `16px ${paddingX}px` }" class="cursor-pointer">
    <div class="rounded-sm h-full overflow-hidden relative bookCard" @mouseover="isHovering = true" @mouseleave="isHovering = false">
      <div class="w-full relative" :style="{ height: height + 'px' }">
        <cards-book-cover :audiobook="audiobook" :author-override="authorFormat" :width="width" />

        <div v-show="isHovering" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-40">
          <div class="h-full flex items-center justify-center">
            <div class="hover:text-gray-200 hover:scale-110 transform duration-200" @click.stop.prevent="play">
              <span class="material-icons" :style="{ fontSize: playIconFontSize + 'rem' }">play_circle_filled</span>
            </div>
          </div>
          <div class="absolute cursor-pointer hover:text-yellow-300 hover:scale-125 transform duration-50" :style="{ top: 0.375 * sizeMultiplier + 'rem', right: 0.375 * sizeMultiplier + 'rem' }" @click.stop.prevent="editClick">
            <span class="material-icons" :style="{ fontSize: sizeMultiplier + 'rem' }">edit</span>
          </div>
        </div>
        <div class="absolute bottom-0 left-0 h-1 bg-yellow-400 shadow-sm" :style="{ width: width * userProgressPercent + 'px' }"></div>
      </div>
      <ui-tooltip v-if="showError" :text="errorText" class="absolute top-4 left-0">
        <div :style="{ height: 1.5 * sizeMultiplier + 'rem', width: 2.5 * sizeMultiplier + 'rem' }" class="bg-error rounded-r-full shadow-md flex items-center justify-end border-r border-b border-red-300">
          <span class="material-icons text-red-100 pr-1" :style="{ fontSize: 0.875 * sizeMultiplier + 'rem' }">priority_high</span>
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
    },
    width: {
      type: Number,
      default: 120
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
    height() {
      return this.width * 1.6
    },
    sizeMultiplier() {
      return this.width / 120
    },
    paddingX() {
      return 16 * this.sizeMultiplier
    },
    title() {
      return this.book.title
    },
    playIconFontSize() {
      return Math.max(2, 3 * this.sizeMultiplier)
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