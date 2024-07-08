<template>
  <div v-if="item" class="w-full flex items-center px-4 py-2" :class="wrapperClass" @mouseover="mouseover" @mouseleave="mouseleave">
    <covers-preview-cover :src="coverUrl" :width="48" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="false" />
    <div class="flex-grow px-2 py-1 queue-item-row-content truncate">
      <p class="text-gray-200 text-sm truncate">{{ title }}</p>
      <p class="text-gray-300 text-sm">{{ subtitle }}</p>
      <p v-if="caption" class="text-gray-400 text-xs">{{ caption }}</p>
    </div>
    <div class="w-28">
      <p v-if="isOpenInPlayer" class="text-sm text-right text-gray-400">{{ $strings.ButtonPlaying }}</p>
      <div v-else-if="isHovering" class="flex items-center justify-end -mx-1">
        <button class="outline-none mx-1 flex items-center" @click.stop="playClick">
          <span class="material-symbols fill text-2xl text-success">play_arrow</span>
        </button>
        <button class="outline-none mx-1 flex items-center" @click.stop="removeClick">
          <span class="material-symbols text-2xl text-error">close</span>
        </button>
      </div>
      <p v-else class="text-gray-400 text-sm text-right">{{ durationPretty }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    item: {
      type: Object,
      default: () => {}
    },
    index: Number
  },
  data() {
    return {
      isHovering: false
    }
  },
  computed: {
    title() {
      return this.item.title || ''
    },
    subtitle() {
      return this.item.subtitle || ''
    },
    caption() {
      return this.item.caption
    },
    libraryItemId() {
      return this.item.libraryItemId
    },
    episodeId() {
      return this.item.episodeId
    },
    coverPath() {
      return this.item.coverPath
    },
    coverUrl() {
      if (!this.coverPath) return `${this.$config.routerBasePath}/book_placeholder.jpg`
      return this.$store.getters['globals/getLibraryItemCoverSrcById'](this.libraryItemId)
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    duration() {
      return this.item.duration
    },
    durationPretty() {
      if (!this.duration) return 'N/A'
      return this.$elapsedPretty(this.duration)
    },
    isOpenInPlayer() {
      return this.$store.getters['getIsMediaStreaming'](this.libraryItemId, this.episodeId)
    },
    wrapperClass() {
      if (this.isOpenInPlayer) return 'bg-yellow-400 bg-opacity-10'
      if (this.index % 2 === 0) return 'bg-gray-300 bg-opacity-5 hover:bg-opacity-10'
      return 'bg-bg hover:bg-gray-300 hover:bg-opacity-10'
    }
  },
  methods: {
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    playClick() {
      this.$emit('play', this.item)
    },
    removeClick() {
      this.$emit('remove', this.item)
    }
  },
  mounted() {}
}
</script>

<style scoped>
.queue-item-row-content {
  max-width: calc(100% - 48px - 128px);
}
</style>