<template>
  <div class="w-full h-full">
    <div class="flex">
      <cards-book-cover :audiobook="audiobook" />
      <div class="flex-grow px-8">
        <form @submit.prevent="submitForm">
          <div class="flex items-center">
            <ui-text-input-with-label v-model="imageUrl" label="Cover Image URL" />
            <ui-btn color="success" type="submit" :padding-x="4" class="mt-5 ml-4">Update</ui-btn>
          </div>
        </form>
      </div>
    </div>
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
      imageUrl: null
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
    book() {
      return this.audiobook ? this.audiobook.book || {} : {}
    }
  },
  methods: {
    init() {
      this.imageUrl = this.book.cover || ''
    },
    async submitForm() {
      console.log('Submit form', this.details)
      this.isProcessing = true
      const updatePayload = {
        book: {
          cover: this.imageUrl
        }
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
    }
  }
}
</script>