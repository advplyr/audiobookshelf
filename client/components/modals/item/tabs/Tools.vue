<template>
  <div class="w-full h-full overflow-hidden overflow-y-auto px-4 py-6">
    <p class="text-xl font-semibold mb-2">{{ $strings.HeaderAudiobookTools }}</p>

    <!-- Merge to m4b -->
    <div v-if="showM4bDownload" class="w-full border border-black-200 p-4 my-8">
      <div class="flex flex-wrap items-center">
        <div>
          <p class="text-lg">{{ $strings.LabelToolsMakeM4b }}</p>
          <p class="max-w-sm text-sm pt-2 text-gray-300">{{ $strings.LabelToolsMakeM4bDescription }}</p>
        </div>
        <div class="grow" />
        <div>
          <ui-btn :to="`/audiobook/${libraryItemId}/manage?tool=m4b`" class="flex items-center"
            >{{ $strings.ButtonOpenManager }}
            <span class="material-symbols text-lg ml-2">launch</span>
          </ui-btn>
        </div>
      </div>
    </div>

    <!-- Embed Metadata -->
    <div v-if="mediaTracks.length" class="w-full border border-black-200 p-4 my-8">
      <div class="flex items-center">
        <div>
          <p class="text-lg">{{ $strings.LabelToolsEmbedMetadata }}</p>
          <p class="max-w-sm text-sm pt-2 text-gray-300">{{ $strings.LabelToolsEmbedMetadataDescription }}</p>
        </div>
        <div class="grow" />
        <div>
          <ui-btn :to="`/audiobook/${libraryItemId}/manage?tool=embed`" class="flex items-center"
            >{{ $strings.ButtonOpenManager }}
            <span class="material-symbols text-lg ml-2">launch</span>
          </ui-btn>

          <ui-btn v-if="!isMetadataEmbedQueued && !isEmbedTaskRunning" class="w-full mt-4" small @click.stop="quickEmbed">{{ $strings.ButtonQuickEmbed }}</ui-btn>
        </div>
      </div>

      <!-- queued alert -->
      <widgets-alert v-if="isMetadataEmbedQueued" type="warning" class="mt-4">
        <p class="text-lg">{{ $getString('MessageQuickEmbedQueue', [queuedEmbedLIds.length]) }}</p>
      </widgets-alert>

      <!-- processing alert -->
      <widgets-alert v-if="isEmbedTaskRunning" type="warning" class="mt-4">
        <p class="text-lg">{{ $strings.MessageQuickEmbedInProgress }}</p>
      </widgets-alert>
    </div>

    <!-- Download by chapters -->
    <div v-if="showChapterDownload" class="w-full border border-black-200 p-4 my-8">
      <div class="flex flex-wrap items-start">
        <div>
          <p class="text-lg">{{ $strings.LabelToolsDownloadByChapters }}</p>
          <p class="max-w-sm text-sm pt-2 text-gray-300">{{ $strings.LabelToolsDownloadByChaptersDescription }}</p>
        </div>
        <div class="grow" />
        <div class="flex flex-col items-end gap-2 mt-2">
          <select v-if="audioFiles.length > 1" v-model="selectedFileIno" class="bg-primary border border-gray-600 rounded px-2 py-1 text-sm w-full max-w-xs truncate">
            <option v-for="af in audioFiles" :key="af.ino" :value="af.ino">{{ af.metadata.filename }}</option>
          </select>
          <ui-btn :disabled="isChapterDownloading" @click.stop="downloadChapters">
            <span v-if="isChapterDownloading">{{ $strings.ButtonChapterDownloadZipPreparing }}</span>
            <span v-else>{{ $strings.ButtonChapterDownloadZip }}</span>
          </ui-btn>
        </div>
      </div>
    </div>

    <p v-if="!mediaTracks.length" class="text-lg text-center my-8">{{ $strings.MessageNoAudioTracks }}</p>
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean,
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      selectedFileIno: null,
      isChapterDownloading: false
    }
  },
  computed: {
    libraryItemId() {
      return this.libraryItem?.id || null
    },
    media() {
      return this.libraryItem?.media || {}
    },
    mediaTracks() {
      return this.media.tracks || []
    },
    chapters() {
      return this.media.chapters || []
    },
    audioFiles() {
      return this.media.audioFiles?.filter((af) => !af.exclude) || []
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    userToken() {
      return this.$store.getters['user/getToken']
    },
    showChapterDownload() {
      return this.chapters.length > 0 && this.userCanDownload && this.audioFiles.length > 0
    },
    showM4bDownload() {
      if (!this.mediaTracks.length) return false
      return true
    },
    queuedEmbedLIds() {
      return this.$store.state.tasks.queuedEmbedLIds || []
    },
    isMetadataEmbedQueued() {
      return this.queuedEmbedLIds.some((lid) => lid === this.libraryItemId)
    },
    tasks() {
      return this.$store.getters['tasks/getTasksByLibraryItemId'](this.libraryItemId)
    },
    embedTask() {
      return this.tasks.find((t) => t.action === 'embed-metadata')
    },
    encodeTask() {
      return this.tasks.find((t) => t.action === 'encode-m4b')
    },
    isEmbedTaskRunning() {
      return this.embedTask && !this.embedTask?.isFinished
    },
    isEncodeTaskRunning() {
      return this.encodeTask && !this.encodeTask?.isFinished
    }
  },
  watch: {
    audioFiles: {
      immediate: true,
      handler(files) {
        if (files.length && !this.selectedFileIno) {
          this.selectedFileIno = files[0].ino
        }
      }
    }
  },
  methods: {
    downloadChapters() {
      const ino = this.audioFiles.length === 1 ? this.audioFiles[0].ino : this.selectedFileIno
      const params = new URLSearchParams({ token: this.userToken })
      if (ino) params.append('fileIno', ino)
      const url = `${process.env.serverUrl}/api/items/${this.libraryItemId}/download-chapters?${params}`

      this.isChapterDownloading = true
      // $nextTick ensures the DOM is updated, then requestAnimationFrame ensures
      // the browser has actually painted the frame before the anchor click runs.
      // Without this, the click blocks the JS thread before "Preparing..." is visible.
      this.$nextTick(() => {
        requestAnimationFrame(() => {
          this.$downloadFile(url, `${this.media.title} - Chapters.zip`)
          // $downloadFile has no completion callback — reset after a delay.
          setTimeout(() => {
            this.isChapterDownloading = false
          }, 3000)
        })
      })
    },
    quickEmbed() {
      const payload = {
        message: this.$strings.MessageConfirmQuickEmbed,
        allowHtml: true,
        callback: (confirmed) => {
          if (confirmed) {
            this.$axios
              .$post(`/api/tools/item/${this.libraryItemId}/embed-metadata`)
              .then(() => {
                console.log('Audio metadata encode started')
              })
              .catch((error) => {
                console.error('Audio metadata encode failed', error)
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    }
  }
}
</script>
