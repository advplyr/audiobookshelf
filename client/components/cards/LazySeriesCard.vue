<template>
  <div cy-id="card" ref="card" :id="`series-card-${index}`" tabindex="0" :style="{ width: cardWidth + 'px' }" class="absolute rounded-xs z-30 cursor-pointer" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard">
    <div cy-id="covers-area" class="relative" :style="{ height: coverHeight + 'px' }">
      <div class="absolute top-0 left-0 w-full box-shadow-book shadow-height" />
      <div class="w-full h-full bg-primary relative rounded-sm overflow-hidden z-0">
        <covers-group-cover v-if="series" ref="cover" :id="seriesId" :name="displayTitle" :book-items="books" :width="cardWidth" :height="coverHeight" :book-cover-aspect-ratio="bookCoverAspectRatio" />
      </div>

      <div cy-id="seriesLengthMarker" class="absolute rounded-lg bg-black/90 box-shadow-md z-20" :style="{ top: 0.375 + 'em', right: 0.375 + 'em', padding: `0.1em 0.25em` }" style="background-color: #cd9d49dd">
        <p :style="{ fontSize: 0.8 + 'em' }" role="status" :aria-label="$strings.LabelNumberOfBooks">{{ books.length }}</p>
      </div>

      <div cy-id="seriesProgressBar" v-if="seriesPercentInProgress > 0" class="absolute bottom-0 left-0 h-1e shadow-xs max-w-full z-10 rounded-b w-full box-shadow-progressbar" :class="isSeriesFinished ? 'bg-success' : 'bg-yellow-400'" :style="{ width: seriesPercentInProgress * 100 + '%' }" />

      <div cy-id="hoveringDisplayTitle" v-if="hasValidCovers" aria-hidden="true" class="bg-black/60 absolute top-0 left-0 w-full h-full flex items-center justify-center text-center transition-opacity" :class="isHovering ? '' : 'opacity-0'" :style="{ padding: '1em' }">
        <p :style="{ fontSize: 1.2 + 'em' }">{{ displayTitle }}</p>
      </div>

      <span cy-id="rssFeedMarker" v-if="!isHovering && rssFeed" class="absolute z-10 material-symbols text-success" :style="{ top: 0.5 + 'em', left: 0.5 + 'em', fontSize: 1.5 + 'em' }">rss_feed</span>
    </div>

    <div cy-id="standardBottomText" v-if="!isAlternativeBookshelfView" class="categoryPlacard absolute z-10 left-0 right-0 mx-auto -bottom-6e h-6e rounded-md text-center" :style="{ width: Math.min(200, cardWidth) + 'px' }">
      <div class="w-full h-full shinyBlack flex items-center justify-center rounded-xs border" :style="{ padding: `0em 0.5em` }">
        <p cy-id="standardBottomDisplayTitle" class="truncate" :style="{ fontSize: labelFontSize + 'em' }">{{ displayTitle }}</p>
      </div>
    </div>
    <div cy-id="detailBottomText" v-else class="relative z-30 left-0 right-0 mx-auto py-1e rounded-md text-center">
      <p cy-id="detailBottomDisplayTitle" class="truncate" :style="{ fontSize: labelFontSize + 'em' }">{{ displayTitle }}</p>
      <p cy-id="detailBottomSortLine" v-if="displaySortLine" class="truncate text-gray-400" :style="{ fontSize: 0.8 + 'em' }">{{ displaySortLine }}</p>
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
    seriesMount: {
      type: Object,
      default: () => null
    },
    sortingIgnorePrefix: Boolean,
    orderBy: String
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
    bookCoverAspectRatio() {
      return this.store.getters['libraries/getBookCoverAspectRatio']
    },
    cardWidth() {
      return this.width || (this.coverHeight / this.bookCoverAspectRatio) * 2
    },
    coverHeight() {
      return this.height * this.sizeMultiplier
    },
    dateFormat() {
      return this.store.getters['getServerSetting']('dateFormat')
    },
    labelFontSize() {
      if (this.width < 160) return 0.75
      return 0.9
    },
    sizeMultiplier() {
      return this.store.getters['user/getSizeMultiplier']
    },
    seriesId() {
      return this.series?.id || ''
    },
    title() {
      return this.series?.name || ''
    },
    nameIgnorePrefix() {
      return this.series?.nameIgnorePrefix || ''
    },
    displayTitle() {
      if (this.sortingIgnorePrefix) return this.nameIgnorePrefix || this.title || '\u00A0'
      return this.title || '\u00A0'
    },
    displaySortLine() {
      switch (this.orderBy) {
        case 'addedAt':
          return this.$getString('LabelAddedDate', [this.$formatDate(this.addedAt, this.dateFormat)])
        case 'totalDuration':
          return `${this.$strings.LabelDuration} ${this.$elapsedPrettyExtended(this.totalDuration, false)}`
        case 'lastBookUpdated':
          const lastUpdated = Math.max(...this.books.map((x) => x.updatedAt), 0)
          return `${this.$strings.LabelLastBookUpdated} ${this.$formatDate(lastUpdated, this.dateFormat)}`
        case 'lastBookAdded':
          const lastBookAdded = Math.max(...this.books.map((x) => x.addedAt), 0)
          return `${this.$strings.LabelLastBookAdded} ${this.$formatDate(lastBookAdded, this.dateFormat)}`
        default:
          return null
      }
    },
    books() {
      return this.series?.books || []
    },
    addedAt() {
      return this.series?.addedAt || 0
    },
    totalDuration() {
      return this.series?.totalDuration || 0
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
    hasSeriesBookInProgress() {
      return this.seriesBookProgress.some((p) => !p.isFinished && p.progress > 0)
    },
    seriesPercentInProgress() {
      if (!this.books.length) return 0
      let progressPercent = 0
      this.seriesBookProgress.forEach((progress) => {
        progressPercent += progress.isFinished ? 1 : progress.progress || 0
      })
      progressPercent /= this.books.length
      return Math.min(1, Math.max(0, progressPercent))
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
      return this.bookshelfView == constants.BookshelfView.DETAIL
    },
    rssFeed() {
      return this.series?.rssFeed
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
