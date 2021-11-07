<template>
  <div class="relative">
    <div ref="shelf" class="w-full max-w-full categorizedBookshelfRow relative overflow-x-scroll overflow-y-hidden z-10" :style="{ paddingLeft: paddingLeft * sizeMultiplier + 'rem' }" @scroll="scrolled">
      <div class="w-full h-full" :style="{ marginTop: sizeMultiplier + 'rem' }">
        <div v-if="shelf.books" class="flex items-center -mb-2">
          <template v-for="entity in shelf.books">
            <cards-book-card :key="entity.id" :width="bookCoverWidth" :user-progress="userAudiobooks[entity.id]" :audiobook="entity" @hook:updated="updatedBookCard" :padding-y="24" @edit="editBook" />
          </template>
        </div>
        <div v-else-if="shelf.series" class="flex items-center -mb-2">
          <template v-for="entity in shelf.series">
            <cards-group-card :key="entity.name" :width="bookCoverWidth" :group="entity" @click="$emit('clickSeries', entity)" />
          </template>
        </div>
        <div v-else-if="shelf.tags" class="flex items-center -mb-2">
          <template v-for="entity in shelf.tags">
            <nuxt-link :key="entity.name" :to="`/library/${currentLibraryId}/bookshelf?filter=tags.${$encode(entity.name)}`">
              <cards-group-card :width="bookCoverWidth" :group="entity" />
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

    <div v-show="canScrollLeft && !isScrolling" class="absolute top-0 left-0 w-32 pr-8 bg-black book-shelf-arrow-left flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 z-30" @click="scrollLeft">
      <span class="material-icons text-8xl text-white">chevron_left</span>
    </div>
    <div v-show="canScrollRight && !isScrolling" class="absolute top-0 right-0 w-32 pl-8 bg-black book-shelf-arrow-right flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 z-30" @click="scrollRight">
      <span class="material-icons text-8xl text-white">chevron_right</span>
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
    bookCoverWidth: Number
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
    userAudiobooks() {
      return this.$store.state.user.user ? this.$store.state.user.user.audiobooks || {} : {}
    },
    paddingLeft() {
      if (window.innerWidth < 768) return 1
      return 2.5
    }
  },
  methods: {
    editBook(audiobook) {
      var bookIds = this.shelf.books.map((e) => e.id)
      this.$store.commit('setBookshelfBookIds', bookIds)
      this.$store.commit('showEditModal', audiobook)
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
  background-image: url(/wood_panels.jpg);
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