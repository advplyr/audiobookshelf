<template>
  <div cy-id="card" ref="card" :id="`series-card-${index}`" :style="{ width: width + 'px', height: height + 'px' }" class="absolute rounded-sm z-30 cursor-pointer" @mousedown.prevent @mouseup.prevent @mousemove.prevent @mouseover="mouseover" @mouseleave="mouseleave" @click="clickCard">
    <div class="absolute top-0 left-0 w-full box-shadow-book shadow-height" />
    <div class="w-full h-full bg-primary relative rounded overflow-hidden z-0">
      <covers-group-cover v-if="series" ref="cover" :id="seriesId" :name="displayTitle" :book-items="books" :width="width" :height="height" :book-cover-aspect-ratio="bookCoverAspectRatio" />
    </div>

    <div cy-id="seriesLengthMarker" class="absolute z-10 top-1.5 right-1.5 rounded-md leading-3 text-sm p-1 font-semibold text-white flex items-center justify-center" style="background-color: #cd9d49dd">{{ books.length }}</div>

    <div cy-id="seriesProgressBar" v-if="seriesPercentInProgress > 0" class="absolute bottom-0 left-0 h-1 shadow-sm max-w-full z-10 rounded-b w-full" :class="isSeriesFinished ? 'bg-success' : 'bg-yellow-400'" :style="{ width: seriesPercentInProgress * 100 + '%' }" />

    <div cy-id="hoveringDisplayTitle" v-if="hasValidCovers" class="bg-black bg-opacity-60 absolute top-0 left-0 w-full h-full flex items-center justify-center text-center transition-opacity" :class="isHovering ? '' : 'opacity-0'" :style="{ padding: `${sizeMultiplier}rem` }">
      <p :style="{ fontSize: 1.2 * sizeMultiplier + 'rem' }">{{ displayTitle }}</p>
    </div>

    <span cy-id="rssFeedMarker" v-if="!isHovering && rssFeed" class="absolute z-10 material-icons text-success" :style="{ top: 0.5 * sizeMultiplier + 'rem', left: 0.5 * sizeMultiplier + 'rem', fontSize: 1.5 * sizeMultiplier + 'rem' }">rss_feed</span>

    <div cy-id="standardBottomText" v-if="!isAlternativeBookshelfView" class="categoryPlacard absolute z-10 left-0 right-0 mx-auto -bottom-6 h-6 rounded-md text-center" :style="{ width: Math.min(200, width) + 'px' }">
      <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm border" :style="{ padding: `0rem ${0.5 * sizeMultiplier}rem` }">
        <p cy-id="standardBottomDisplayTitle" class="truncate" :style="{ fontSize: labelFontSize + 'rem' }">{{ displayTitle }}</p>
      </div>
    </div>
    <div cy-id="detailBottomText" v-else class="absolute z-30 left-0 right-0 mx-auto -bottom-8 h-8 py-1 rounded-md text-center">
      <p cy-id="detailBottomDisplayTitle" class="truncate" :style="{ fontSize: labelFontSize * sizeMultiplier + 'rem' }">{{ displayTitle }}</p>
      <p cy-id="detailBottomSortLine" v-if="displaySortLine" class="truncate text-gray-400" :style="{ fontSize: 0.8 * sizeMultiplier + 'rem' }">{{ displaySortLine }}</p>
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
    isCategorized: Boolean,
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
    dateFormat() {
      return this.store.state.serverSettings.dateFormat
    },
    labelFontSize() {
      if (this.width < 160) return 0.75
      return 0.875
    },
    sizeMultiplier() {
      if (this.bookCoverAspectRatio === 1) return this.width / (120 * 1.6 * 2)
      return this.width / 240
    },
    seriesId() {
      return this.series ? this.series.id : ''
    },
    title() {
      return this.series ? this.series.name : ''
    },
    nameIgnorePrefix() {
      return this.series ? this.series.nameIgnorePrefix : ''
    },
    displayTitle() {
      if (this.sortingIgnorePrefix) return this.nameIgnorePrefix || this.title
      return this.title
    },
    displaySortLine() {
      switch (this.orderBy) {
        case 'addedAt':
          return `${this.$strings.LabelAdded} ${this.$formatDate(this.addedAt, this.dateFormat)}`
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
      return this.series ? this.series.books || [] : []
    },
    addedAt() {
      return this.series ? this.series.addedAt : 0
    },
    totalDuration() {
      return this.series ? this.series.totalDuration : 0
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
      return this.series ? this.series.rssFeed : null
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
