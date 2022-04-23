<template>
  <modals-modal v-model="show" name="podcast-episode-edit-modal" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div ref="wrapper" class="p-4 w-full text-sm py-2 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
      <div class="flex flex-wrap">
        <div class="w-1/3 p-1">
          <ui-text-input-with-label v-model="newEpisode.episode" label="Episode" />
        </div>
        <div class="w-1/3 p-1">
          <ui-text-input-with-label v-model="newEpisode.episodeType" label="Episode Type" />
        </div>
        <div class="w-1/3 p-1">
          <ui-text-input-with-label v-model="pubDateInput" @input="updatePubDate" type="datetime-local" label="Pub Date" />
        </div>
        <div class="w-full p-1">
          <ui-text-input-with-label v-model="newEpisode.title" label="Title" />
        </div>
        <div class="w-full p-1">
          <ui-textarea-with-label v-model="newEpisode.subtitle" label="Subtitle" :rows="3" />
        </div>
        <div class="w-full p-1">
          <ui-textarea-with-label v-model="newEpisode.description" label="Description" :rows="8" />
        </div>
      </div>
      <div class="flex justify-end pt-4">
        <ui-btn @click="submit">Submit</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false,
      newEpisode: {
        episode: null,
        episodeType: null,
        title: null,
        subtitle: null,
        description: null,
        pubDate: null,
        publishedAt: null
      },
      pubDateInput: null
    }
  },
  watch: {
    episode: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showEditPodcastEpisode
      },
      set(val) {
        this.$store.commit('globals/setShowEditPodcastEpisodeModal', val)
      }
    },
    libraryItem() {
      return this.$store.state.selectedLibraryItem
    },
    episode() {
      return this.$store.state.globals.selectedEpisode
    },
    episodeId() {
      return this.episode ? this.episode.id : null
    },
    title() {
      if (!this.libraryItem) return ''
      return this.libraryItem.media.metadata.title || 'Unknown'
    }
  },
  methods: {
    updatePubDate(val) {
      if (val) {
        this.newEpisode.pubDate = this.$formatJsDate(new Date(val), 'E, d MMM yyyy HH:mm:ssxx')
        this.newEpisode.publishedAt = new Date(val).valueOf()
      } else {
        this.newEpisode.pubDate = null
        this.newEpisode.publishedAt = null
      }
    },
    init() {
      this.newEpisode.episode = this.episode.episode || ''
      this.newEpisode.episodeType = this.episode.episodeType || ''
      this.newEpisode.title = this.episode.title || ''
      this.newEpisode.subtitle = this.episode.subtitle || ''
      this.newEpisode.description = this.episode.description || ''
      this.newEpisode.pubDate = this.episode.pubDate || ''
      this.newEpisode.publishedAt = this.episode.publishedAt

      this.pubDateInput = this.episode.pubDate ? this.$formatJsDate(new Date(this.episode.pubDate), "yyyy-MM-dd'T'HH:mm") : null
    },
    getUpdatePayload() {
      var updatePayload = {}
      for (const key in this.newEpisode) {
        if (this.newEpisode[key] != this.episode[key]) {
          updatePayload[key] = this.newEpisode[key]
        }
      }
      return updatePayload
    },
    submit() {
      const payload = this.getUpdatePayload()
      if (!Object.keys(payload).length) {
        return this.$toast.info('No updates were made')
      }

      this.processing = true
      this.$axios
        .$patch(`/api/podcasts/${this.libraryItem.id}/episode/${this.episodeId}`, payload)
        .then(() => {
          this.processing = false
          this.$toast.success('Podcast episode updated')
          this.show = false
        })
        .catch((error) => {
          var errorMsg = error.response && error.response.data ? error.response.data : 'Failed update episode'
          console.error('Failed update episode', error)
          this.processing = false
          this.$toast.error(errorMsg)
        })
    }
  },
  mounted() {}
}
</script>
