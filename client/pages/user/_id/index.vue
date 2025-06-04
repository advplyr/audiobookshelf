<template>
  <div class="bg-bg min-h-screen">
    <div class="max-w-6xl mx-auto px-4 py-8">
      <div v-if="user" class="mb-8">
        <h1 class="text-3xl font-semibold mb-2">{{ user.username }}'s Profile</h1>
        <p class="text-gray-400">Member since {{ formatDate(user.createdAt) }}</p>
      </div>

      <div v-if="reviews.length" class="space-y-6">
        <h2 class="text-2xl font-semibold mb-4">Reviews</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div v-for="review in reviews" :key="review.id" class="bg-primary rounded-lg overflow-hidden shadow-lg flex flex-col">
            <nuxt-link :to="'/item/' + review.libraryItemId" class="block flex-shrink-0" style="height: 280px">
              <div class="relative h-full w-full flex items-center justify-center">
                <covers-book-cover v-if="review.libraryItem" :library-item="review.libraryItem" :width="180" :book-cover-aspect-ratio="bookCoverAspectRatio" class="hover:scale-105 transition-transform duration-200" />
                <div v-else class="absolute inset-0 bg-gray-700 flex items-center justify-center">
                  <span class="material-symbols text-4xl text-gray-400">book</span>
                </div>
              </div>
            </nuxt-link>

            <div class="p-4 flex-grow">
              <nuxt-link :to="'/item/' + review.libraryItemId" class="block">
                <h3 class="text-lg font-semibold mb-2 hover:text-white transition-colors line-clamp-1">{{ review.libraryItem?.title || 'Unknown Book' }}</h3>
              </nuxt-link>

              <div class="flex mb-3">
                <span v-for="star in 5" :key="star" class="abs-icons icon-star" :class="star <= review.rating ? 'text-yellow-500' : 'text-gray-500'"></span>
              </div>

              <p class="text-gray-300 text-sm mb-2 line-clamp-3">{{ review.text }}</p>
              <p class="text-gray-400 text-xs">{{ formatDate(review.createdAt) }}</p>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="user" class="text-gray-400">{{ user.username }} hasn't written any reviews yet.</div>
      <div v-else class="text-gray-400">Loading...</div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      user: null,
      reviews: []
    }
  },
  computed: {
    userToken() {
      return this.$store.getters['user/getToken']
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    }
  },
  methods: {
    formatDate(date) {
      return new Date(date).toLocaleDateString()
    },
    async loadUser() {
      try {
        this.user = await this.$axios.$get('/api/users/' + this.$route.params.id)
      } catch (error) {
        console.error('Error loading user:', error)
        this.$toast.error('Error loading user profile')
      }
    },
    async loadReviews() {
      try {
        const reviews = await this.$axios.$get('/api/users/' + this.$route.params.id + '/reviews')
        console.log('Raw reviews data:', JSON.stringify(reviews, null, 2))
        this.reviews = reviews
      } catch (error) {
        console.error('Error loading reviews:', error)
        this.$toast.error('Error loading reviews')
      }
    }
  },
  async mounted() {
    await this.loadUser()
    await this.loadReviews()
  }
}
</script>

<style>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style> 