<template>
  <div style="min-height: 200px">
    <template v-if="!podcastFeedUrl">
      <div class="py-8">
        <widgets-alert type="error">{{ $strings.MessagePodcastHasNoRSSFeedForMatching }}</widgets-alert>
      </div>
    </template>
    <template v-else>
      <form @submit.prevent="submitForm">
        <div class="flex mb-2">
          <ui-text-input-with-label v-model="episodeTitle" :disabled="isProcessing" :label="$strings.LabelEpisodeTitle" class="pr-1" />
          <ui-btn class="mt-5 ml-1" :loading="isProcessing" type="submit">{{ $strings.ButtonSearch }}</ui-btn>
        </div>
      </form>
      <div v-if="!isProcessing && searchedTitle && !episodesFound.length" class="w-full py-8">
        <p class="text-center text-lg">{{ $strings.MessageNoEpisodeMatchesFound }}</p>
      </div>
      <div v-for="(episode, index) in episodesFound" :key="index" class="w-full py-4 border-b border-white/5 hover:bg-gray-300/10 cursor-pointer px-2" @click.stop="selectEpisode(episode)">
        <p v-if="episode.episode" class="font-semibold text-gray-200">#{{ episode.episode }}</p>
        <p class="break-words mb-1">{{ episode.title }}</p>
        <p v-if="episode.subtitle" class="mb-1 text-sm text-gray-300 line-clamp-2">{{ episode.subtitle }}</p>
        <p class="text-xs text-gray-400">Published {{ episode.publishedAt ? $dateDistanceFromNow(episode.publishedAt) : 'Unknown' }}</p>
      </div>
    </template>
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
      episodeTitle: '',
      searchedTitle: '',
      episodesFound: []
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
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    podcastFeedUrl() {
      return this.mediaMetadata.feedUrl
    }
  },
  methods: {
    getUpdatePayload(episodeData) {
      var updatePayload = {}
      for (const key in episodeData) {
        if (key === 'enclosure') {
          if (!this.episode.enclosure || JSON.stringify(this.episode.enclosure) !== JSON.stringify(episodeData.enclosure)) {
            updatePayload[key] = {
              ...episodeData.enclosure
            }
          }
        } else if (episodeData[key] != this.episode[key]) {
          updatePayload[key] = episodeData[key]
        }
      }
      return updatePayload
    },
    selectEpisode(episode) {
      const episodeData = {
        title: episode.title || '',
        subtitle: episode.subtitle || '',
        description: episode.description || '',
        enclosure: episode.enclosure || null,
        episode: episode.episode || '',
        episodeType: episode.episodeType || '',
        season: episode.season || '',
        pubDate: episode.pubDate || '',
        publishedAt: episode.publishedAt
      }
      const updatePayload = this.getUpdatePayload(episodeData)
      if (!Object.keys(updatePayload).length) {
        return this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
      }
      console.log('Episode update payload', updatePayload)

      this.isProcessing = true
      this.$axios
        .$patch(`/api/podcasts/${this.libraryItem.id}/episode/${this.episodeId}`, updatePayload)
        .then(() => {
          this.isProcessing = false
          this.$toast.success(this.$strings.ToastPodcastEpisodeUpdated)
          this.$emit('selectTab', 'details')
        })
        .catch((error) => {
          var errorMsg = error.response && error.response.data ? error.response.data : 'Failed to update episode'
          console.error('Failed update episode', error)
          this.isProcessing = false
          this.$toast.error(errorMsg)
        })
    },
    submitForm() {
      if (!this.episodeTitle || !this.episodeTitle.length) {
        this.$toast.error(this.$strings.ToastTitleRequired)
        return
      }
      this.searchedTitle = this.episodeTitle
      this.isProcessing = true
      this.$axios
        .$get(`/api/podcasts/${this.libraryItem.id}/search-episode?title=${encodeURIComponent(this.episodeTitle)}`)
        .then((results) => {
          this.episodesFound = results.episodes.map((ep) => ep.episode)
          console.log('Episodes found', this.episodesFound)
          this.isProcessing = false
        })
        .catch((error) => {
          console.error('Failed to search for episode', error)
          var errMsg = error.response ? error.response.data || '' : ''
          this.$toast.error(errMsg || 'Failed to search for episode')
          this.isProcessing = false
        })
    },
    init() {
      this.searchedTitle = null
      this.episodesFound = []
      this.episodeTitle = this.episode ? this.episode.title || '' : ''
    }
  },
  mounted() {}
}
</script>
