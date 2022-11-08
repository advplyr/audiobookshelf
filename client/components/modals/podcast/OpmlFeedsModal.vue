<template>
  <modals-modal v-model="show" name="opml-feeds-modal" :width="1000" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div ref="wrapper" class="p-4 w-full text-sm py-2 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
      <div class="w-full p-4">
        <div class="flex items-center -mx-2 mb-2">
          <div class="w-full md:w-2/3 p-2">
            <ui-dropdown v-model="selectedFolderId" :items="folderItems" :disabled="processing" :label="$strings.LabelFolder" />
          </div>
          <div class="w-full md:w-1/3 p-2 pt-6">
            <ui-checkbox v-model="autoDownloadEpisodes" :label="$strings.LabelAutoDownloadEpisodes" checkbox-bg="primary" border-color="gray-600" label-class="text-sm font-semibold pl-2" />
          </div>
        </div>

        <p class="text-lg font-semibold mb-2">{{ $strings.HeaderPodcastsToAdd }}</p>

        <div class="w-full overflow-y-auto" style="max-height: 50vh">
          <template v-for="(feed, index) in feedMetadata">
            <cards-podcast-feed-summary-card :key="index" :feed="feed" :library-folder-path="selectedFolderPath" class="my-1" />
          </template>
        </div>
      </div>
      <div class="flex items-center py-4">
        <div class="flex-grow" />
        <ui-btn color="success" @click="submit">{{ $strings.ButtonAddPodcasts }}</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    feeds: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      processing: false,
      selectedFolderId: null,
      fullPath: null,
      autoDownloadEpisodes: false,
      feedMetadata: []
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
      return 'OPML Feeds'
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
    selectedFolder() {
      return this.folders.find((f) => f.id === this.selectedFolderId)
    },
    selectedFolderPath() {
      if (!this.selectedFolder) return ''
      return this.selectedFolder.fullPath
    }
  },
  methods: {
    toFeedMetadata(feed) {
      var metadata = feed.metadata
      return {
        title: metadata.title,
        author: metadata.author,
        description: metadata.description,
        releaseDate: '',
        genres: [...metadata.categories],
        feedUrl: metadata.feedUrl,
        imageUrl: metadata.image,
        itunesPageUrl: '',
        itunesId: '',
        itunesArtistId: '',
        language: '',
        numEpisodes: feed.numEpisodes
      }
    },
    init() {
      this.feedMetadata = this.feeds.map(this.toFeedMetadata)

      if (this.folderItems[0]) {
        this.selectedFolderId = this.folderItems[0].value
      }
    },
    async submit() {
      this.processing = true
      var newFeedPayloads = this.feedMetadata.map((metadata) => {
        return {
          path: `${this.selectedFolderPath}\\${this.$sanitizeFilename(metadata.title)}`,
          folderId: this.selectedFolderId,
          libraryId: this.currentLibrary.id,
          media: {
            metadata: {
              ...metadata
            },
            autoDownloadEpisodes: this.autoDownloadEpisodes
          }
        }
      })
      console.log('New feed payloads', newFeedPayloads)

      for (const podcastPayload of newFeedPayloads) {
        await this.$axios
          .$post('/api/podcasts', podcastPayload)
          .then(() => {
            this.$toast.success(`${podcastPayload.media.metadata.title}: ${this.$strings.ToastPodcastCreateSuccess}`)
          })
          .catch((error) => {
            var errorMsg = error.response && error.response.data ? error.response.data : this.$strings.ToastPodcastCreateFailed
            console.error('Failed to create podcast', podcastPayload, error)
            this.$toast.error(`${podcastPayload.media.metadata.title}: ${errorMsg}`)
          })
      }
      this.processing = false
      this.show = false
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