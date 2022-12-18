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
        <div class="flex-grow" />
        <div>
          <ui-btn :to="`/audiobook/${libraryItemId}/manage?tool=m4b`" class="flex items-center"
            >{{ $strings.ButtonOpenManager }}
            <span class="material-icons text-lg ml-2">launch</span>
          </ui-btn>
        </div>
      </div>
    </div>

    <!-- Split to mp3 -->
    <div v-if="showMp3Split && showExperimentalFeatures" class="w-full border border-black-200 p-4 my-8">
      <div class="flex items-center">
        <div>
          <p class="text-lg">{{ $strings.LabelToolsSplitM4b }}</p>
          <p class="max-w-sm text-sm pt-2 text-gray-300">{{ $strings.LabelToolsSplitM4bDescription }}</p>
        </div>
        <div class="flex-grow" />
        <div>
          <ui-btn :disabled="true">{{ $strings.MessageNotYetImplemented }}</ui-btn>
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
        <div class="flex-grow" />
        <div>
          <ui-btn :to="`/audiobook/${libraryItemId}/manage?tool=embed`" class="flex items-center"
            >{{ $strings.ButtonOpenManager }}
            <span class="material-icons text-lg ml-2">launch</span>
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
    return {}
  },
  computed: {
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    libraryItemId() {
      return this.libraryItem ? this.libraryItem.id : null
    },
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    mediaTracks() {
      return this.media.tracks || []
    },
    isSingleM4b() {
      return this.mediaTracks.length === 1 && this.mediaTracks[0].metadata.ext.toLowerCase() === '.m4b'
    },
    chapters() {
      return this.media.chapters || []
    },
    showM4bDownload() {
      if (!this.mediaTracks.length) return false
      return !this.isSingleM4b
    },
    showMp3Split() {
      if (!this.mediaTracks.length) return false
      return this.isSingleM4b && this.chapters.length
    }
  },
  methods: {},
  mounted() {}
}
</script>