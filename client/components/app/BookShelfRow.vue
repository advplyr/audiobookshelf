<template>
  <div class="relative">
    <div ref="shelf" class="w-full max-w-full categorizedBookshelfRow relative overflow-x-scroll overflow-y-hidden z-10" :style="{ paddingLeft: paddingLeft * sizeMultiplier + 'rem', height: shelfHeight + 'px' }" @scroll="scrolled">
      <div class="w-full h-full pt-6">
        <div v-if="shelf.type === 'books'" class="flex items-center">
          <template v-for="(entity, index) in shelf.entities">
            <cards-lazy-book-card :key="entity.id" :ref="`shelf-book-${entity.id}`" :index="index" :width="bookCoverWidth" :height="bookCoverHeight" :book-cover-aspect-ratio="bookCoverAspectRatio" :book-mount="entity" class="relative mx-2" @hook:updated="updatedBookCard" @select="selectBook" @edit="editBook" />
          </template>
        </div>
        <div v-if="shelf.type === 'series'" class="flex items-center">
          <template v-for="entity in shelf.entities">
            <cards-lazy-series-card :key="entity.name" :series-mount="entity" :height="bookCoverHeight" :width="bookCoverWidth * 2" :book-cover-aspect-ratio="bookCoverAspectRatio" class="relative mx-2" @hook:updated="updatedBookCard" />
          </template>
        </div>
        <div v-if="shelf.type === 'tags'" class="flex items-center">
          <template v-for="entity in shelf.entities">
            <nuxt-link :key="entity.name" :to="`/library/${currentLibraryId}/bookshelf?filter=tags.${$encode(entity.name)}`">
              <cards-group-card is-categorized :width="bookCoverWidth" :group="entity" :book-cover-aspect-ratio="bookCoverAspectRatio" @hook:updated="updatedBookCard" />
            </nuxt-link>
          </template>
        </div>
        <div v-if="shelf.type === 'authors'" class="flex items-center">
          <template v-for="entity in shelf.entities">
            <nuxt-link :key="entity.id" :to="`/library/${currentLibraryId}/bookshelf?filter=authors.${$encode(entity.id)}`">
              <cards-author-card :width="bookCoverWidth / 1.25" :height="bookCoverWidth" :author="entity" :size-multiplier="sizeMultiplier" @hook:updated="updatedBookCard" class="pb-6 mx-2" />
            </nuxt-link>
          </template>
        </div>
      </div>
    </div>

    <div class="absolute text-center categoryPlacard font-book transform z-30 bottom-0.5 left-4 md:left-8 w-36 rounded-md" style="height: 22px">
      <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm border">
        <p class="transform text-sm">{{ shelf.label }}</p>
      </div>
    </div>

    <div class="bookshelfDividerCategorized h-6 w-full absolute bottom-0 left-0 right-0 z-20"></div>

    <div v-show="canScrollLeft && !isScrolling" class="hidden sm:flex absolute top-0 left-0 w-32 pr-8 bg-black book-shelf-arrow-left items-center justify-center cursor-pointer opacity-0 hover:opacity-100 z-30" @click="scrollLeft">
      <span class="material-icons text-6xl text-white">chevron_left</span>
    </div>
    <div v-show="canScrollRight && !isScrolling" class="hidden sm:flex absolute top-0 right-0 w-32 pl-8 bg-black book-shelf-arrow-right items-center justify-center cursor-pointer opacity-0 hover:opacity-100 z-30" @click="scrollRight">
      <span class="material-icons text-6xl text-white">chevron_right</span>
    </div>
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
    sizeMultiplier: Number,
    bookCoverWidth: Number,
    bookCoverAspectRatio: Number
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
  watch: {
    isSelectionMode(newVal) {
      this.updateSelectionMode(newVal)
    }
  },
  computed: {
    bookCoverHeight() {
      return this.bookCoverWidth * this.bookCoverAspectRatio
    },
    shelfHeight() {
      return this.bookCoverHeight + 48
    },
    userAudiobooks() {
      return this.$store.state.user.user ? this.$store.state.user.user.audiobooks || {} : {}
    },
    paddingLeft() {
      if (window.innerWidth < 768) return 1
      return 2.5
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    isSelectionMode() {
      return this.$store.getters['getNumAudiobooksSelected'] > 0
    }
  },
  methods: {
    editBook(audiobook) {
      var bookIds = this.shelf.entities.map((e) => e.id)
      this.$store.commit('setBookshelfBookIds', bookIds)
      this.$store.commit('showEditModal', audiobook)
    },
    updateSelectionMode(val) {
      var selectedAudiobooks = this.$store.state.selectedAudiobooks
      if (this.shelf.type === 'books') {
        this.shelf.entities.forEach((ent) => {
          var component = this.$refs[`shelf-book-${ent.id}`]
          if (!component || !component.length) return
          component = component[0]
          component.setSelectionMode(val)
          component.selected = selectedAudiobooks.includes(ent.id)
        })
      }
    },
    selectBook(audiobook) {
      this.$store.commit('toggleAudiobookSelected', audiobook.id)
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
  }
}
</script>

<style>
.categorizedBookshelfRow {
  scroll-behavior: smooth;
  width: calc(100vw - 80px);

  /* background-color: rgb(214, 116, 36); */
  background-image: var(--bookshelf-texture-img);
  /* background-position: center; */
  /* background-size: contain; */
  background-repeat: repeat-x;
}
@media (max-width: 768px) {
  .categorizedBookshelfRow {
    width: 100vw;
  }
}

.bookshelfDividerCategorized {
  background: rgb(149, 119, 90);
  /* background: linear-gradient(180deg, rgba(149, 119, 90, 1) 0%, rgba(103, 70, 37, 1) 17%, rgba(103, 70, 37, 1) 88%, rgba(71, 48, 25, 1) 100%); */
  background: linear-gradient(180deg, rgb(122, 94, 68) 0%, rgb(92, 62, 31) 17%, rgb(82, 54, 26) 88%, rgba(71, 48, 25, 1) 100%);
  /* background: linear-gradient(180deg, rgb(114, 85, 59) 0%, rgb(73, 48, 22) 17%, rgb(71, 43, 15) 88%, rgb(61, 41, 20) 100%); */
  box-shadow: 2px 14px 8px #111111aa;
}

.book-shelf-arrow-right {
  height: calc(100% - 24px);
  background: rgb(48, 48, 48);
  background: linear-gradient(90deg, rgba(48, 48, 48, 0) 0%, rgba(25, 25, 25, 0.25) 8%, rgba(17, 17, 17, 0.4) 28%, rgba(17, 17, 17, 0.6) 71%, rgba(10, 10, 10, 0.6) 86%, rgba(0, 0, 0, 0.7) 100%);
}
.book-shelf-arrow-left {
  height: calc(100% - 24px);
  background: rgb(48, 48, 48);
  background: linear-gradient(-90deg, rgba(48, 48, 48, 0) 0%, rgba(25, 25, 25, 0.25) 8%, rgba(17, 17, 17, 0.4) 28%, rgba(17, 17, 17, 0.6) 71%, rgba(10, 10, 10, 0.6) 86%, rgba(0, 0, 0, 0.7) 100%);
}
</style>