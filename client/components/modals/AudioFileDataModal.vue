<template>
  <modals-modal v-model="show" name="audiofile-data-modal" :width="700" :height="'unset'">
    <div v-if="audioFile" ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden p-6" style="max-height: 80vh">
      <p class="text-base text-gray-200">{{ metadata.filename }}</p>

      <div class="w-full h-px bg-white bg-opacity-10 my-4" />

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

      <div class="w-full h-px bg-white bg-opacity-10 my-4" />

      <p class="font-bold mb-2">{{ $strings.LabelMetaTags }}</p>

      <div v-for="(value, key) in metaTags" :key="key" class="flex mb-1 text-sm">
        <p class="w-32 min-w-32 text-black-50 mb-1">
          {{ key.replace('tag', '') }}
        </p>
        <p>{{ value }}</p>
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
    }
  },
  data() {
    return {}
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
    }
  },
  methods: {},
  mounted() {}
}
</script>
