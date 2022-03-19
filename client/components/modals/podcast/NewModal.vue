<template>
  <modals-modal v-model="show" name="new-podcast-modal" :width="1200" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div ref="wrapper" id="podcast-wrapper" class="p-4 w-full text-sm py-2 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
      <div class="flex flex-wrap">
        <div class="w-full md:w-1/2 p-4">
          <p class="text-lg font-semibold mb-2">Details</p>
          <div class="flex flex-wrap">
            <div class="p-2 w-full">
              <ui-text-input-with-label v-model="podcast.title" label="Title" />
            </div>
            <div class="p-2 w-full">
              <ui-text-input-with-label v-model="podcast.author" label="Author" />
            </div>
            <div class="p-2 w-full">
              <ui-text-input-with-label v-model="podcast.feedUrl" label="Feed URL" />
            </div>
            <div class="p-2 w-full">
              <ui-multi-select v-model="podcast.genres" :items="podcast.genres" label="Genres" />
            </div>
            <div class="p-2 w-full">
              <ui-text-input-with-label v-model="podcast.releaseDate" label="Release Date" />
            </div>
            <div class="p-2 w-full">
              <ui-text-input-with-label v-model="podcast.itunesPageUrl" label="Page URL" />
            </div>
            <div class="p-2 w-full">
              <ui-text-input-with-label v-model="podcast.feedImageUrl" label="Feed Image URL" />
            </div>
            <div class="p-2 w-full">
              <ui-checkbox v-model="podcast.autoDownloadEpisodes" label="Auto Download Episodes" checkbox-bg="primary" border-color="gray-600" label-class="pl-2 text-base font-semibold" />
            </div>
          </div>
        </div>
        <div class="w-full md:w-1/2 p-4">
          <p class="text-lg font-semibold mb-2">Episodes</p>
          <div ref="episodeContainer" id="episodes-scroll" class="w-full overflow-x-hidden overflow-y-auto">
            <div v-for="(episode, index) in episodes" :key="index" class="relative cursor-pointer" :class="index % 2 == 0 ? 'bg-primary bg-opacity-25 hover:bg-opacity-40' : 'bg-primary bg-opacity-5 hover:bg-opacity-25'" @click="toggleSelectEpisode(index)">
              <div class="absolute top-0 left-0 h-full flex items-center p-2">
                <ui-checkbox v-model="selectedEpisodes[String(index)]" small checkbox-bg="primary" border-color="gray-600" />
              </div>
              <div class="px-8 py-2">
                <p v-if="episode.episode" class="font-semibold text-gray-200">#{{ episode.episode }}</p>
                <p class="break-words">{{ episode.title }}</p>
                <p class="text-xs text-gray-300">Published {{ episode.pubDate || 'Unknown' }}</p>
                <!-- <span class="material-icons cursor-pointer text-lg hover:text-success" @click="saveEpisode(episode)">save</span> -->
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-center py-4">
        <div class="flex-grow" />
        <ui-btn color="success" :disabled="disableSubmit" @click="submit">{{ buttonText }}</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    podcastData: {
      type: Object,
      default: () => null
    },
    podcastFeedData: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      processing: false,
      podcast: {
        title: '',
        author: '',
        description: '',
        releaseDate: '',
        genres: [],
        feedUrl: '',
        feedImageUrl: '',
        itunesPageUrl: '',
        itunesId: '',
        itunesArtistId: '',
        autoDownloadEpisodes: false
      },
      selectedEpisodes: {}
    }
  },
  watch: {
    show: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.init()
        }
      }
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
      return this._podcastData.title
    },
    _podcastData() {
      return this.podcastData || {}
    },
    feedMetadata() {
      return this._podcastData.metadata || {}
    },
    episodes() {
      if (!this.podcastFeedData) return []
      return this.podcastFeedData.episodes || []
    },
    episodesSelected() {
      return Object.keys(this.selectedEpisodes).filter((key) => !!this.selectedEpisodes[key])
    },
    disableSubmit() {
      return !this.episodesSelected.length && !this.podcast.autoDownloadEpisodes
    },
    buttonText() {
      if (!this.episodesSelected.length) return 'Add Podcast'
      if (this.episodesSelected.length == 1) return 'Add Podcast & Download 1 Episode'
      return `Add Podcast & Download ${this.episodesSelected.length} Episodes`
    }
  },
  methods: {
    toggleSelectEpisode(index) {
      this.selectedEpisodes[String(index)] = !this.selectedEpisodes[String(index)]
    },
    submit() {},
    saveEpisode(episode) {
      console.log('Save episode', episode)
    },
    init() {
      this.podcast.title = this._podcastData.title
      this.podcast.author = this._podcastData.artistName || ''
      this.podcast.description = this._podcastData.description || this.feedMetadata.description || ''
      this.podcast.releaseDate = this._podcastData.releaseDate || ''
      this.podcast.genres = this._podcastData.genres || []
      this.podcast.feedUrl = this._podcastData.feedUrl
      this.podcast.feedImageUrl = this._podcastData.cover || ''
      this.podcast.itunesPageUrl = this._podcastData.pageUrl || ''
      this.podcast.itunesId = this._podcastData.id || ''
      this.podcast.itunesArtistId = this._podcastData.artistId || ''
      this.podcast.autoDownloadEpisodes = false

      for (let i = 0; i < this.episodes.length; i++) {
        this.$set(this.selectedEpisodes, String(i), false)
      }
    }
  }
}
</script>

<style>
#podcast-wrapper {
  min-height: 400px;
  max-height: 80vh;
}
#episodes-scroll {
  max-height: calc(80vh - 200px);
}
</style>