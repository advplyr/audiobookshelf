<template>
  <div ref="card" :id="`series-card-${index}`" :style="{ width: width + 'px', height: height + 'px' }" class="rounded-sm z-30 cursor-pointer" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard">
    <div class="absolute top-0 left-0 w-full box-shadow-book shadow-height" />
    <div class="w-full h-full bg-primary relative rounded overflow-hidden z-0">
      <covers-group-cover v-if="series" ref="cover" :id="seriesId" :name="displayTitle" :book-items="books" :width="width" :height="height" :book-cover-aspect-ratio="bookCoverAspectRatio" :group-to="seriesBooksRoute" />
    </div>

    <div class="absolute z-10 top-1.5 right-1.5 rounded-md leading-3 text-sm p-1 font-semibold text-white flex items-center justify-center" style="background-color: #cd9d49dd">{{ books.length }}</div>

    <div v-if="isSeriesFinished" class="absolute bottom-0 left-0 h-1 shadow-sm max-w-full z-10 rounded-b bg-success w-full" />

    <div v-if="hasValidCovers" class="bg-black bg-opacity-60 absolute top-0 left-0 w-full h-full flex items-center justify-center text-center transition-opacity" :class="isHovering ? '' : 'opacity-0'" :style="{ padding: `${sizeMultiplier}rem` }">
      <p class="font-book" :style="{ fontSize: 1.2 * sizeMultiplier + 'rem' }">{{ displayTitle }}</p>
    </div>

    <div v-if="!isAlternativeBookshelfView" class="categoryPlacard absolute z-30 left-0 right-0 mx-auto -bottom-6 h-6 rounded-md font-book text-center" :style="{ width: Math.min(160, width) + 'px' }">
      <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm border" :style="{ padding: `0rem ${0.5 * sizeMultiplier}rem` }">
        <p class="truncate" :style="{ fontSize: labelFontSize + 'rem' }">{{ displayTitle }}</p>
      </div>
    </div>
    <div v-else class="absolute z-30 left-0 right-0 mx-auto -bottom-8 h-8 py-1 rounded-md text-center">
      <p class="truncate" :style="{ fontSize: labelFontSize + 'rem' }">{{ displayTitle }}</p>
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
    isCategorized: Boolean,
    seriesMount: {
      type: Object,
      default: () => null
    },
    sortingIgnorePrefix: Boolean
  },
  data() {
    return {
      series: null,
      isSelectionMode: false,
      selected: false,
      isHovering: false,
      imageReady: false
    }
  },
  computed: {
    labelFontSize() {
      if (this.width < 160) return 0.75
      return 0.875
    },
    sizeMultiplier() {
      if (this.bookCoverAspectRatio === 1) return this.width / (120 * 1.6 * 2)
      return this.width / 240
    },
    seriesId() {
      return this.series ? this.series.id : ''
    },
    title() {
      return this.series ? this.series.name : ''
    },
    nameIgnorePrefix() {
      return this.series ? this.series.nameIgnorePrefix : ''
    },
    displayTitle() {
      if (this.sortingIgnorePrefix) return this.nameIgnorePrefix || this.title
      return this.title
    },
    books() {
      return this.series ? this.series.books || [] : []
    },
    addedAt() {
      return this.series ? this.series.addedAt : 0
    },
    seriesBookProgress() {
      return this.books
        .map((libraryItem) => {
          return this.store.getters['user/getUserMediaProgress'](libraryItem.id)
        })
        .filter((p) => !!p)
    },
    seriesBooksFinished() {
      return this.seriesBookProgress.filter((p) => p.isFinished)
    },
    isSeriesFinished() {
      return this.books.length === this.seriesBooksFinished.length
    },
    store() {
      return this.$store || this.$nuxt.$store
    },
    currentLibraryId() {
      return this.store.state.libraries.currentLibraryId
    },
    seriesBooksRoute() {
      return `/library/${this.currentLibraryId}/series/${this.seriesId}`
    },
    hasValidCovers() {
      var validCovers = this.books.map((bookItem) => bookItem.media.coverPath)
      return !!validCovers.length
    },
    isAlternativeBookshelfView() {
      const constants = this.$constants || this.$nuxt.$constants
      return this.bookshelfView == constants.BookshelfView.TITLES
    }
  },
  methods: {
    setEntity(_series) {
      this.series = _series
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
      if (!this.series) return
      var router = this.$router || this.$nuxt.$router
      router.push(`/library/${this.currentLibraryId}/series/${this.seriesId}`)
    },
    imageLoaded() {
      this.imageReady = true
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
    if (this.seriesMount) {
      this.setEntity(this.seriesMount)
    }
  },
  beforeDestroy() {}
}
</script>
