<template>
  <div ref="card" :id="`series-card-${index}`" :style="{ width: width + 'px', height: height + 'px' }" class="absolute top-0 left-0 rounded-sm z-10 cursor-pointer box-shadow-book" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard">
    <div class="w-full h-full bg-primary relative rounded overflow-hidden">
      <covers-group-cover v-if="series" ref="cover" :id="seriesId" :name="title" :book-items="books" :width="width" :height="height" :book-cover-aspect-ratio="bookCoverAspectRatio" :group-to="seriesBooksRoute" />
    </div>

    <div v-if="hasValidCovers" class="bg-black bg-opacity-60 absolute top-0 left-0 w-full h-full flex items-center justify-center text-center transition-opacity z-30" :class="isHovering ? '' : 'opacity-0'" :style="{ padding: `${sizeMultiplier}rem` }">
      <p class="font-book" :style="{ fontSize: 1.2 * sizeMultiplier + 'rem' }">{{ title }}</p>
    </div>
    <!-- <div v-if="isHovering || isSelectionMode" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-40">
    </div> -->
    <div class="categoryPlacard absolute z-30 left-0 right-0 mx-auto -bottom-6 h-6 rounded-md font-book text-center" :style="{ width: Math.min(160, width) + 'px' }">
      <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm border" :style="{ padding: `0rem ${0.5 * sizeMultiplier}rem` }">
        <p class="truncate" :style="{ fontSize: labelFontSize + 'rem' }">{{ title }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    index: Number,
    width: Number,
    height: Number,
    bookCoverAspectRatio: Number
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
    title() {
      return this.series ? this.series.name : ''
    },
    books() {
      return this.series ? this.series.books || [] : []
    },
    store() {
      return this.$store || this.$nuxt.$store
    },
    currentLibraryId() {
      return this.store.state.libraries.currentLibraryId
    },
    seriesBooksRoute() {
      return `/library/${this.currentLibraryId}/series/${this.$encode(this.title)}`
    },
    seriesId() {
      return this.series ? this.$encode(this.series.id) : null
    },
    hasValidCovers() {
      var validCovers = this.books.map((bookItem) => bookItem.book.cover)
      return !!validCovers.length
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
      router.push(`/library/${this.currentLibraryId}/bookshelf/series?series=${this.seriesId}`)
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
  mounted() {},
  beforeDestroy() {}
}
</script>