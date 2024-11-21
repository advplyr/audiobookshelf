<template>
  <modals-modal v-model="show" name="podcast-episode-remove-modal" :width="500" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div ref="wrapper" class="px-8 py-6 w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
      <div class="mb-4">
        <p v-if="episode" class="text-lg text-gray-200 mb-4">
          {{ $getString('MessageConfirmRemoveEpisode', [episodeTitle]) }}
        </p>
        <p v-else class="text-lg text-gray-200 mb-4">{{ $getString('MessageConfirmRemoveEpisodes', [episodes.length]) }}</p>
        <p class="text-xs font-semibold text-warning text-opacity-90">Note: This does not delete the audio file unless toggling "Hard delete file"</p>
      </div>
      <div class="flex justify-between items-center pt-4">
        <ui-checkbox v-model="hardDeleteFile" :label="$strings.LabelHardDeleteFile" check-color="error" checkbox-bg="bg" small label-class="text-base text-gray-200 pl-3" />

        <ui-btn @click="submit">{{ btnText }}</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    libraryItem: {
      type: Object,
      default: () => {}
    },
    episodes: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      hardDeleteFile: false,
      processing: false
    }
  },
  watch: {
    value(newVal) {
      if (newVal) this.hardDeleteFile = false
    }
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    episode() {
      if (this.episodes.length === 1) return this.episodes[0]
      return null
    },
    title() {
      if (this.episodes.length > 1) return this.$getString('HeaderRemoveEpisodes', [this.episodes.length])
      return this.$strings.HeaderRemoveEpisode
    },
    btnText() {
      return this.hardDeleteFile ? this.$strings.ButtonDelete : this.$strings.ButtonRemove
    },
    episodeTitle() {
      return this.episode ? this.episode.title : null
    }
  },
  methods: {
    async submit() {
      this.processing = true

      var queryString = this.hardDeleteFile ? '?hard=1' : ''
      for (const episode of this.episodes) {
        const success = await this.$axios
          .$delete(`/api/podcasts/${this.libraryItem.id}/episode/${episode.id}${queryString}`)
          .then(() => true)
          .catch((error) => {
            var errorMsg = error.response && error.response.data ? error.response.data : 'Failed to remove episode'
            console.error('Failed to remove episode', error)
            this.$toast.error(errorMsg)
            return false
          })
        if (!success) {
          this.processing = false
          this.show = false
          this.$emit('clearSelected')
          return
        }
      }

      this.processing = false
      this.$toast.success(`${this.episodes.length} episode${this.episodes.length > 1 ? 's' : ''} removed`)
      this.show = false
      this.$emit('clearSelected')
    }
  },
  mounted() {}
}
</script>
