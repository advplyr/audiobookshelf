<template>
  <modals-modal v-model="show" name="youtube-download-modal" :width="800" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
        <p class="text-3xl text-white truncate">Download from YouTube</p>
      </div>
    </template>

    <div class="p-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300">
      <!-- YouTube URL Input -->
      <div class="mb-4">
        <ui-text-input-with-label
          v-model="youtubeUrl"
          label="YouTube URL"
          placeholder="https://www.youtube.com/watch?v=... or https://www.youtube.com/playlist?list=..."
          @input="urlChanged"
        />
        <p v-if="isPlaylist" class="text-xs text-gray-400 mt-1">Playlist detected - all videos will be downloaded</p>
      </div>

      <!-- Library Selection -->
      <div class="mb-4">
        <ui-dropdown
          v-model="selectedLibraryId"
          :items="libraryItems"
          label="Library"
          @input="libraryChanged"
        />
      </div>

      <!-- Folder Selection -->
      <div class="mb-4">
        <ui-dropdown
          v-model="selectedFolderId"
          :items="folderItems"
          label="Folder"
          :disabled="!selectedLibraryId"
        />
      </div>

      <!-- Audio Quality Selection -->
      <div class="mb-4">
        <ui-dropdown
          v-model="audioQuality"
          :items="qualityItems"
          label="Audio Quality"
        />
      </div>

      <!-- Info text -->
      <div class="mb-4 p-3 bg-info bg-opacity-20 border border-info rounded">
        <p class="text-sm">
          <span class="font-semibold">Note:</span> Audio will be downloaded in MP3 format. Files will be organized as: <span class="font-mono text-xs bg-black bg-opacity-30 px-1 py-0.5 rounded">Uploader/Video Title/</span>
        </p>
      </div>

      <!-- Buttons -->
      <div class="flex justify-end pt-4">
        <ui-btn @click="show = false" class="mr-2">Cancel</ui-btn>
        <ui-btn color="success" :loading="processing" @click="submit">Download</ui-btn>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false,
      youtubeUrl: '',
      selectedLibraryId: null,
      selectedFolderId: null,
      audioQuality: 'best'
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showYouTubeDownloadModal
      },
      set(val) {
        this.$store.commit('globals/setShowYouTubeDownloadModal', val)
      }
    },
    libraries() {
      return this.$store.state.libraries.libraries || []
    },
    libraryItems() {
      return this.libraries.map(lib => ({
        value: lib.id,
        text: lib.name
      }))
    },
    selectedLibrary() {
      return this.libraries.find(lib => lib.id === this.selectedLibraryId)
    },
    folderItems() {
      if (!this.selectedLibrary) return []
      return (this.selectedLibrary.folders || []).map(folder => ({
        value: folder.id,
        text: folder.fullPath
      }))
    },
    qualityItems() {
      return [
        { value: 'best', text: 'Best Quality' },
        { value: '320', text: '320 kbps' },
        { value: '256', text: '256 kbps' },
        { value: '192', text: '192 kbps' },
        { value: '128', text: '128 kbps' }
      ]
    },
    isPlaylist() {
      if (!this.youtubeUrl) return false
      try {
        const url = new URL(this.youtubeUrl)
        return url.searchParams.has('list') || url.pathname.includes('/playlist')
      } catch {
        return false
      }
    }
  },
  methods: {
    urlChanged() {
      // Validate URL format as user types
      // Could add real-time validation here if needed
    },
    libraryChanged() {
      this.selectedFolderId = null
      if (this.selectedLibrary && this.selectedLibrary.folders?.length) {
        this.selectedFolderId = this.selectedLibrary.folders[0].id
      }
    },
    async submit() {
      if (!this.youtubeUrl) {
        this.$toast.error('YouTube URL is required')
        return
      }
      if (!this.selectedLibraryId || !this.selectedFolderId) {
        this.$toast.error('Please select a library and folder')
        return
      }

      this.processing = true

      const payload = {
        url: this.youtubeUrl,
        libraryId: this.selectedLibraryId,
        folderId: this.selectedFolderId,
        options: {
          audioQuality: this.audioQuality
        }
      }

      this.$axios
        .$post('/api/youtube/download', payload)
        .then((response) => {
          if (response.isPlaylist) {
            this.$toast.success(`Queued ${response.count} videos from playlist`)
          } else {
            this.$toast.success('YouTube download started')
          }
          this.show = false
          this.reset()
        })
        .catch((error) => {
          console.error('YouTube download failed', error)
          const errorMsg = error.response?.data || 'YouTube download failed'
          this.$toast.error(errorMsg)
        })
        .finally(() => {
          this.processing = false
        })
    },
    reset() {
      this.youtubeUrl = ''
      this.selectedLibraryId = null
      this.selectedFolderId = null
      this.audioQuality = 'best'
    },
    init() {
      // Set default library from current library
      const currentLibraryId = this.$store.state.libraries.currentLibraryId
      if (currentLibraryId) {
        this.selectedLibraryId = currentLibraryId
        this.libraryChanged()
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
  }
}
</script>
