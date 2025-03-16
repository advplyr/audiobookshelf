<template>
  <modals-modal v-model="show" name="opml-feeds-modal" :width="1000" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
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

        <p class="text-lg font-semibold mb-1">{{ $strings.HeaderPodcastsToAdd }}</p>
        <p class="text-sm text-gray-300 mb-4">{{ $strings.MessageOpmlPreviewNote }}</p>

        <div class="w-full overflow-y-auto" style="max-height: 50vh">
          <template v-for="(feed, index) in feeds">
            <div :key="index" class="py-1 flex items-center">
              <p class="text-lg font-semibold">{{ index + 1 }}.</p>
              <div class="pl-2">
                <p v-if="feed.title" class="text-sm font-semibold">{{ feed.title }}</p>
                <p class="text-xs text-gray-400">{{ feed.feedUrl }}</p>
              </div>
            </div>
          </template>
        </div>
      </div>
      <div class="flex items-center py-4">
        <div class="grow" />
        <ui-btn color="bg-success" @click="submit">{{ $strings.ButtonAddPodcasts }}</ui-btn>
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
      autoDownloadEpisodes: false
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
    init() {
      if (this.folderItems[0]) {
        this.selectedFolderId = this.folderItems[0].value
      }
    },
    async submit() {
      this.processing = true

      const payload = {
        feeds: this.feeds.map((f) => f.feedUrl),
        folderId: this.selectedFolderId,
        libraryId: this.currentLibrary.id,
        autoDownloadEpisodes: this.autoDownloadEpisodes
      }
      this.$axios
        .$post('/api/podcasts/opml/create', payload)
        .then(() => {
          this.show = false
        })
        .catch((error) => {
          const errorMsg = error.response?.data || this.$strings.ToastPodcastCreateFailed
          console.error('Failed to create podcast', payload, error)
          this.$toast.error(errorMsg)
        })
        .finally(() => {
          this.processing = false
        })
    }
  },
  mounted() {}
}
</script>

