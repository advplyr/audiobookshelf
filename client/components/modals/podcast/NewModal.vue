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
            <div v-if="podcast.imageUrl" class="p-1 w-full">
              <img :src="podcast.imageUrl" class="h-16 w-16 object-contain" />
            </div>
            <div class="p-1 w-full">
              <ui-text-input-with-label v-model="podcast.title" label="Title" @input="titleUpdated" />
            </div>
            <div class="p-1 w-full">
              <ui-text-input-with-label v-model="podcast.author" label="Author" />
            </div>
            <div class="p-1 w-full">
              <ui-text-input-with-label v-model="podcast.feedUrl" label="Feed URL" readonly />
            </div>
            <div class="p-1 w-full">
              <ui-multi-select v-model="podcast.genres" :items="podcast.genres" label="Genres" />
            </div>
            <div class="p-1 w-full">
              <ui-textarea-with-label v-model="podcast.description" label="Description" />
            </div>
            <div class="p-1 w-full">
              <ui-dropdown v-model="selectedFolderId" :items="folderItems" :disabled="processing" label="Folder" @input="folderUpdated" />
            </div>
            <div class="p-1 w-full">
              <ui-text-input-with-label v-model="fullPath" label="Podcast Path" readonly />
            </div>
          </div>
        </div>
        <div class="w-full md:w-1/2 p-4">
          <p class="text-lg font-semibold mb-2">Episodes</p>
          <div ref="episodeContainer" id="episodes-scroll" class="w-full overflow-x-hidden overflow-y-auto">
            <div class="relative">
              <div class="absolute top-0 left-0 h-full flex items-center p-2">
                <ui-checkbox v-model="selectAll" small checkbox-bg="primary" border-color="gray-600" />
              </div>
              <div class="px-8 py-2">
                <p class="font-semibold text-gray-200">Select all episodes</p>
              </div>
            </div>
            <div v-for="(episode, index) in episodes" :key="index" class="relative cursor-pointer" :class="selectedEpisodes[String(index)] ? 'bg-success bg-opacity-10' : index % 2 == 0 ? 'bg-primary bg-opacity-25 hover:bg-opacity-40' : 'bg-primary bg-opacity-5 hover:bg-opacity-25'" @click="toggleSelectEpisode(index)">
              <div class="absolute top-0 left-0 h-full flex items-center p-2">
                <ui-checkbox v-model="selectedEpisodes[String(index)]" small checkbox-bg="primary" border-color="gray-600" />
              </div>
              <div class="px-8 py-2">
                <p v-if="episode.episode" class="font-semibold text-gray-200">#{{ episode.episode }}</p>
                <p class="break-words mb-1">{{ episode.title }}</p>
                <p v-if="episode.subtitle" class="break-words mb-1 text-sm text-gray-300 episode-subtitle">{{ episode.subtitle }}</p>
                <p class="text-xs text-gray-300">Published {{ episode.publishedAt ? $dateDistanceFromNow(episode.publishedAt) : 'Unknown' }}</p>
                <!-- <span class="material-icons cursor-pointer text-lg hover:text-success" @click="saveEpisode(episode)">save</span> -->
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-center py-4">
        <div class="flex-grow" />
        <div class="px-4">
          <ui-checkbox v-model="podcast.autoDownloadEpisodes" label="Auto Download Episodes" checkbox-bg="primary" border-color="gray-600" label-class="pl-2 text-base font-semibold" />
        </div>
        <ui-btn color="success" :disabled="disableSubmit" @click="submit">{{ buttonText }}</ui-btn>
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
    selectAll: {
      get() {
        return this.episodesSelected.length == this.episodes.length
      },
      set(val) {
        for (const key in this.selectedEpisodes) {
          this.selectedEpisodes[key] = val
        }
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
    },
    selectedFolder() {
      return this.folders.find((f) => f.id === this.selectedFolderId)
    },
    selectedFolderPath() {
      if (!this.selectedFolder) return ''
      return this.selectedFolder.fullPath
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
      this.fullPath = Path.join(this.selectedFolderPath, this.podcast.title)
    },
    toggleSelectEpisode(index) {
      this.selectedEpisodes[String(index)] = !this.selectedEpisodes[String(index)]
    },
    submit() {
      var episodesToDownload = []
      if (this.episodesSelected.length) {
        episodesToDownload = this.episodesSelected.map((episodeIndex) => this.episodes[Number(episodeIndex)])
      }

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
            language: this.podcast.language
          },
          autoDownloadEpisodes: this.podcast.autoDownloadEpisodes
        },
        episodesToDownload
      }
      console.log('Podcast payload', podcastPayload)

      this.processing = true
      this.$axios
        .$post('/api/podcasts', podcastPayload)
        .then((libraryItem) => {
          this.processing = false
          this.$toast.success('Podcast created successfully')
          this.show = false
          this.$router.push(`/item/${libraryItem.id}`)
        })
        .catch((error) => {
          var errorMsg = error.response && error.response.data ? error.response.data : 'Failed to create podcast'
          console.error('Failed to create podcast', error)
          this.processing = false
          this.$toast.error(errorMsg)
        })
    },
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
      this.podcast.imageUrl = this._podcastData.cover || ''
      this.podcast.itunesPageUrl = this._podcastData.pageUrl || ''
      this.podcast.itunesId = this._podcastData.id || ''
      this.podcast.itunesArtistId = this._podcastData.artistId || ''
      this.podcast.language = this._podcastData.language || ''
      this.podcast.autoDownloadEpisodes = false

      for (let i = 0; i < this.episodes.length; i++) {
        this.$set(this.selectedEpisodes, String(i), false)
      }

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