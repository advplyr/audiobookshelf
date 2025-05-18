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
    return {}
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
  methods: {
    quickEmbed() {
      const payload = {
        message: this.$strings.MessageConfirmQuickEmbed,
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
