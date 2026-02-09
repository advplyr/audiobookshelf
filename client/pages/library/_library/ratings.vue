<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden">
    <!-- Toolbar -->
    <div class="w-full bg-primary border-b border-black-300 px-4 py-2 flex items-center gap-4 flex-wrap z-10">
      <div class="flex items-center gap-2 mr-4">
        <span class="material-symbols text-2xl text-yellow-400">star</span>
        <h1 class="text-xl font-semibold whitespace-nowrap">{{ $strings.ButtonRatings }}</h1>
      </div>

      <!-- Sort Dropdown -->
      <ui-dropdown :value="selectedSort" :items="sortItems" small outlined label-key="label" class="w-48" @input="onSortInput" />

      <!-- Filter by User -->
      <ui-dropdown :value="selectedUserFilter" :items="userFilterItems" small outlined label-key="label" class="w-48" @input="onUserFilterInput" />

      <!-- Filter by Rating -->
      <ui-dropdown :value="selectedRatingFilter" :items="ratingFilterItems" small outlined label-key="label" class="w-32" @input="onRatingFilterInput" />

      <!-- Search -->
      <div class="flex-grow max-w-sm ml-auto">
        <ui-text-input v-model="searchQuery" small :placeholder="$strings.PlaceholderSearchReviews" clearable />
      </div>
    </div>

    <div class="w-full h-full overflow-y-auto px-4 py-6 md:p-8 pb-32">
      <div class="max-w-6xl mx-auto">
        <div v-if="loading" class="flex justify-center py-20">
          <widgets-loading-spinner />
        </div>

        <div v-else-if="!reviews.length" class="text-center py-20 text-gray-400 italic">
          <p class="text-xl mb-2">{{ $strings.LabelNoReviews }}</p>
          <p v-if="!searchQuery && !selectedUserFilter && !selectedRatingFilter">{{ $strings.MessageGoRateBooks }}</p>
        </div>

        <div v-else class="flex flex-col gap-2">
          <!-- Table Header -->
          <div class="hidden md:flex items-center px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-white/5">
            <div class="w-12"></div> <!-- Cover -->
            <div class="flex-grow px-4">{{ $strings.LabelBook }}</div>
            <div class="w-32 px-4">{{ $strings.LabelUser }}</div>
            <div class="w-32 px-4 text-center">{{ $strings.LabelRating }}</div>
            <div class="w-24 text-right">{{ $strings.LabelDate }}</div>
            <div class="w-10"></div> <!-- Actions -->
          </div>

          <!-- Review Rows -->
          <div v-for="review in filteredReviews" :key="review.id" class="bg-primary/20 rounded-lg hover:bg-primary/40 transition-colors border border-white/5 overflow-hidden">
            <div class="flex items-center p-2 md:p-3 gap-4">
              <!-- Cover -->
              <div class="w-12 h-18 flex-shrink-0 cursor-pointer" @click="goToItem(review.libraryItem)">
                <covers-book-cover :library-item="review.libraryItem" :width="48" />
              </div>

              <!-- Title/Author -->
              <div class="flex-grow min-w-0">
                <nuxt-link :to="`/item/${review.libraryItemId}`" class="font-semibold truncate block hover:underline text-gray-100">
                  {{ getTitle(review) }}
                </nuxt-link>
                <p class="text-xs text-gray-400 truncate">{{ getAuthor(review) }}</p>
              </div>

              <!-- Username -->
              <div class="hidden md:block w-32 px-4 truncate text-sm text-gray-300">
                {{ review.user ? review.user.username : 'Unknown' }}
              </div>

              <!-- Rating -->
              <div class="w-32 flex flex-col items-center flex-shrink-0">
                <ui-star-rating :value="review.rating" readonly :size="16" />
              </div>

              <!-- Date (Desktop) -->
              <div class="hidden md:block w-24 text-right text-xs text-gray-500">
                {{ $formatDate(review.createdAt, dateFormat) }}
              </div>

              <!-- Actions -->
              <div class="w-10 flex justify-end">
                <ui-btn v-if="isReviewAuthor(review)" icon small flat @click.stop="editReview(review)">
                  <span class="material-symbols text-lg">edit</span>
                </ui-btn>
              </div>
            </div>

            <!-- Review Text (if exists) -->
            <div v-if="review.reviewText" class="px-4 md:px-16 pb-3 pt-1">
              <div class="text-sm text-gray-300 italic bg-black/20 p-3 rounded border border-white/5 relative group">
                <span class="line-clamp-2 group-hover:line-clamp-none transition-all duration-300 whitespace-pre-wrap">
                  "{{ review.reviewText }}"
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalReviews > limit" class="mt-8 flex justify-center gap-4 items-center pb-8">
          <ui-btn small :disabled="page === 0" @click="changePage(page - 1)">
            <span class="material-symbols">chevron_left</span>
          </ui-btn>
          <span class="text-sm text-gray-400">Page {{ page + 1 }} of {{ Math.ceil(totalReviews / limit) }}</span>
          <ui-btn small :disabled="page >= Math.ceil(totalReviews / limit) - 1" @click="changePage(page + 1)">
            <span class="material-symbols">chevron_right</span>
          </ui-btn>
        </div>
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
      totalReviews: 0,
      loading: true,
      selectedSort: 'newest',
      selectedUserFilter: null,
      selectedRatingFilter: null,
      searchQuery: '',
      page: 0,
      limit: 50,
      users: []
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
        { value: 'newest', label: this.$strings.LabelSortNewestFirst },
        { value: 'oldest', label: this.$strings.LabelSortOldestFirst },
        { value: 'highest', label: this.$strings.LabelSortHighestRated },
        { value: 'lowest', label: this.$strings.LabelSortLowestRated }
      ]
    },
    userFilterItems() {
      const items = [{ value: null, label: this.$strings.LabelAllUsers }]
      this.users.forEach((u) => {
        items.push({ value: u.id, label: u.username })
      })
      return items
    },
    ratingFilterItems() {
      const items = [{ value: null, label: this.$strings.LabelAllReviews }]
      for (let i = 5; i >= 1; i--) {
        items.push({ value: i, label: `${i} ${i === 1 ? 'Star' : 'Stars'}` })
      }
      return items
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
    async fetchUsers() {
      if (!this.currentUser.isAdminOrUp) return
      try {
        const data = await this.$axios.$get('/api/users')
        this.users = data.users || []
      } catch (error) {
        console.error('Failed to fetch users', error)
      }
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
        this.reviews = data.reviews
        this.totalReviews = data.total
      } catch (error) {
        console.error('Failed to fetch library reviews', error)
        this.$toast.error('Failed to fetch reviews')
      } finally {
        this.loading = false
      }
    },
    onSortInput(val) {
      this.selectedSort = val
      this.page = 0
      this.fetchReviews()
    },
    onUserFilterInput(val) {
      this.selectedUserFilter = val
      this.selectedRatingFilter = null
      this.page = 0
      this.fetchReviews()
    },
    onRatingFilterInput(val) {
      this.selectedRatingFilter = val
      this.selectedUserFilter = null
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
    this.fetchUsers()
    this.fetchReviews()
  }
}
</script>
