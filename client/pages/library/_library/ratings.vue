<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden relative">
    <!-- Toolbar - same height as Series toolbar -->
    <div class="w-full h-10 relative z-40">
      <div id="ratings-toolbar" class="absolute top-0 left-0 w-full h-full flex items-center px-2 md:px-8">
        <p class="hidden md:block text-sm">
          {{ $formatNumber(totalReviews) }} {{ $strings.ButtonRatings }}
        </p>

        <div class="grow hidden sm:inline-block" />

        <!-- Sort Select -->
        <controls-sort-select v-model="selectedSort" :descending.sync="sortDesc" :items="sortItems" class="w-36 sm:w-44 h-7.5 ml-1 sm:ml-4" @change="onSortChange" />

        <!-- Filter by User -->
        <div ref="userFilter" class="relative ml-1 sm:ml-4 h-7.5" v-click-outside="closeUserMenu">
          <button type="button" class="h-full border border-gray-500 hover:border-gray-400 rounded-sm shadow-xs px-3 text-left cursor-pointer flex items-center" @click.prevent="showUserMenu = !showUserMenu">
            <span class="block truncate text-xs" :class="selectedUserFilter ? 'text-yellow-400' : 'text-gray-200'">{{ selectedUserText }}</span>
            <span class="material-symbols text-lg ml-1">expand_more</span>
          </button>
          <ul v-show="showUserMenu" class="absolute z-10 mt-1 w-44 bg-bg border border-black-200 shadow-lg max-h-60 rounded-md py-1 ring-1 ring-black/5 overflow-auto text-sm" role="menu">
            <li class="select-none relative py-1.5 px-3 cursor-pointer hover:bg-white/5" :class="!selectedUserFilter ? 'bg-white/5 text-yellow-400' : 'text-gray-200'" @click="setUserFilter(null)">
              {{ $strings.LabelAllUsers }}
            </li>
            <li v-for="u in reviewers" :key="u.id" class="select-none relative py-1.5 px-3 cursor-pointer hover:bg-white/5" :class="selectedUserFilter === u.id ? 'bg-white/5 text-yellow-400' : 'text-gray-200'" @click="setUserFilter(u.id)">
              {{ u.username }}
            </li>
          </ul>
        </div>

        <!-- Filter by Rating -->
        <div ref="ratingFilter" class="relative ml-1 sm:ml-4 h-7.5" v-click-outside="closeRatingMenu">
          <button type="button" class="h-full border border-gray-500 hover:border-gray-400 rounded-sm shadow-xs px-3 text-left cursor-pointer flex items-center" @click.prevent="showRatingMenu = !showRatingMenu">
            <span class="block truncate text-xs" :class="selectedRatingFilter ? 'text-yellow-400' : 'text-gray-200'">{{ selectedRatingText }}</span>
            <span class="material-symbols text-lg ml-1">expand_more</span>
          </button>
          <ul v-show="showRatingMenu" class="absolute z-10 mt-1 w-32 bg-bg border border-black-200 shadow-lg rounded-md py-1 ring-1 ring-black/5 overflow-auto text-sm" role="menu">
            <li class="select-none relative py-1.5 px-3 cursor-pointer hover:bg-white/5" :class="!selectedRatingFilter ? 'bg-white/5 text-yellow-400' : 'text-gray-200'" @click="setRatingFilter(null)">
              {{ $strings.LabelAllReviews }} ({{ totalReviews }})
            </li>
            <li v-for="n in 5" :key="n" class="select-none relative py-1.5 px-3 cursor-pointer hover:bg-white/5 flex items-center" :class="selectedRatingFilter === (6 - n) ? 'bg-white/5 text-yellow-400' : 'text-gray-200'" @click="setRatingFilter(6 - n)">
              <ui-star-rating :value="6 - n" readonly :size="12" />
              <span class="ml-1.5 text-xs text-gray-500">({{ ratingCounts[6 - n] || 0 }})</span>
            </li>
          </ul>
        </div>

        <!-- Search -->
        <div class="ml-1 sm:ml-4 h-7.5 w-40 sm:w-52">
          <input v-model="searchQuery" type="text" class="w-full h-full bg-primary/60 border border-gray-500 hover:border-gray-400 rounded-sm px-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400" :placeholder="$strings.PlaceholderSearchReviews" />
        </div>
      </div>
    </div>

    <div class="w-full overflow-y-auto px-2 md:px-8 py-4 pb-32" style="height: calc(100% - 40px)">
      <div v-if="loading" class="flex justify-center py-20">
        <widgets-loading-spinner />
      </div>

      <div v-else-if="!filteredReviews.length" class="text-center py-20 text-gray-400 italic">
        <p class="text-xl mb-2">{{ $strings.LabelNoReviews }}</p>
        <p v-if="!searchQuery && !selectedUserFilter && !selectedRatingFilter">{{ $strings.MessageGoRateBooks }}</p>
      </div>

      <div v-else class="flex flex-col gap-px">
        <!-- Review Rows -->
        <div v-for="review in filteredReviews" :key="review.id" class="flex items-start bg-primary/20 hover:bg-primary/40 transition-colors border-b border-white/5 py-2 px-2 md:px-4 gap-3">
          <!-- Cover -->
          <div class="w-10 flex-shrink-0 cursor-pointer" @click="goToItem(review.libraryItem)">
            <covers-book-cover v-if="review.libraryItem" :library-item="review.libraryItem" :width="40" />
          </div>

          <!-- Main content -->
          <div class="flex-grow min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <nuxt-link :to="`/item/${review.libraryItemId}`" class="text-sm font-semibold truncate hover:underline text-gray-100 leading-tight">
                {{ getTitle(review) }}
              </nuxt-link>
              <span class="text-[11px] text-gray-500">by {{ getAuthor(review) }}</span>
            </div>

            <!-- Review text inline -->
            <p v-if="review.reviewText" class="text-xs text-gray-400 italic mt-0.5 line-clamp-1 hover:line-clamp-none cursor-default transition-all duration-200">
              "{{ review.reviewText }}"
            </p>
          </div>

          <!-- Stars -->
          <div class="flex-shrink-0 flex items-center">
            <ui-star-rating :value="review.rating" readonly :size="14" />
          </div>

          <!-- Username -->
          <div class="hidden md:block flex-shrink-0 w-24 text-xs text-gray-400 truncate text-right">
            {{ review.user ? review.user.username : 'Unknown' }}
          </div>

          <!-- Date -->
          <div class="hidden md:block flex-shrink-0 w-20 text-[10px] text-gray-500 text-right leading-tight">
            {{ $formatDate(review.createdAt, dateFormat) }}
          </div>

          <!-- Edit button -->
          <div class="flex-shrink-0 w-7">
            <button v-if="isReviewAuthor(review)" class="p-0.5 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200" @click.stop="editReview(review)">
              <span class="material-symbols text-base">edit</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalReviews > limit" class="mt-6 flex justify-center gap-4 items-center pb-8">
        <ui-btn small :disabled="page === 0" @click="changePage(page - 1)">
          <span class="material-symbols">chevron_left</span>
        </ui-btn>
        <span class="text-sm text-gray-400">{{ page + 1 }} / {{ Math.ceil(totalReviews / limit) }}</span>
        <ui-btn small :disabled="page >= Math.ceil(totalReviews / limit) - 1" @click="changePage(page + 1)">
          <span class="material-symbols">chevron_right</span>
        </ui-btn>
      </div>
    </div>
    
    <modals-review-modal @review-updated="fetchReviews" />
  </div>
</template>

<script>
export default {
  asyncData({ params, redirect, store }) {
    if (!store.state.user.user) {
      return redirect(`/login?redirect=/library/${params.library}/ratings`)
    }
  },
  data() {
    return {
      reviews: [],
      reviewers: [],
      ratingCounts: {},
      totalReviews: 0,
      loading: true,
      selectedSort: 'newest',
      sortDesc: true,
      selectedUserFilter: null,
      selectedRatingFilter: null,
      searchQuery: '',
      page: 0,
      limit: 50,
      showUserMenu: false,
      showRatingMenu: false
    }
  },
  computed: {
    libraryId() {
      return this.$route.params.library
    },
    dateFormat() {
      return this.$store.getters['getServerSetting']('dateFormat')
    },
    currentUser() {
      return this.$store.state.user.user
    },
    sortItems() {
      return [
        { value: 'newest', text: this.$strings.LabelSortNewestFirst },
        { value: 'oldest', text: this.$strings.LabelSortOldestFirst },
        { value: 'highest', text: this.$strings.LabelSortHighestRated },
        { value: 'lowest', text: this.$strings.LabelSortLowestRated }
      ]
    },
    selectedUserText() {
      if (!this.selectedUserFilter) return this.$strings.LabelFilterByUser
      const u = this.reviewers.find((r) => r.id === this.selectedUserFilter)
      return u ? u.username : this.$strings.LabelFilterByUser
    },
    selectedRatingText() {
      if (!this.selectedRatingFilter) return this.$strings.LabelFilterByRating
      return `${this.selectedRatingFilter} ★`
    },
    filteredReviews() {
      if (!this.searchQuery) return this.reviews
      const q = this.searchQuery.toLowerCase()
      return this.reviews.filter((r) => {
        const title = this.getTitle(r).toLowerCase()
        const author = this.getAuthor(r).toLowerCase()
        return title.includes(q) || author.includes(q)
      })
    }
  },
  methods: {
    closeUserMenu() {
      this.showUserMenu = false
    },
    closeRatingMenu() {
      this.showRatingMenu = false
    },
    async fetchReviews() {
      this.loading = true
      try {
        const params = {
          sort: this.selectedSort,
          limit: this.limit,
          page: this.page
        }
        if (this.selectedUserFilter) {
          params.filter = `user.${this.selectedUserFilter}`
        } else if (this.selectedRatingFilter) {
          params.filter = `rating.${this.selectedRatingFilter}`
        }

        const data = await this.$axios.$get(`/api/libraries/${this.libraryId}/reviews`, { params })
        this.reviews = data.reviews || []
        this.totalReviews = data.total || 0
        if (data.reviewers) {
          this.reviewers = data.reviewers
        }
        if (data.ratingCounts) {
          this.ratingCounts = data.ratingCounts
        }
      } catch (error) {
        console.error('Failed to fetch library reviews', error)
        this.$toast.error('Failed to fetch reviews')
      } finally {
        this.loading = false
      }
    },
    onSortChange(val) {
      this.selectedSort = val
      this.page = 0
      this.fetchReviews()
    },
    setUserFilter(val) {
      this.selectedUserFilter = val
      this.selectedRatingFilter = null
      this.showUserMenu = false
      this.page = 0
      this.fetchReviews()
    },
    setRatingFilter(val) {
      this.selectedRatingFilter = val
      this.selectedUserFilter = null
      this.showRatingMenu = false
      this.page = 0
      this.fetchReviews()
    },
    changePage(newPage) {
      this.page = newPage
      this.fetchReviews()
    },
    getTitle(review) {
      return review.libraryItem?.media?.metadata?.title || 'Unknown Title'
    },
    getAuthor(review) {
      return review.libraryItem?.media?.metadata?.authorName || 'Unknown Author'
    },
    goToItem(item) {
      if (item) this.$router.push(`/item/${item.id}`)
    },
    isReviewAuthor(review) {
      return review.userId === this.currentUser.id
    },
    editReview(review) {
      this.$store.commit('globals/setReviewModal', {
        libraryItem: review.libraryItem,
        review: review
      })
    }
  },
  mounted() {
    this.fetchReviews()
  }
}
</script>

<style>
#ratings-toolbar {
  box-shadow: 0px 8px 6px #111111aa;
}
</style>
