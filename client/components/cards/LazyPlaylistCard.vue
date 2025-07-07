<template>
  <div ref="card" :id="`playlist-card-${index}`" role="button" :style="{ width: cardWidth + 'px', fontSize: sizeMultiplier + 'rem' }" class="absolute top-0 left-0 rounded-xs z-30 cursor-pointer" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard">
    <div class="relative" :style="{ height: coverHeight + 'px' }">
      <div class="absolute top-0 left-0 w-full box-shadow-book shadow-height" />
      <div class="w-full h-full bg-primary relative rounded-sm overflow-hidden">
        <covers-playlist-cover ref="cover" :items="items" :width="cardWidth" :height="coverHeight" />
      </div>
      <div v-show="isHovering && userCanUpdate" class="w-full h-full absolute top-0 left-0 z-10 bg-black/40 pointer-events-none">
        <div class="absolute pointer-events-auto" :style="{ top: 0.5 + 'em', right: 0.5 + 'em' }" @click.stop.prevent="clickEdit">
          <span class="material-symbols text-white/75 hover:text-white/100" :style="{ fontSize: 1.25 + 'em' }">edit</span>
        </div>
      </div>
    </div>

    <div v-if="!isAlternativeBookshelfView" class="categoryPlacard absolute z-30 -bottom-6e left-0 right-0 mx-auto h-6e rounded-md text-center" :style="{ width: Math.min(200, width) + 'px' }">
      <div class="w-full h-full shinyBlack flex items-center justify-center rounded-xs border" :style="{ padding: `0em ${0.5}em` }">
        <p class="truncate" :style="{ fontSize: labelFontSize + 'em' }">{{ title }}</p>
      </div>
    </div>
    <div v-else class="relative z-30 left-0 right-0 mx-auto h-8e py-1e rounded-md text-center">
      <p class="truncate" :style="{ fontSize: labelFontSize + 'em' }">{{ title }}</p>
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
    playlistMount: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      playlist: null,
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
    labelFontSize() {
      if (this.width < 160) return 0.75
      return 0.9
    },
    sizeMultiplier() {
      return this.store.getters['user/getSizeMultiplier']
    },
    title() {
      return this.playlist ? this.playlist.name : ''
    },
    items() {
      return this.playlist ? this.playlist.items || [] : []
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
    },
    userCanUpdate() {
      return this.store.getters['user/getUserCanUpdate']
    }
  },
  methods: {
    setEntity(playlist) {
      this.playlist = playlist
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
      if (!this.playlist) return
      var router = this.$router || this.$nuxt.$router
      router.push(`/playlist/${this.playlist.id}`)
    },
    clickEdit() {
      this.$emit('edit', this.playlist)
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
    if (this.playlistMount) {
      this.setEntity(this.playlistMount)
    }
  }
}
</script>
