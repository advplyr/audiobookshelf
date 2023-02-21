<template>
  <div ref="card" :id="`album-card-${index}`" :style="{ width: width + 'px', height: height + 'px' }" class="absolute top-0 left-0 rounded-sm z-30 cursor-pointer" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard">
    <div class="absolute top-0 left-0 w-full box-shadow-book shadow-height" />
    <div class="w-full h-full bg-primary relative rounded overflow-hidden">
      <covers-preview-cover ref="cover" :src="coverSrc" :width="width" :book-cover-aspect-ratio="bookCoverAspectRatio" />
    </div>

    <div v-if="!isAlternativeBookshelfView" class="categoryPlacard absolute z-30 left-0 right-0 mx-auto -bottom-6 h-6 rounded-md text-center" :style="{ width: Math.min(200, width) + 'px' }">
      <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm border" :style="{ padding: `0rem ${0.5 * sizeMultiplier}rem` }">
        <p class="truncate" :style="{ fontSize: labelFontSize + 'rem' }">{{ title }}</p>
      </div>
    </div>
    <div v-else class="absolute z-30 left-0 right-0 mx-auto -bottom-8 h-8 py-1 rounded-md text-center">
      <p class="truncate" :style="{ fontSize: labelFontSize + 'rem' }">{{ title }}</p>
      <p class="truncate text-gray-400" :style="{ fontSize: 0.8 * sizeMultiplier + 'rem' }">{{ artist || '&nbsp;' }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    index: Number,
    width: Number,
    height: Number,
    bookCoverAspectRatio: Number,
    bookshelfView: {
      type: Number,
      default: 0
    },
    albumMount: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      album: null,
      isSelectionMode: false,
      selected: false,
      isHovering: false
    }
  },
  computed: {
    coverSrc() {
      const config = this.$config || this.$nuxt.$config
      if (!this.album || !this.album.libraryItemId) return `${config.routerBasePath}/book_placeholder.jpg`
      return this.store.getters['globals/getLibraryItemCoverSrcById'](this.album.libraryItemId)
    },
    labelFontSize() {
      if (this.width < 160) return 0.75
      return 0.875
    },
    sizeMultiplier() {
      const baseSize = this.bookCoverAspectRatio === 1 ? 192 : 120
      return this.width / baseSize
    },
    title() {
      return this.album ? this.album.title : ''
    },
    artist() {
      return this.album ? this.album.artist : ''
    },
    store() {
      return this.$store || this.$nuxt.$store
    },
    currentLibraryId() {
      return this.store.state.libraries.currentLibraryId
    },
    isAlternativeBookshelfView() {
      const constants = this.$constants || this.$nuxt.$constants
      return this.bookshelfView == constants.BookshelfView.DETAIL
    }
  },
  methods: {
    setEntity(album) {
      this.album = album
    },
    setSelectionMode(val) {
      this.isSelectionMode = val
    },
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    clickCard() {
      if (!this.album) return
      // const router = this.$router || this.$nuxt.$router
      // router.push(`/album/${this.$encode(this.title)}`)
    },
    clickEdit() {
      this.$emit('edit', this.album)
    },
    destroy() {
      // destroy the vue listeners, etc
      this.$destroy()

      // remove the element from the DOM
      if (this.$el && this.$el.parentNode) {
        this.$el.parentNode.removeChild(this.$el)
      } else if (this.$el && this.$el.remove) {
        this.$el.remove()
      }
    }
  },
  mounted() {
    if (this.albumMount) {
      this.setEntity(this.albumMount)
    }
  }
}
</script>