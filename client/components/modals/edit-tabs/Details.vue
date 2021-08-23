<template>
  <div class="w-full h-full overflow-hidden overflow-y-auto px-1">
    <div v-if="userProgress" class="bg-success bg-opacity-40 rounded-md w-full px-4 py-1 mb-4 border border-success border-opacity-50">
      <div class="w-full flex items-center">
        <p>
          Your progress: <span class="font-mono text-lg">{{ (userProgress * 100).toFixed(0) }}%</span>
        </p>
        <div class="flex-grow" />
        <ui-btn v-if="!resettingProgress" small :padding-x="2" class="-mr-3" @click="resetProgress">Reset</ui-btn>
      </div>
    </div>
    <form @submit.prevent="submitForm">
      <ui-text-input-with-label v-model="details.title" label="Title" />

      <div class="flex mt-2 -mx-1">
        <div class="w-3/4 px-1">
          <ui-text-input-with-label v-model="details.author" label="Author" />
        </div>
        <div class="flex-grow px-1">
          <ui-text-input-with-label v-model="details.publishYear" type="number" label="Publish Year" />
        </div>
      </div>

      <!-- <ui-text-input-with-label v-model="details.series" label="Series" class="mt-2" /> -->

      <ui-input-dropdown v-model="details.series" label="Series" class="mt-2" :items="series" />

      <ui-textarea-with-label v-model="details.description" :rows="3" label="Description" class="mt-2" />

      <div class="flex mt-2 -mx-1">
        <div class="w-1/2 px-1">
          <ui-multi-select v-model="details.genres" label="Genres" :items="genres" />
        </div>
        <div class="flex-grow px-1">
          <ui-multi-select v-model="newTags" label="Tags" :items="tags" />
        </div>
      </div>

      <div class="flex py-4">
        <ui-btn color="error" type="button" small @click.stop.prevent="deleteAudiobook">Remove</ui-btn>
        <div class="flex-grow" />
        <ui-btn type="submit">Submit</ui-btn>
      </div>
    </form>
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean,
    audiobook: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      details: {
        title: null,
        description: null,
        author: null,
        series: null,
        publishYear: null,
        genres: []
      },
      newTags: [],
      resettingProgress: false
    }
  },
  watch: {
    audiobook: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
    }
  },
  computed: {
    isProcessing: {
      get() {
        return this.processing
      },
      set(val) {
        this.$emit('update:processing', val)
      }
    },
    audiobookId() {
      return this.audiobook ? this.audiobook.id : null
    },
    book() {
      return this.audiobook ? this.audiobook.book || {} : {}
    },
    userAudiobook() {
      return this.$store.getters['user/getUserAudiobook'](this.audiobookId)
    },
    userProgress() {
      return this.userAudiobook ? this.userAudiobook.progress : 0
    },
    genres() {
      return this.$store.state.audiobooks.genres
    },
    tags() {
      return this.$store.state.audiobooks.tags
    },
    series() {
      return this.$store.state.audiobooks.series
    }
  },
  methods: {
    async submitForm() {
      this.isProcessing = true
      const updatePayload = {
        book: this.details,
        tags: this.newTags
      }

      var updatedAudiobook = await this.$axios.$patch(`/api/audiobook/${this.audiobook.id}`, updatePayload).catch((error) => {
        console.error('Failed to update', error)
        return false
      })
      this.isProcessing = false
      if (updatedAudiobook) {
        console.log('Update Successful', updatedAudiobook)
        this.$toast.success('Update Successful')
        this.$emit('close')
      }
    },
    init() {
      this.details.title = this.book.title
      this.details.description = this.book.description
      this.details.author = this.book.author
      this.details.genres = this.book.genres || []
      this.details.series = this.book.series
      this.details.publishYear = this.book.publishYear

      this.newTags = this.audiobook.tags || []
    },
    resetProgress() {
      if (confirm(`Are you sure you want to reset your progress?`)) {
        this.resettingProgress = true
        this.$axios
          .$delete(`/api/user/audiobook/${this.audiobookId}`)
          .then(() => {
            console.log('Progress reset complete')
            this.$toast.success(`Your progress was reset`)
            this.resettingProgress = false
          })
          .catch((error) => {
            console.error('Progress reset failed', error)
            this.resettingProgress = false
          })
      }
    },
    deleteAudiobook() {
      if (confirm(`Are you sure you want to remove this audiobook?`)) {
        this.isProcessing = true
        this.$axios
          .$delete(`/api/audiobook/${this.audiobookId}`)
          .then(() => {
            console.log('Audiobook removed')
            this.$toast.success('Audiobook Removed')
            this.$emit('close')
            this.isProcessing = false
          })
          .catch((error) => {
            console.error('Remove Audiobook failed', error)
            this.isProcessing = false
          })
      }
    }
  }
}
</script>