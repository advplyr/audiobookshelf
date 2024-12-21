<template>
  <div class="w-full">
    <div class="flex items-center py-3e">
      <slot />
      <div class="flex-grow" />
      <button cy-id="leftScrollButton" v-if="isScrollable" :aria-label="$strings.ButtonScrollLeft" class="w-8e h-8e mx-1e flex items-center justify-center rounded-full" :class="canScrollLeft ? 'hover:bg-white hover:bg-opacity-5 text-gray-300 hover:text-white' : 'text-white text-opacity-40 cursor-text'" @click="scrollLeft">
        <span class="material-symbols" :style="{ fontSize: 1.5 + 'em' }">chevron_left</span>
      </button>
      <button cy-id="rightScrollButton" v-if="isScrollable" :aria-label="$strings.ButtonScrollRight" class="w-8e h-8e mx-1e flex items-center justify-center rounded-full" :class="canScrollRight ? 'hover:bg-white hover:bg-opacity-5 text-gray-300 hover:text-white' : 'text-white text-opacity-40 cursor-text'" @click="scrollRight">
        <span class="material-symbols" :style="{ fontSize: 1.5 + 'em' }">chevron_right</span>
      </button>
    </div>
    <div cy-id="slider" ref="slider" class="w-full overflow-y-hidden overflow-x-auto no-scroll" style="scroll-behavior: smooth" @scroll="scrolled">
      <div class="flex space-x-4e">
        <template v-for="(item, index) in items">
          <div cy-id="item" ref="item" :key="itemKeyFunc(item)">
            <component :is="componentName" :ref="itemRefFunc(item)" :index="index" :[itemPropName]="item" :bookshelf-view="bookshelfView" :continue-listening-shelf="continueListeningShelf" class="relative" @edit="editFunc" @editPodcast="editItem" @select="selectItem" @hook:updated="setScrollVars" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    items: {
      type: Array,
      default: () => []
    },
    bookshelfView: {
      type: Number,
      default: 1
    },
    shelfId: {
      type: String,
      default: ''
    },
    continueListeningShelf: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      default: 'book'
    }
  },
  data() {
    return {
      isScrollable: false,
      canScrollLeft: false,
      canScrollRight: false,
      clientWidth: 0,
      shelfOptionsByType: {
        episode: {
          component: 'cards-lazy-book-card',
          itemPropName: 'book-mount',
          itemIdFunc: (item) => item.recentEpisode.id
        },
        series: {
          component: 'cards-lazy-series-card',
          itemPropName: 'series-mount',
          itemIdFunc: (item) => item.id
        },
        authors: {
          component: 'cards-author-card',
          itemPropName: 'author-mount',
          itemIdFunc: (item) => item.id
        },
        narrators: {
          component: 'cards-narrator-card',
          itemPropName: 'narrator',
          itemIdFunc: (item) => item.name
        },
        book: {
          component: 'cards-lazy-book-card',
          itemPropName: 'book-mount',
          itemIdFunc: (item) => item.id
        },
        podcast: {
          component: 'cards-lazy-book-card',
          itemPropName: 'book-mount',
          itemIdFunc: (item) => item.id
        }
      }
    }
  },
  computed: {
    isSelectionMode() {
      return this.$store.getters['globals/getIsBatchSelectingMediaItems']
    },
    options() {
      return this.shelfOptionsByType[this.type]
    },
    itemIdFunc() {
      return this.options.itemIdFunc
    },
    itemKeyFunc() {
      return (item) => this.itemIdFunc(item) + this.shelfId
    },
    itemRefFunc() {
      return (item) => `slider-item-${this.itemIdFunc(item)}`
    },
    componentName() {
      return this.options.component
    },
    itemPropName() {
      return this.options.itemPropName
    },
    editFunc() {
      switch (this.type) {
        case 'episode':
          return this.editEpisode
        case 'authors':
          return this.editAuthor
        default:
          return this.editItem
      }
    }
  },
  methods: {
    clearSelectedEntities() {
      this.updateSelectionMode(false)
    },
    editEpisode({ libraryItem, episode }) {
      this.$store.commit('setSelectedLibraryItem', libraryItem)
      this.$store.commit('globals/setSelectedEpisode', episode)
      this.$store.commit('globals/setShowEditPodcastEpisodeModal', true)
    },
    editAuthor(author) {
      this.$store.commit('globals/showEditAuthorModal', author)
    },
    editItem(libraryItem) {
      var itemIds = this.items.map((e) => e.id)
      this.$store.commit('setBookshelfBookIds', itemIds)
      this.$store.commit('showEditModal', libraryItem)
    },
    selectItem(payload) {
      this.$emit('selectEntity', payload)
    },
    itemSelectedEvt() {
      this.updateSelectionMode(this.isSelectionMode)
    },
    updateSelectionMode(val) {
      const selectedMediaItems = this.$store.state.globals.selectedMediaItems
      this.items.forEach((item) => {
        let component = this.$refs[this.itemRefFunc(item)]
        if (!component || !component.length) return
        component = component[0]
        component.setSelectionMode(val)
        component.selected = selectedMediaItems.some((i) => i.id === item.id)
      })
    },
    scrolled() {
      this.setScrollVars()
    },
    scrollRight() {
      if (!this.canScrollRight) return
      const slider = this.$refs.slider
      if (!slider) return
      const scrollAmount = this.clientWidth
      const maxScrollLeft = slider.scrollWidth - slider.clientWidth

      const newScrollLeft = Math.min(maxScrollLeft, slider.scrollLeft + scrollAmount)
      slider.scrollLeft = newScrollLeft
    },
    scrollLeft() {
      if (!this.canScrollLeft) return
      const slider = this.$refs.slider
      if (!slider) return

      const scrollAmount = this.clientWidth

      const newScrollLeft = Math.max(0, slider.scrollLeft - scrollAmount)
      slider.scrollLeft = newScrollLeft
    },
    setScrollVars() {
      const slider = this.$refs.slider
      if (!slider) return
      const { scrollLeft, scrollWidth, clientWidth } = slider
      const scrollRemaining = Math.abs(scrollLeft + clientWidth - scrollWidth)

      this.clientWidth = clientWidth
      this.isScrollable = scrollWidth > clientWidth
      this.canScrollRight = scrollRemaining >= 1
      this.canScrollLeft = scrollLeft > 0
    }
  },
  updated() {
    this.setScrollVars()
  },
  mounted() {
    this.setScrollVars()
    if (['book', 'podcast', 'episode'].includes(this.type)) {
      this.$eventBus.$on('bookshelf_clear_selection', this.clearSelectedEntities)
      this.$eventBus.$on('item-selected', this.itemSelectedEvt)
    }
  },
  beforeDestroy() {
    if (['book', 'podcast', 'episode'].includes(this.type)) {
      this.$eventBus.$off('bookshelf_clear_selection', this.clearSelectedEntities)
      this.$eventBus.$off('item-selected', this.itemSelectedEvt)
    }
  }
}
</script>
