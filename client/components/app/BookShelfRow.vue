<template>
  <div class="relative">
    <div ref="shelf" class="w-full max-w-full bookshelf-row categorizedBookshelfRow relative overflow-x-scroll no-scroll overflow-y-hidden z-10" :style="{ paddingLeft: paddingLeft + 'em' }" @scroll="scrolled">
      <div class="w-full h-full pt-6e">
        <div v-if="shelf.type === 'book' || shelf.type === 'podcast'" class="flex items-center">
          <template v-for="(entity, index) in shelf.entities">
            <cards-lazy-book-card :key="entity.id" :ref="`shelf-book-${entity.id}`" :index="index" :book-mount="entity" :continue-listening-shelf="continueListeningShelf" class="relative mx-2e" @hook:updated="updatedBookCard" @select="selectItem" @edit="editItem" />
          </template>
        </div>
        <div v-if="shelf.type === 'episode'" class="flex items-center">
          <template v-for="(entity, index) in shelf.entities">
            <cards-lazy-book-card :key="entity.recentEpisode.id" :ref="`shelf-episode-${entity.recentEpisode.id}`" :index="index" :book-mount="entity" :continue-listening-shelf="continueListeningShelf" class="relative mx-2e" @hook:updated="updatedBookCard" @select="selectItem" @editPodcast="editItem" @edit="editEpisode" />
          </template>
        </div>
        <div v-if="shelf.type === 'series'" class="flex items-center">
          <template v-for="entity in shelf.entities">
            <cards-lazy-series-card :key="entity.name" :series-mount="entity" class="relative mx-2e" @hook:updated="updatedBookCard" />
          </template>
        </div>
        <div v-if="shelf.type === 'tags'" class="flex items-center">
          <template v-for="entity in shelf.entities">
            <cards-group-card :key="entity.name" :group="entity" class="relative mx-2e" @hook:updated="updatedBookCard" />
          </template>
        </div>
        <div v-if="shelf.type === 'authors'" class="flex items-center">
          <template v-for="entity in shelf.entities">
            <cards-author-card :key="entity.id" :authorMount="entity" @hook:updated="updatedBookCard" class="mx-2e" @edit="editAuthor" />
          </template>
        </div>
        <div v-if="shelf.type === 'narrators'" class="flex items-center">
          <template v-for="entity in shelf.entities">
            <cards-narrator-card :key="entity.name" :narrator="entity" @hook:updated="updatedBookCard" class="mx-2e" />
          </template>
        </div>
      </div>
    </div>
    <div class="relative">
      <div class="relative text-center categoryPlacard transform z-30 top-0 left-4e md:left-8e w-44e rounded-md">
        <div class="w-full h-full shinyBlack flex items-center justify-center rounded-xs border" :style="{ padding: `0em 0.5em` }">
          <h2 :style="{ fontSize: 0.9 + 'em' }">{{ $strings[shelf.labelStringKey] }}</h2>
        </div>
      </div>

      <div class="bookshelfDividerCategorized h-6e w-full absolute top-0 left-0 right-0 z-20"></div>
    </div>
    <button v-show="canScrollLeft && !isScrolling" :aria-label="$strings.ButtonScrollLeft" class="hidden sm:flex absolute top-0 left-0 w-32 pr-8 bg-black book-shelf-arrow-left items-center justify-center cursor-pointer opacity-0 hover:opacity-100 z-40" @click="scrollLeft">
      <span class="material-symbols text-white" :style="{ fontSize: 3.75 + 'em' }">chevron_left</span>
    </button>
    <button v-show="canScrollRight && !isScrolling" :aria-label="$strings.ButtonScrollRight" class="hidden sm:flex absolute top-0 right-0 w-32 pl-8 bg-black book-shelf-arrow-right items-center justify-center cursor-pointer opacity-0 hover:opacity-100 z-40" @click="scrollRight">
      <span class="material-symbols text-white" :style="{ fontSize: 3.75 + 'em' }">chevron_right</span>
    </button>
  </div>
</template>

<script>
export default {
  props: {
    index: Number,
    shelf: {
      type: Object,
      default: () => {}
    },
    continueListeningShelf: Boolean
  },
  data() {
    return {
      canScrollRight: false,
      canScrollLeft: false,
      isScrolling: false,
      scrollTimer: null,
      updateTimer: null
    }
  },
  computed: {
    sizeMultiplier() {
      return this.$store.getters['user/getSizeMultiplier']
    },
    paddingLeft() {
      if (window.innerWidth < 768) return 1
      return 2.5
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    isSelectionMode() {
      return this.$store.getters['globals/getIsBatchSelectingMediaItems']
    }
  },
  methods: {
    clearSelectedEntities() {
      this.updateSelectionMode(false)
    },
    editAuthor(author) {
      this.$store.commit('globals/showEditAuthorModal', author)
    },
    editItem(libraryItem, tab = 'details') {
      var itemIds = this.shelf.entities.map((e) => e.id)
      this.$store.commit('setBookshelfBookIds', itemIds)
      this.$store.commit('showEditModalOnTab', { libraryItem, tab: tab || 'details' })
    },
    editEpisode({ libraryItem, episode }) {
      this.$store.commit('setEpisodeTableEpisodeIds', [episode.id])
      this.$store.commit('setSelectedLibraryItem', libraryItem)
      this.$store.commit('globals/setSelectedEpisode', episode)
      this.$store.commit('globals/setShowEditPodcastEpisodeModal', true)
    },
    updateSelectionMode(val) {
      const selectedMediaItems = this.$store.state.globals.selectedMediaItems
      if (this.shelf.type === 'book' || this.shelf.type === 'podcast') {
        this.shelf.entities.forEach((ent) => {
          var component = this.$refs[`shelf-book-${ent.id}`]
          if (!component || !component.length) return
          component = component[0]
          component.setSelectionMode(val)
          component.selected = selectedMediaItems.some((i) => i.id === ent.id)
        })
      } else if (this.shelf.type === 'episode') {
        this.shelf.entities.forEach((ent) => {
          var component = this.$refs[`shelf-episode-${ent.recentEpisode.id}`]
          if (!component || !component.length) return
          component = component[0]
          component.setSelectionMode(val)
          component.selected = selectedMediaItems.some((i) => i.id === ent.id)
        })
      }
    },
    selectItem(payload) {
      this.$emit('selectEntity', payload)
    },
    itemSelectedEvt() {
      this.updateSelectionMode(this.isSelectionMode)
    },
    scrolled() {
      clearTimeout(this.scrollTimer)
      this.scrollTimer = setTimeout(() => {
        this.isScrolling = false
        this.$nextTick(this.checkCanScroll)
      }, 50)
    },
    scrollLeft() {
      if (!this.$refs.shelf) {
        return
      }
      this.isScrolling = true
      this.$refs.shelf.scrollLeft = 0
    },
    scrollRight() {
      if (!this.$refs.shelf) {
        return
      }
      this.isScrolling = true
      this.$refs.shelf.scrollLeft = 999
    },
    updatedBookCard() {
      clearTimeout(this.updateTimer)
      this.updateTimer = setTimeout(() => {
        this.$nextTick(this.checkCanScroll)
      }, 100)
    },
    checkCanScroll() {
      if (!this.$refs.shelf) {
        return
      }
      var clientWidth = this.$refs.shelf.clientWidth
      var scrollWidth = this.$refs.shelf.scrollWidth
      var scrollLeft = this.$refs.shelf.scrollLeft
      if (scrollWidth > clientWidth) {
        this.canScrollRight = scrollLeft === 0
        this.canScrollLeft = scrollLeft > 0
      } else {
        this.canScrollRight = false
        this.canScrollLeft = false
      }
    }
  },
  mounted() {
    this.$eventBus.$on('bookshelf_clear_selection', this.clearSelectedEntities)
    this.$eventBus.$on('item-selected', this.itemSelectedEvt)
  },
  beforeDestroy() {
    this.$eventBus.$off('bookshelf_clear_selection', this.clearSelectedEntities)
    this.$eventBus.$off('item-selected', this.itemSelectedEvt)
  }
}
</script>

<style>
.categorizedBookshelfRow {
  scroll-behavior: smooth;
  background-image: var(--bookshelf-texture-img);
  background-repeat: repeat-x;
}

.bookshelfDividerCategorized {
  background: rgb(149, 119, 90);
  background: linear-gradient(180deg, rgb(122, 94, 68) 0%, rgb(92, 62, 31) 17%, rgb(82, 54, 26) 88%, rgba(71, 48, 25, 1) 100%);
  box-shadow: 2px 14px 8px #111111aa;
}

.book-shelf-arrow-right {
  height: calc(100% - 1.5em);
  background: rgb(48, 48, 48);
  background: linear-gradient(90deg, rgba(48, 48, 48, 0) 0%, rgba(25, 25, 25, 0.25) 8%, rgba(17, 17, 17, 0.4) 28%, rgba(17, 17, 17, 0.6) 71%, rgba(10, 10, 10, 0.6) 86%, rgba(0, 0, 0, 0.7) 100%);
}
.book-shelf-arrow-left {
  height: calc(100% - 1.5em);
  background: rgb(48, 48, 48);
  background: linear-gradient(-90deg, rgba(48, 48, 48, 0) 0%, rgba(25, 25, 25, 0.25) 8%, rgba(17, 17, 17, 0.4) 28%, rgba(17, 17, 17, 0.6) 71%, rgba(10, 10, 10, 0.6) 86%, rgba(0, 0, 0, 0.7) 100%);
}
</style>
