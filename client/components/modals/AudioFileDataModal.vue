<template>
  <modals-modal v-model="show" name="audiofile-data-modal" :width="700" :height="'unset'">
    <div v-if="audioFile" ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden p-6" style="max-height: 80vh">
      <div class="flex items-center justify-between">
        <p class="text-base text-gray-200 truncate">{{ metadata.filename }}</p>
        <ui-btn v-if="ffprobeData" small class="ml-2" @click="ffprobeData = null">{{ $strings.ButtonReset }}</ui-btn>
        <ui-btn v-else-if="userIsAdminOrUp" small :loading="probingFile" class="ml-2" @click="getFFProbeData">{{ $strings.ButtonProbeAudioFile }}</ui-btn>
      </div>

      <div class="w-full h-px bg-white/10 my-4" />

      <template v-if="!ffprobeData">
        <ui-text-input-with-label :value="metadata.path" readonly :label="$strings.LabelPath" class="mb-4 text-sm" />

        <div class="flex flex-col sm:flex-row text-sm">
          <div class="w-full sm:w-1/2">
            <div class="flex mb-1">
              <p class="w-32 text-black-50">
                {{ $strings.LabelSize }}
              </p>
              <p>{{ $bytesPretty(metadata.size) }}</p>
            </div>
            <div class="flex mb-1">
              <p class="w-32 text-black-50">
                {{ $strings.LabelDuration }}
              </p>
              <p>{{ $secondsToTimestamp(audioFile.duration) }}</p>
            </div>
            <div class="flex mb-1">
              <p class="w-32 text-black-50">{{ $strings.LabelFormat }}</p>
              <p>{{ audioFile.format }}</p>
            </div>
            <div class="flex mb-1">
              <p class="w-32 text-black-50">
                {{ $strings.LabelChapters }}
              </p>
              <p>{{ audioFile.chapters?.length || 0 }}</p>
            </div>
            <div v-if="audioFile.embeddedCoverArt" class="flex mb-1">
              <p class="w-32 text-black-50">
                {{ $strings.LabelEmbeddedCover }}
              </p>
              <p>{{ audioFile.embeddedCoverArt || '' }}</p>
            </div>
          </div>
          <div class="w-full sm:w-1/2">
            <div class="flex mb-1">
              <p class="w-32 text-black-50">
                {{ $strings.LabelCodec }}
              </p>
              <p>{{ audioFile.codec }}</p>
            </div>
            <div class="flex mb-1">
              <p class="w-32 text-black-50">
                {{ $strings.LabelChannels }}
              </p>
              <p>{{ audioFile.channels }} ({{ audioFile.channelLayout }})</p>
            </div>
            <div class="flex mb-1">
              <p class="w-32 text-black-50">
                {{ $strings.LabelBitrate }}
              </p>
              <p>{{ $bytesPretty(audioFile.bitRate || 0, 0) }}</p>
            </div>
            <div class="flex mb-1">
              <p class="w-32 text-black-50">{{ $strings.LabelTimeBase }}</p>
              <p>{{ audioFile.timeBase }}</p>
            </div>
            <div v-if="audioFile.language" class="flex mb-1">
              <p class="w-32 text-black-50">
                {{ $strings.LabelLanguage }}
              </p>
              <p>{{ audioFile.language || '' }}</p>
            </div>
          </div>
        </div>

        <div class="w-full h-px bg-white/10 my-4" />

        <p class="font-bold mb-2">{{ $strings.LabelMetaTags }}</p>

        <div v-for="(value, key) in metaTags" :key="key" class="flex mb-1 text-sm">
          <p class="w-32 min-w-32 text-black-50 mb-1">
            {{ key.replace('tag', '') }}
          </p>
          <p>{{ value }}</p>
        </div>
      </template>
      <div v-else class="w-full">
        <div class="relative">
          <ui-textarea-with-label :value="prettyFfprobeData" readonly :rows="30" class="text-xs" />

          <button class="absolute top-4 right-4" :class="hasCopied ? 'text-success' : 'text-gray-400 hover:text-white'" @click.stop="copyToClipboard">
            <span class="material-symbols">{{ hasCopied ? 'done' : 'content_copy' }}</span>
          </button>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    audioFile: {
      type: Object,
      default: () => {}
    },
    libraryItemId: String
  },
  data() {
    return {
      probingFile: false,
      ffprobeData: null,
      hasCopied: null
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.ffprobeData = null
        this.probingFile = false
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
    metadata() {
      return this.audioFile?.metadata || {}
    },
    metaTags() {
      return this.audioFile?.metaTags || {}
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    prettyFfprobeData() {
      if (!this.ffprobeData) return ''
      return JSON.stringify(this.ffprobeData, null, 2)
    }
  },
  methods: {
    getFFProbeData() {
      this.probingFile = true
      this.$axios
        .$get(`/api/items/${this.libraryItemId}/ffprobe/${this.audioFile.ino}`)
        .then((data) => {
          console.log('Got ffprobe data', data)
          this.ffprobeData = data
        })
        .catch((error) => {
          console.error('Failed to get ffprobe data', error)
          this.$toast.error(this.$strings.ToastFailedToLoadData)
        })
        .finally(() => {
          this.probingFile = false
        })
    },
    copyToClipboard() {
      clearTimeout(this.hasCopied)
      this.$copyToClipboard(this.prettyFfprobeData).then((success) => {
        this.hasCopied = setTimeout(() => {
          this.hasCopied = null
        }, 2000)
      })
    }
  },
  mounted() {}
}
</script>
