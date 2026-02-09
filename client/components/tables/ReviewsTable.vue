<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-4 md:px-6 py-2 flex items-center cursor-pointer" @click.stop="clickBar">
      <p class="pr-2 md:pr-4">{{ $strings.LabelReviews }}</p>
      
      <div v-if="averageRating" class="flex items-center">
        <ui-star-rating :value="averageRating" readonly :size="18" />
        <span class="text-sm text-gray-300 ml-2">({{ averageRating.toFixed(1) }})</span>
      </div>

      <div class="grow" />

      <ui-btn small :color="userReview ? '' : 'bg-success'" class="mr-4" @click.stop="writeReview">
        {{ userReview ? $strings.ButtonReviewEdit : $strings.ButtonReviewWrite }}
      </ui-btn>

      <div class="cursor-pointer h-10 w-10 rounded-full hover:bg-black-400 flex justify-center items-center duration-500" :class="showReviews ? 'transform rotate-180' : ''">
        <span class="material-symbols text-4xl">&#xe313;</span>
      </div>
    </div>

    <transition name="slide">
      <div class="w-full bg-bg/20" v-show="showReviews">
        <div v-if="!reviews.length" class="p-6 text-center text-gray-400 italic">
          {{ $strings.LabelNoReviews }}
        </div>
        <div v-else class="divide-y divide-white/5">
          <div v-for="review in reviews" :key="review.id" class="p-4 md:p-6">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center">
                <p class="font-semibold text-gray-100 mr-3">{{ review.user.username }}</p>
                <ui-star-rating :value="review.rating" readonly :size="16" />
              </div>
              <p class="text-xs text-gray-400">{{ $formatDate(review.createdAt, dateFormat) }}</p>
            </div>
            <p v-if="review.reviewText" class="text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">{{ review.reviewText }}</p>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      showReviews: false,
      reviews: [],
      loading: false
    }
  },
  computed: {
    user() {
      return this.$store.state.user.user
    },
    userReview() {
      return this.reviews.find((r) => r.userId === this.user.id)
    },
    averageRating() {
      if (!this.reviews.length) return 0
      const sum = this.reviews.reduce((acc, r) => acc + r.rating, 0)
      return sum / this.reviews.length
    },
    dateFormat() {
      return this.$store.getters['getServerSetting']('dateFormat')
    }
  },
  methods: {
    clickBar() {
      this.showReviews = !this.showReviews
    },
    async fetchReviews() {
      this.loading = true
      try {
        this.reviews = await this.$axios.$get(`/api/items/${this.libraryItem.id}/reviews`)
      } catch (error) {
        console.error('Failed to fetch reviews', error)
      } finally {
        this.loading = false
      }
    },
    writeReview() {
      this.$store.commit('globals/setReviewModal', {
        libraryItem: this.libraryItem,
        review: this.userReview
      })
    },
    onReviewUpdated(review) {
      const index = this.reviews.findIndex((r) => r.id === review.id)
      if (index !== -1) {
        this.$set(this.reviews, index, review)
      } else {
        this.reviews.unshift(review)
      }
    }
  },
  mounted() {
    this.fetchReviews()
    this.$root.$on('review-updated', (review) => {
      if (review.libraryItemId === this.libraryItem.id) {
        this.onReviewUpdated(review)
      }
    })
  },
  beforeDestroy() {
    this.$root.$off('review-updated')
  }
}
</script>
