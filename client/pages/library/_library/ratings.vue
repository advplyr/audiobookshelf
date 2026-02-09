<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden">
    <div class="w-full h-full overflow-y-auto px-4 py-6 md:p-8">
      <div class="max-w-5xl mx-auto">
        <div class="flex items-center mb-8">
          <span class="material-symbols text-4xl text-yellow-400 mr-4">star</span>
          <h1 class="text-3xl font-semibold">{{ $strings.ButtonRatings }}</h1>
        </div>

        <div v-if="loading" class="flex justify-center py-20">
          <widgets-loading-spinner />
        </div>

        <div v-else-if="!reviews.length" class="text-center py-20 text-gray-400 italic">
          <p class="text-xl mb-2">{{ $strings.LabelNoReviews }}</p>
          <p>{{ $strings.MessageGoRateBooks }}</p>
        </div>

        <div v-else class="grid grid-cols-1 gap-6">
          <div v-for="review in reviews" :key="review.id" class="bg-primary/40 rounded-xl overflow-hidden flex flex-col md:flex-row hover:bg-primary/60 transition-colors border border-white/5">
            <div class="w-full md:w-32 h-48 md:h-auto flex-shrink-0 relative group cursor-pointer" @click="goToItem(review.libraryItem)">
              <covers-book-cover :library-item="review.libraryItem" :width="128" />
            </div>
            
            <div class="p-6 flex-grow flex flex-col">
              <div class="flex flex-col md:flex-row md:items-start justify-between mb-4 gap-2">
                <div>
                  <nuxt-link :to="`/item/${review.libraryItemId}`" class="text-xl font-semibold hover:underline text-gray-100">
                    {{ review.libraryItem.media.metadata.title }}
                  </nuxt-link>
                  <p class="text-gray-400 text-sm">
                    {{ review.libraryItem.media.metadata.authorName }}
                  </p>
                </div>
                <div class="flex flex-col items-end">
                  <ui-star-rating :value="review.rating" readonly :size="20" />
                  <p class="text-xs text-gray-500 mt-1">{{ $formatDate(review.createdAt, dateFormat) }}</p>
                </div>
              </div>

              <p v-if="review.reviewText" class="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap flex-grow italic bg-black/20 p-4 rounded-lg border border-white/5">
                "{{ review.reviewText }}"
              </p>

              <div class="mt-4 flex justify-end">
                <ui-btn small outlined @click="editReview(review)">
                  {{ $strings.ButtonEdit }}
                </ui-btn>
              </div>
            </div>
          </div>
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
      loading: true
    }
  },
  computed: {
    libraryId() {
      return this.$route.params.library
    },
    dateFormat() {
      return this.$store.getters['getServerSetting']('dateFormat')
    }
  },
  methods: {
    async fetchReviews() {
      this.loading = true
      try {
        const reviews = await this.$axios.$get('/api/me/reviews')
        // Filter by current library
        this.reviews = reviews.filter((r) => r.libraryItem && r.libraryItem.libraryId === this.libraryId)
      } catch (error) {
        console.error('Failed to fetch user reviews', error)
        this.$toast.error('Failed to fetch reviews')
      } finally {
        this.loading = false
      }
    },
    goToItem(item) {
      this.$router.push(`/item/${item.id}`)
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
