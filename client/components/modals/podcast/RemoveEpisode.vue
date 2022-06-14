<template>
  <modals-modal v-model="show" name="podcast-episode-remove-modal" :width="500" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div ref="wrapper" class="px-8 py-6 w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
      <div class="mb-4">
        <p class="text-lg text-gray-200 mb-4">
          Are you sure you want to remove episode<br /><span class="text-base">{{ episodeTitle }}</span
          >?
        </p>
        <p class="text-xs font-semibold text-warning text-opacity-90">Note: This does not delete the audio file unless toggling "Hard delete file"</p>
      </div>
      <div class="flex justify-between items-center pt-4">
        <ui-checkbox v-model="hardDeleteFile" label="Hard delete file" check-color="error" checkbox-bg="bg" small label-class="text-base text-gray-200 pl-3" />

        <ui-btn @click="submit">{{ hardDeleteFile ? 'Delete episode' : 'Remove episode' }}</ui-btn>
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
    episode: {
      type: Object,
      default: () => {}
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
    title() {
      return 'Remove Episode'
    },
    episodeId() {
      return this.episode ? this.episode.id : null
    },
    episodeTitle() {
      return this.episode ? this.episode.title : null
    }
  },
  methods: {
    submit() {
      this.processing = true

      var queryString = this.hardDeleteFile ? '?hard=1' : ''
      this.$axios
        .$delete(`/api/podcasts/${this.libraryItem.id}/episode/${this.episodeId}${queryString}`)
        .then(() => {
          this.processing = false
          this.$toast.success('Podcast episode removed')
          this.show = false
        })
        .catch((error) => {
          var errorMsg = error.response && error.response.data ? error.response.data : 'Failed remove episode'
          console.error('Failed update episode', error)
          this.processing = false
          this.$toast.error(errorMsg)
        })
    }
  },
  mounted() {}
}
</script>
