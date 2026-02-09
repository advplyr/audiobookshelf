<template>
  <modals-modal v-model="show" name="review-modal" :width="500">
    <div class="px-6 py-8 w-full rounded-lg bg-bg shadow-lg border border-black-300" style="max-height: 80vh">
      <h2 class="text-xl font-semibold mb-4">{{ title }}</h2>
      
      <div class="mb-6">
        <p class="text-gray-200 mb-2">{{ $strings.LabelRating }}</p>
        <ui-star-rating v-model="rating" :size="40" />
      </div>

      <div class="mb-6">
        <label for="review-text" class="block text-gray-200 mb-2">{{ $strings.LabelReviewComment }}</label>
        <textarea
          id="review-text"
          v-model="reviewText"
          class="w-full bg-primary border border-gray-600 rounded-md p-2 text-white focus:outline-hidden focus:border-yellow-400"
          rows="5"
          maxlength="5000"
          :placeholder="$strings.PlaceholderReviewWrite"
        ></textarea>
        <p class="text-right text-xs text-gray-400 mt-1">{{ reviewText.length }}/5000</p>
      </div>

      <div class="flex justify-end gap-2">
        <ui-btn @click="show = false">{{ $strings.ButtonCancel }}</ui-btn>
        <ui-btn color="bg-success" :loading="processing" @click="submit">{{ $strings.ButtonSubmit }}</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      rating: 0,
      reviewText: '',
      processing: false
    }
  },
  watch: {
    show(val) {
      if (val) {
        if (this.selectedReviewItem?.review) {
          this.rating = this.selectedReviewItem.review.rating
          this.reviewText = this.selectedReviewItem.review.reviewText || ''
        } else {
          this.rating = 0
          this.reviewText = ''
        }
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showReviewModal
      },
      set(val) {
        this.$store.commit('globals/setShowReviewModal', val)
      }
    },
    selectedReviewItem() {
      return this.$store.state.globals.selectedReviewItem
    },
    libraryItem() {
      return this.selectedReviewItem?.libraryItem
    },
    title() {
      return this.selectedReviewItem?.review ? this.$strings.ButtonReviewEdit : this.$strings.ButtonReviewWrite
    }
  },
  methods: {
    async submit() {
      if (!this.rating) {
        this.$toast.error('Please select a rating')
        return
      }

      this.processing = true
      try {
        const payload = {
          rating: this.rating,
          reviewText: this.reviewText
        }
        const review = await this.$axios.$post(`/api/items/${this.libraryItem.id}/review`, payload)
        this.$emit('review-updated', review)
        this.$toast.success('Review submitted')
        this.show = false
      } catch (error) {
        console.error('Failed to submit review', error)
        this.$toast.error('Failed to submit review')
      } finally {
        this.processing = false
      }
    }
  }
}
</script>
