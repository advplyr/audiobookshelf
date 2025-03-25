<template>
  <modals-modal v-model="show" name="new-podcast-modal" :width="1000" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-3/4 overflow-hidden">
        <p class="text-xl md:text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div ref="wrapper" id="podcast-wrapper" class="p-2 md:p-8 w-full text-sm py-2 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-x-hidden overflow-y-auto" style="max-height: 80vh">
      <div class="w-full">
        <p class="text-lg font-semibold mb-2 px-2">{{ $strings.HeaderDetails }}</p>

        <div v-if="podcast.imageUrl" class="p-2 w-full">
          <img :src="podcast.imageUrl" class="h-16 w-16 object-contain" />
        </div>
        <div class="flex flex-wrap">
          <div class="w-full md:w-1/2 p-2">
            <ui-text-input-with-label v-model="podcast.title" :label="$strings.LabelTitle" @input="titleUpdated" />
          </div>
          <div class="w-full md:w-1/2 p-2">
            <ui-text-input-with-label v-model="podcast.author" :label="$strings.LabelAuthor" />
          </div>
        </div>
        <div class="flex flex-wrap">
          <div class="w-full md:w-1/2 p-2">
            <ui-text-input-with-label v-model="podcast.feedUrl" :label="$strings.LabelFeedURL" readonly />
          </div>
          <div class="w-full md:w-1/2 p-2">
            <ui-multi-select v-model="podcast.genres" :items="podcast.genres" :label="$strings.LabelGenres" />
          </div>
        </div>
        <div class="flex flex-wrap">
          <div class="md:w-1/4 p-2">
            <ui-dropdown :label="$strings.LabelPodcastType" v-model="podcast.type" :items="podcastTypes" small />
          </div>
          <div class="md:w-1/4 p-2">
            <ui-text-input-with-label v-model="podcast.language" :label="$strings.LabelLanguage" />
          </div>
          <div class="md:w-1/4 px-2 pt-7">
            <ui-checkbox v-model="podcast.explicit" :label="$strings.LabelExplicit" checkbox-bg="primary" border-color="gray-600" label-class="pl-2 text-base font-semibold" />
          </div>
        </div>
        <div class="p-2 w-full">
          <ui-textarea-with-label v-model="podcast.description" :label="$strings.LabelDescription" :rows="3" />
        </div>
        <div class="flex flex-wrap">
          <div class="w-full md:w-1/2 p-2">
            <ui-dropdown v-model="selectedFolderId" :items="folderItems" :disabled="processing" :label="$strings.LabelFolder" @input="folderUpdated" />
          </div>
          <div class="w-full md:w-1/2 p-2">
            <ui-text-input-with-label v-model="fullPath" :label="`${$strings.LabelPodcast} ${$strings.LabelPath}`" input-class="h-10" readonly />
          </div>
        </div>
      </div>
      <div class="flex items-center py-4 px-2">
        <div class="grow" />
        <div class="px-4">
          <ui-checkbox v-model="podcast.autoDownloadEpisodes" :label="$strings.LabelAutoDownloadEpisodes" checkbox-bg="primary" border-color="gray-600" label-class="pl-2 text-sm md:text-base font-semibold" />
        </div>
        <ui-btn color="bg-success" @click="submit">{{ $strings.ButtonSubmit }}</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
import Path from 'path'

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
      selectedFolderId: null,
      fullPath: null,
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
        autoDownloadEpisodes: false,
        language: '',
        explicit: false,
        type: ''
      }
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
    currentLibrary() {
      return this.$store.getters['libraries/getCurrentLibrary']
    },
    folders() {
      if (!this.currentLibrary) return []
      return this.currentLibrary.folders || []
    },
    folderItems() {
      return this.folders.map((fold) => {
        return {
          value: fold.id,
          text: fold.fullPath
        }
      })
    },
    _podcastData() {
      return this.podcastData || {}
    },
    feedMetadata() {
      if (!this.podcastFeedData) return {}
      return this.podcastFeedData.metadata || {}
    },
    episodes() {
      if (!this.podcastFeedData) return []
      return this.podcastFeedData.episodes || []
    },
    selectedFolder() {
      return this.folders.find((f) => f.id === this.selectedFolderId)
    },
    selectedFolderPath() {
      if (!this.selectedFolder) return ''
      return this.selectedFolder.fullPath
    },
    podcastTypes() {
      return this.$store.state.globals.podcastTypes.map((e) => {
        return {
          text: this.$strings[e.descriptionKey] || e.text,
          value: e.value
        }
      })
    }
  },
  methods: {
    titleUpdated() {
      this.folderUpdated()
    },
    folderUpdated() {
      if (!this.selectedFolderPath || !this.podcast.title) {
        this.fullPath = ''
        return
      }
      this.fullPath = Path.join(this.selectedFolderPath, this.$sanitizeFilename(this.podcast.title))
    },
    submit() {
      const podcastPayload = {
        path: this.fullPath,
        folderId: this.selectedFolderId,
        libraryId: this.currentLibrary.id,
        media: {
          metadata: {
            title: this.podcast.title,
            author: this.podcast.author,
            description: this.podcast.description,
            releaseDate: this.podcast.releaseDate,
            genres: [...this.podcast.genres],
            feedUrl: this.podcast.feedUrl,
            imageUrl: this.podcast.imageUrl,
            itunesPageUrl: this.podcast.itunesPageUrl,
            itunesId: this.podcast.itunesId,
            itunesArtistId: this.podcast.itunesArtistId,
            language: this.podcast.language,
            explicit: this.podcast.explicit,
            type: this.podcast.type
          },
          autoDownloadEpisodes: this.podcast.autoDownloadEpisodes
        }
      }
      console.log('Podcast payload', podcastPayload)

      this.processing = true
      this.$axios
        .$post('/api/podcasts', podcastPayload)
        .then((libraryItem) => {
          this.processing = false
          this.$toast.success(this.$strings.ToastPodcastCreateSuccess)
          this.show = false
          this.$router.push(`/item/${libraryItem.id}`)
        })
        .catch((error) => {
          var errorMsg = error.response && error.response.data ? error.response.data : this.$strings.ToastPodcastCreateFailed
          console.error('Failed to create podcast', error)
          this.processing = false
          this.$toast.error(errorMsg)
        })
    },
    init() {
      // Prefer using itunes podcast data but not always passed in if manually entering rss feed
      this.podcast.title = this._podcastData.title || this.feedMetadata.title || ''
      this.podcast.author = this._podcastData.artistName || this.feedMetadata.author || ''
      this.podcast.description = this._podcastData.description || this.feedMetadata.descriptionPlain || ''
      this.podcast.releaseDate = this._podcastData.releaseDate || ''
      this.podcast.genres = this._podcastData.genres || this.feedMetadata.categories || []
      this.podcast.feedUrl = this._podcastData.feedUrl || this.feedMetadata.feedUrl || ''
      this.podcast.imageUrl = this._podcastData.cover || this.feedMetadata.image || ''
      this.podcast.itunesPageUrl = this._podcastData.pageUrl || ''
      this.podcast.itunesId = this._podcastData.id || ''
      this.podcast.itunesArtistId = this._podcastData.artistId || ''
      this.podcast.language = this._podcastData.language || this.feedMetadata.language || ''
      this.podcast.autoDownloadEpisodes = false
      this.podcast.type = this._podcastData.type || this.feedMetadata.type || 'episodic'

      this.podcast.explicit = this._podcastData.explicit || this.feedMetadata.explicit === 'yes' || this.feedMetadata.explicit == 'true'
      if (this.folderItems[0]) {
        this.selectedFolderId = this.folderItems[0].value
        this.folderUpdated()
      }
    }
  },
  mounted() {}
}
</script>

<style scoped>
#podcast-wrapper {
  min-height: 400px;
  max-height: 80vh;
}
#episodes-scroll {
  max-height: calc(80vh - 200px);
}
</style>
