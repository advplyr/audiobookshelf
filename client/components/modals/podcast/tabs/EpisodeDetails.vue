<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-1/5 p-1">
        <ui-text-input-with-label v-model="newEpisode.season" :label="$strings.LabelSeason" />
      </div>
      <div class="w-1/5 p-1">
        <ui-text-input-with-label v-model="newEpisode.episode" :label="$strings.LabelEpisode" />
      </div>
      <div class="w-1/5 p-1">
        <ui-dropdown v-model="newEpisode.episodeType" :label="$strings.LabelEpisodeType" :items="episodeTypes" small />
      </div>
      <div class="w-2/5 p-1">
        <ui-text-input-with-label v-model="pubDateInput" @input="updatePubDate" type="datetime-local" :label="$strings.LabelPubDate" />
      </div>
      <div class="w-full p-1">
        <ui-text-input-with-label v-model="newEpisode.title" :label="$strings.LabelTitle" />
      </div>
      <div class="w-full p-1">
        <ui-textarea-with-label v-model="newEpisode.subtitle" :label="$strings.LabelSubtitle" :rows="3" />
      </div>
      <div class="w-full p-1 default-style">
        <ui-rich-text-editor :label="$strings.LabelDescription" v-model="newEpisode.description" />
      </div>
    </div>
    <div class="flex items-center justify-end pt-4">
      <ui-btn @click="submit">{{ $strings.ButtonSubmit }}</ui-btn>
    </div>
    <div v-if="enclosureUrl" class="py-4">
      <p class="text-xs text-gray-300 font-semibold">Episode URL from RSS feed</p>
      <a :href="enclosureUrl" target="_blank" class="text-xs text-blue-400 hover:text-blue-500 hover:underline">{{ enclosureUrl }}</a>
    </div>
    <div v-else class="py-4">
      <p class="text-xs text-gray-300 font-semibold">Episode not linked to RSS feed episode</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean,
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
      newEpisode: {
        season: null,
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
    isProcessing: {
      get() {
        return this.processing
      },
      set(val) {
        this.$emit('update:processing', val)
      }
    },
    episodeId() {
      return this.episode ? this.episode.id : null
    },
    enclosure() {
      return this.episode ? this.episode.enclosure || {} : {}
    },
    enclosureUrl() {
      return this.enclosure.url
    },
    episodeTypes() {
      return this.$store.state.globals.episodeTypes || []
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
      this.newEpisode.season = this.episode.season || ''
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

      this.isProcessing = true
      this.$axios
        .$patch(`/api/podcasts/${this.libraryItem.id}/episode/${this.episodeId}`, payload)
        .then(() => {
          this.isProcessing = false
          this.$toast.success('Podcast episode updated')
          this.$emit('close')
        })
        .catch((error) => {
          var errorMsg = error.response && error.response.data ? error.response.data : 'Failed to update episode'
          console.error('Failed update episode', error)
          this.isProcessing = false
          this.$toast.error(errorMsg)
        })
    }
  },
  mounted() {}
}
</script>
