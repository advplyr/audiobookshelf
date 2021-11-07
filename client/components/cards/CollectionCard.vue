<template>
  <div class="relative">
    <div class="rounded-sm h-full relative" :style="{ padding: `${paddingY}px ${paddingX}px` }" @mouseover="mouseoverCard" @mouseleave="mouseleaveCard" @click="clickCard">
      <nuxt-link :to="groupTo" class="cursor-pointer">
        <div class="w-full relative" :class="isHovering ? 'bg-black-400' : 'bg-primary'" :style="{ height: coverHeight + 'px', width: coverWidth + 'px' }">
          <covers-collection-cover ref="groupcover" :book-items="bookItems" :width="coverWidth" :height="coverHeight" />

          <div v-show="isHovering" class="w-full h-full absolute top-0 left-0 z-10 bg-black bg-opacity-40 pointer-events-none">
            <!-- <div class="absolute pointer-events-auto" :style="{ top: 0.5 * sizeMultiplier + 'rem', left: 0.5 * sizeMultiplier + 'rem' }" @click.stop.prevent="toggleSelected">
              <span class="material-icons text-xl text-white text-opacity-75 hover:text-opacity-100">radio_button_unchecked</span>
            </div> -->
            <div class="absolute pointer-events-auto" :style="{ top: 0.5 * sizeMultiplier + 'rem', right: 0.5 * sizeMultiplier + 'rem' }" @click.stop.prevent="clickEdit">
              <span class="material-icons text-xl text-white text-opacity-75 hover:text-opacity-100">edit</span>
            </div>
          </div>
        </div>
      </nuxt-link>
    </div>

    <div class="categoryPlacard absolute z-30 left-0 right-0 mx-auto bottom-0 h-6 rounded-md font-book text-center" :style="{ width: Math.min(160, coverWidth) + 'px' }">
      <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm border" :style="{ padding: `0rem ${1 * sizeMultiplier}rem` }">
        <p class="truncate" :style="{ fontSize: labelFontSize + 'rem' }">{{ collectionName }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    collection: {
      type: Object,
      default: () => null
    },
    width: {
      type: Number,
      default: 120
    },
    paddingY: {
      type: Number,
      default: 24
    }
  },
  data() {
    return {
      isHovering: false
    }
  },
  watch: {
    width(newVal) {
      this.$nextTick(() => {
        if (this.$refs.groupcover && this.$refs.groupcover.init) {
          this.$refs.groupcover.init()
        }
      })
    }
  },
  computed: {
    labelFontSize() {
      if (this.coverWidth < 160) return 0.75
      return 0.875
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    _collection() {
      return this.collection || {}
    },
    groupTo() {
      return `/collection/${this._collection.id}`
    },
    coverWidth() {
      return this.width * 2
    },
    coverHeight() {
      return this.width * 1.6
    },
    sizeMultiplier() {
      return this.width / 120
    },
    paddingX() {
      return 16 * this.sizeMultiplier
    },
    bookItems() {
      return this._collection.books || []
    },
    collectionName() {
      return this._collection.name || 'No Name'
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    }
  },
  methods: {
    toggleSelected() {
      // Selected
    },
    clickEdit() {
      this.$store.commit('globals/setEditCollection', this.collection)
    },
    mouseoverCard() {
      this.isHovering = true
    },
    mouseleaveCard() {
      this.isHovering = false
    },
    clickCard() {
      this.$emit('click', this.collection)
    }
  }
}
</script>