<template>
  <div ref="card" :id="`series-card-${index}`" :style="{ width: width + 'px', height: cardHeight + 'px' }" class="absolute top-0 left-0 rounded-sm z-10 cursor-pointer box-shadow-book" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard">
    <div class="w-full h-full bg-primary relative rounded overflow-hidden">
      <covers-group-cover ref="cover" :name="title" :book-items="books" :width="width" :height="width" :group-to="seriesBooksRoute" />
    </div>

    <!-- <div v-if="isHovering || isSelectionMode" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-40">
    </div> -->
    <div class="categoryPlacard absolute z-30 left-0 right-0 mx-auto -bottom-6 h-6 rounded-md font-book text-center" :style="{ width: Math.min(160, width) + 'px' }">
      <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm border" :style="{ padding: `0rem ${1 * sizeMultiplier}rem` }">
        <p class="truncate" :style="{ fontSize: labelFontSize + 'rem' }">{{ title }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    index: Number,
    width: Number
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
    cardHeight() {
      return this.width
    },
    sizeMultiplier() {
      return this.width / 120
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
      router.push(`/library/${this.currentLibraryId}/bookshelf/series?series=${this.$encode(this.series.id)}`)
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
  mounted() {}
}
</script>