<template>
  <div ref="card" :id="`collection-card-${index}`" :style="{ width: width + 'px', height: height + 'px' }" class="absolute top-0 left-0 rounded-sm z-30 cursor-pointer" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard">
    <div class="absolute top-0 left-0 w-full box-shadow-book shadow-height" />
    <div class="w-full h-full bg-primary relative rounded overflow-hidden">
      <covers-collection-cover ref="cover" :book-items="books" :width="width" :height="height" :book-cover-aspect-ratio="bookCoverAspectRatio" />
    </div>
    <div v-show="isHovering" class="w-full h-full absolute top-0 left-0 z-10 bg-black bg-opacity-40 pointer-events-none">
      <div class="absolute pointer-events-auto" :style="{ top: 0.5 * sizeMultiplier + 'rem', right: 0.5 * sizeMultiplier + 'rem' }" @click.stop.prevent="clickEdit">
        <span class="material-icons text-xl text-white text-opacity-75 hover:text-opacity-100">edit</span>
      </div>
    </div>
    <div v-if="!isAlternativeBookshelfView" class="categoryPlacard absolute z-30 left-0 right-0 mx-auto -bottom-6 h-6 rounded-md font-book text-center" :style="{ width: Math.min(160, width) + 'px' }">
      <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm border" :style="{ padding: `0rem ${0.5 * sizeMultiplier}rem` }">
        <p class="truncate" :style="{ fontSize: labelFontSize + 'rem' }">{{ title }}</p>
      </div>
    </div>
    <div v-else class="absolute z-30 left-0 right-0 mx-auto -bottom-8 h-8 py-1 rounded-md text-center">
      <p class="truncate" :style="{ fontSize: labelFontSize + 'rem' }">{{ title }}</p>
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
    collectionMount: {
      type: Object,
      default: () => null
    },
    isTag: Boolean
  },
  data() {
    return {
      collection: null,
      isSelectionMode: false,
      selected: false,
      isHovering: false
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
      return this.collection ? this.collection.name : ''
    },
    books() {
      return this.collection ? this.collection.books || [] : []
    },
    store() {
      return this.$store || this.$nuxt.$store
    },
    currentLibraryId() {
      return this.store.state.libraries.currentLibraryId
    },
    isAlternativeBookshelfView() {
      const constants = this.$constants || this.$nuxt.$constants
      return this.bookshelfView == constants.BookshelfView.TITLES
    }
  },
  methods: {
    setEntity(_collection) {
      this.collection = _collection
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
      if (!this.collection) return
      var router = this.$router || this.$nuxt.$router
      router.push(`/collection/${this.collection.id}`)
    },
    clickEdit() {
      this.$emit('edit', this.collection)
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
    if (this.collectionMount) {
      this.setEntity(this.collectionMount)
    }
  }
}
</script>