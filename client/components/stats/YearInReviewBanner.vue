<template>
  <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-1 sm:p-4 mb-4">
    <!-- hack to get icon fonts loaded on init -->
    <div class="h-0 w-0 overflow-hidden opacity-0">
      <span class="material-symbols">close</span>
      <span class="abs-icons icon-audiobookshelf" />
    </div>

    <div class="flex items-center">
      <h1 class="hidden md:block text-xl font-semibold">{{ $getString('HeaderYearReview', [yearInReviewYear]) }}</h1>
      <div class="hidden md:block flex-grow" />
      <ui-btn class="w-full md:w-auto" @click.stop="clickShowYearInReview">{{ showYearInReview ? $strings.LabelYearReviewHide : $strings.LabelYearReviewShow }}</ui-btn>
    </div>

    <!-- your year in review -->
    <div v-if="showYearInReview">
      <div class="w-full h-px bg-slate-200/10 my-4" />

      <div v-if="availableYears.length > 1" class="mb-2 py-2 max-w-[800px] mx-auto">
        <!-- year selector -->
        <ui-dropdown v-model="yearInReviewYear" small :items="availableYears" :disabled="processingYearInReview" class="max-w-24" @input="yearInReviewYearChanged" />
      </div>

      <div role="toolbar" class="flex items-center justify-center mb-2 max-w-[800px] mx-auto">
        <!-- previous button -->
        <ui-btn small :disabled="!yearInReviewVariant || processingYearInReview" :aria-label="$strings.ButtonPrevious" class="inline-flex items-center font-semibold" @click="yearInReviewVariant--">
          <span class="material-symbols text-lg sm:pr-1 py-px sm:py-0">chevron_left</span>
          <span class="hidden sm:inline-block pr-2">{{ $strings.ButtonPrevious }}</span>
        </ui-btn>
        <!-- share button -->
        <ui-btn v-if="showShareButton" small :disabled="processingYearInReview" class="inline-flex items-center font-semibold ml-1 sm:ml-2" @click="shareYearInReview">{{ $strings.ButtonShare }} </ui-btn>

        <div class="flex-grow" />
        <h2 class="hidden sm:block text-lg font-semibold">{{ $getString('LabelPersonalYearReview', [yearInReviewVariant + 1]) }}</h2>
        <p class="block sm:hidden text-lg font-semibold">{{ yearInReviewVariant + 1 }}</p>
        <div class="flex-grow" />

        <!-- refresh button -->
        <ui-btn small :disabled="processingYearInReview" class="inline-flex items-center font-semibold mr-1 sm:mr-2" @click="refreshYearInReview">
          <span class="hidden sm:inline-block">{{ $strings.ButtonRefresh }}</span>
          <span class="material-symbols sm:!hidden text-lg py-px">refresh</span>
        </ui-btn>
        <!-- next button -->
        <ui-btn small :disabled="yearInReviewVariant >= 2 || processingYearInReview" :aria-label="$strings.ButtonNext" class="inline-flex items-center font-semibold" @click="yearInReviewVariant++">
          <span class="hidden sm:inline-block pl-2">{{ $strings.ButtonNext }}</span>
          <span class="material-symbols text-lg sm:pl-1 py-px sm:py-0">chevron_right</span>
        </ui-btn>
      </div>
      <stats-year-in-review ref="yearInReview" :variant="yearInReviewVariant" :year="yearInReviewYear" :processing.sync="processingYearInReview" />

      <!-- your year in review short -->
      <div class="w-full max-w-[800px] mx-auto my-4">
        <!-- share button -->
        <ui-btn v-if="showShareButton" small :disabled="processingYearInReviewShort" class="inline-flex items-center font-semibold mb-1" @click="shareYearInReviewShort">{{ $strings.ButtonShare }}</ui-btn>
        <stats-year-in-review-short ref="yearInReviewShort" :year="yearInReviewYear" :processing.sync="processingYearInReviewShort" />
      </div>

      <!-- your server in review -->
      <div v-if="isAdminOrUp" role="toolbar" class="w-full max-w-[800px] mx-auto mb-2 mt-4 border-t pt-4 border-white/10">
        <div class="flex items-center justify-center mb-2">
          <!-- previous button -->
          <ui-btn small :disabled="!yearInReviewServerVariant || processingYearInReviewServer" :aria-label="$strings.ButtonPrevious" class="inline-flex items-center font-semibold" @click="yearInReviewServerVariant--">
            <span class="material-symbols text-lg sm:pr-1 py-px sm:py-0">chevron_left</span>
            <span class="hidden sm:inline-block pr-2">{{ $strings.ButtonPrevious }}</span>
          </ui-btn>
          <!-- share button -->
          <ui-btn v-if="showShareButton" small :disabled="processingYearInReviewServer" class="inline-flex items-center font-semibold ml-1 sm:ml-2" @click="shareYearInReviewServer">{{ $strings.ButtonShare }} </ui-btn>

          <div class="flex-grow" />
          <h2 class="hidden sm:block text-lg font-semibold">{{ $getString('LabelServerYearReview', [yearInReviewServerVariant + 1]) }}</h2>
          <p class="block sm:hidden text-lg font-semibold">{{ yearInReviewServerVariant + 1 }}</p>
          <div class="flex-grow" />

          <!-- refresh button -->
          <ui-btn small :disabled="processingYearInReviewServer" class="inline-flex items-center font-semibold mr-1 sm:mr-2" @click="refreshYearInReviewServer">
            <span class="hidden sm:inline-block">{{ $strings.ButtonRefresh }}</span>
            <span class="material-symbols sm:!hidden text-lg py-px">refresh</span>
          </ui-btn>
          <!-- next button -->
          <ui-btn small :disabled="yearInReviewServerVariant >= 2 || processingYearInReviewServer" :aria-label="$strings.ButtonNext" class="inline-flex items-center font-semibold" @click="yearInReviewServerVariant++">
            <span class="hidden sm:inline-block pl-2">{{ $strings.ButtonNext }}</span>
            <span class="material-symbols text-lg sm:pl-1 py-px sm:py-0">chevron_right</span>
          </ui-btn>
        </div>
      </div>
      <stats-year-in-review-server v-if="isAdminOrUp" ref="yearInReviewServer" :year="yearInReviewYear" :variant="yearInReviewServerVariant" :processing.sync="processingYearInReviewServer" />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      showYearInReview: false,
      availableYears: [],
      yearInReviewYear: 0,
      yearInReviewVariant: 0,
      yearInReviewServerVariant: 0,
      processingYearInReview: false,
      processingYearInReviewShort: false,
      processingYearInReviewServer: false,
      showShareButton: false
    }
  },
  computed: {
    isAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    user() {
      return this.$store.state.user.user
    }
  },
  methods: {
    shareYearInReviewServer() {
      this.$refs.yearInReviewServer.share()
    },
    shareYearInReview() {
      this.$refs.yearInReview.share()
    },
    shareYearInReviewShort() {
      this.$refs.yearInReviewShort.share()
    },
    yearInReviewYearChanged() {
      this.$nextTick(() => {
        this.refreshYearInReview()
        this.refreshYearInReviewServer()
      })
    },
    refreshYearInReviewServer() {
      if (this.$refs.yearInReviewServer != null) {
        this.$refs.yearInReviewServer.refresh()
      }
    },
    refreshYearInReview() {
      if (this.$refs.yearInReview != null && this.$refs.yearInReviewShort != null) {
        this.$refs.yearInReview.refresh()
        this.$refs.yearInReviewShort.refresh()
      }
    },
    clickShowYearInReview() {
      this.showYearInReview = !this.showYearInReview
    },
    getAvailableYears() {
      if (this.user) {
        const oldestDate = this.user.createdAt
        if (oldestDate) {
          const date = new Date(oldestDate)
          const oldestYear = date.getFullYear()
          const currentYear = new Date().getFullYear()

          const years = []
          for (let year = currentYear; year >= oldestYear; year--) {
            years.push({ value: year, text: year.toString() })
          }

          return years
        }
      }
      // Fallback on error
      return [{ value: this.yearInReviewYear, text: this.yearInReviewYear.toString() }]
    }
  },
  beforeMount() {
    this.yearInReviewYear = new Date().getFullYear()

    // When not December show previous year
    if (new Date().getMonth() < 11) {
      this.yearInReviewYear--
    }
  },
  mounted() {
    this.availableYears = this.getAvailableYears()

    if (typeof navigator.share !== 'undefined' && navigator.share) {
      this.showShareButton = true
    } else {
      console.warn('Navigator.share not supported')
    }
  }
}
</script>
