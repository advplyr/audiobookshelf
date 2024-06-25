<template>
  <div ref="card" :id="`album-card-${index}`" :style="{ width: cardWidth + 'px' }" class="absolute top-0 left-0 rounded-sm z-30 cursor-pointer" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard">
    <div class="relative" :style="{ height: coverHeight + 'px' }">
      <div class="absolute top-0 left-0 w-full box-shadow-book shadow-height" />
      <div class="w-full h-full bg-primary relative rounded overflow-hidden">
        <covers-preview-cover ref="cover" :src="coverSrc" :width="cardWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />
      </div>
    </div>

    <div class="relative w-full">
      <div v-if="!isAlternativeBookshelfView" class="categoryPlacard absolute z-30 left-0 right-0 mx-auto -bottom-6e h-6e rounded-md text-center" :style="{ width: Math.min(200, cardWidth) + 'px' }">
        <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm border" :style="{ padding: `0em ${0.5}em` }">
          <p class="truncate" :style="{ fontSize: labelFontSize + 'em' }">{{ title }}</p>
        </div>
      </div>
      <div v-else class="absolute z-30 left-0 right-0 mx-auto -bottom-8e h-8e py-1e rounded-md text-center">
        <p class="truncate" :style="{ fontSize: labelFontSize + 'em' }">{{ title }}</p>
        <p class="truncate text-gray-400" :style="{ fontSize: 0.8 + 'em' }">{{ artist || '&nbsp;' }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    index: Number,
    width: Number,
    height: {
      type: Number,
      default: 192
    },
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
    bookCoverAspectRatio() {
      return this.store.getters['libraries/getBookCoverAspectRatio']
    },
    cardWidth() {
      return this.width || this.coverHeight
    },
    coverHeight() {
      return this.height * this.sizeMultiplier
    },
    /*
    cardHeight() {
      return this.coverHeight + this.bottomTextHeight
    },
    bottomTextHeight() {
      if (!this.isAlternativeBookshelfView) return 0
      const lineHeight = 1.5
      const remSize = 16
      const baseHeight = this.sizeMultiplier * lineHeight * remSize
      const titleHeight = this.labelFontSize * baseHeight
      const paddingHeight = 4 * 2 * this.sizeMultiplier // py-1
      return titleHeight + paddingHeight
    },
    */
    coverSrc() {
      const config = this.$config || this.$nuxt.$config
      if (!this.album || !this.album.libraryItemId) return `${config.routerBasePath}/book_placeholder.jpg`
      return this.store.getters['globals/getLibraryItemCoverSrcById'](this.album.libraryItemId)
    },
    labelFontSize() {
      if (this.width < 160) return 0.75
      return 0.9
    },
    sizeMultiplier() {
      return this.store.getters['user/getSizeMultiplier']
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
