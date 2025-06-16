<template>
  <div class="w-full py-2">
    <div class="flex -mb-px">
      <button type="button" :disabled="disabled" class="w-1/2 h-8 rounded-tl-md relative border border-black-200 flex items-center justify-center disabled:cursor-not-allowed" :class="!showAdvancedView ? 'text-white bg-bg hover:bg-bg/60 border-b-bg' : 'text-gray-400 hover:text-gray-300 bg-primary/70 hover:bg-primary/60'" @click="showAdvancedView = false">
        <p class="text-sm">{{ $strings.HeaderPresets }}</p>
      </button>
      <button type="button" :disabled="disabled" class="w-1/2 h-8 rounded-tr-md relative border border-black-200 flex items-center justify-center -ml-px disabled:cursor-not-allowed" :class="showAdvancedView ? 'text-white bg-bg hover:bg-bg/60 border-b-bg' : 'text-gray-400 hover:text-gray-300 bg-primary/70 hover:bg-primary/60'" @click="showAdvancedView = true">
        <p class="text-sm">{{ $strings.HeaderAdvanced }}</p>
      </button>
    </div>
    <div class="p-4 md:p-8 border border-black-200 rounded-b-md mr-px bg-bg">
      <template v-if="!showAdvancedView">
        <div class="flex flex-wrap gap-4 sm:gap-8 justify-start sm:justify-center">
          <div class="flex flex-col items-start gap-2">
            <p class="text-sm w-40">{{ $strings.LabelCodec }}</p>
            <ui-toggle-btns v-model="selectedCodec" :items="codecItems" :disabled="disabled" />
            <p class="text-xs text-gray-300">
              {{ $strings.LabelCurrently }} <span class="text-white">{{ currentCodec }}</span> <span v-if="isCodecsDifferent" class="text-warning">(mixed)</span>
            </p>
          </div>
          <div class="flex flex-col items-start gap-2">
            <p class="text-sm w-40">{{ $strings.LabelBitrate }}</p>
            <ui-toggle-btns v-model="selectedBitrate" :items="bitrateItems" :disabled="disabled" />
            <p class="text-xs text-gray-300">
              {{ $strings.LabelCurrently }} <span class="text-white">{{ currentBitrate }} KB/s</span>
            </p>
          </div>
          <div class="flex flex-col items-start gap-2">
            <p class="text-sm w-40">{{ $strings.LabelChannels }}</p>
            <ui-toggle-btns v-model="selectedChannels" :items="channelsItems" :disabled="disabled" />
            <p class="text-xs text-gray-300">
              {{ $strings.LabelCurrently }} <span class="text-white">{{ currentChannels }} ({{ currentChanelLayout }})</span>
            </p>
          </div>
        </div>
      </template>
      <template v-else>
        <div>
          <div class="flex flex-wrap gap-4 sm:gap-8 justify-start sm:justify-center mb-4">
            <div class="w-40">
              <ui-text-input-with-label v-model="customCodec" :label="$strings.LabelAudioCodec" :disabled="disabled" @input="customCodecChanged" />
            </div>
            <div class="w-40">
              <ui-text-input-with-label v-model="customBitrate" :label="$strings.LabelAudioBitrate" :disabled="disabled" @input="customBitrateChanged" />
            </div>
            <div class="w-40">
              <ui-text-input-with-label v-model="customChannels" :label="$strings.LabelAudioChannels" type="number" :disabled="disabled" @input="customChannelsChanged" />
            </div>
          </div>
          <p class="text-xs sm:text-sm text-warning sm:text-center">{{ $strings.LabelEncodingWarningAdvancedSettings }}</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    audioTracks: {
      type: Array,
      default: () => []
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      showAdvancedView: false,
      selectedCodec: 'aac',
      selectedBitrate: '128k',
      selectedChannels: 2,
      customCodec: 'aac',
      customBitrate: '128k',
      customChannels: 2,
      currentCodec: '',
      currentBitrate: '',
      currentChannels: '',
      currentChanelLayout: '',
      isCodecsDifferent: false
    }
  },
  computed: {
    codecItems() {
      return [
        {
          text: 'Copy',
          value: 'copy'
        },
        {
          text: 'AAC',
          value: 'aac'
        },
        {
          text: 'OPUS',
          value: 'opus'
        }
      ]
    },
    bitrateItems() {
      return [
        {
          text: '32k',
          value: '32k'
        },
        {
          text: '64k',
          value: '64k'
        },
        {
          text: '128k',
          value: '128k'
        },
        {
          text: '192k',
          value: '192k'
        }
      ]
    },
    channelsItems() {
      return [
        {
          text: '1 (mono)',
          value: 1
        },
        {
          text: '2 (stereo)',
          value: 2
        }
      ]
    }
  },
  methods: {
    customBitrateChanged(val) {
      localStorage.setItem('embedMetadataBitrate', val)
    },
    customChannelsChanged(val) {
      localStorage.setItem('embedMetadataChannels', val)
    },
    customCodecChanged(val) {
      localStorage.setItem('embedMetadataCodec', val)
    },
    getEncodingOptions() {
      if (this.showAdvancedView) {
        return {
          codec: this.customCodec || this.selectedCodec || 'aac',
          bitrate: this.customBitrate || this.selectedBitrate || '128k',
          channels: this.customChannels || this.selectedChannels || 2
        }
      } else {
        return {
          codec: this.selectedCodec || 'aac',
          bitrate: this.selectedBitrate || '128k',
          channels: this.selectedChannels || 2
        }
      }
    },
    setPreset() {
      // If already AAC and not mixed, set copy
      if (this.currentCodec === 'aac' && !this.isCodecsDifferent) {
        this.selectedCodec = 'copy'
      } else {
        this.selectedCodec = 'aac'
      }

      if (!this.currentBitrate) {
        this.selectedBitrate = '128k'
      } else {
        // Find closest bitrate rounding up
        const bitratesToMatch = [32, 64, 128, 192]
        const closestBitrate = bitratesToMatch.find((bitrate) => bitrate >= this.currentBitrate) || 192
        this.selectedBitrate = closestBitrate + 'k'
      }

      if (!this.currentChannels || isNaN(this.currentChannels)) {
        this.selectedChannels = 2
      } else {
        // Either 1 or 2
        this.selectedChannels = Math.max(Math.min(Number(this.currentChannels), 2), 1)
      }
    },
    setCurrentValues() {
      if (this.audioTracks.length === 0) return

      this.currentChannels = this.audioTracks[0].channels
      this.currentChanelLayout = this.audioTracks[0].channelLayout
      this.currentCodec = this.audioTracks[0].codec

      let totalBitrate = 0
      for (const track of this.audioTracks) {
        const trackBitrate = !isNaN(track.bitRate) ? track.bitRate : 0
        totalBitrate += trackBitrate

        if (track.channels > this.currentChannels) this.currentChannels = track.channels
        if (track.codec !== this.currentCodec) {
          console.warn('Audio track codec is different from the first track', track.codec)
          this.isCodecsDifferent = true
        }
      }

      this.currentBitrate = Math.round(totalBitrate / this.audioTracks.length / 1000)
    },
    init() {
      this.customBitrate = localStorage.getItem('embedMetadataBitrate') || '128k'
      this.customChannels = localStorage.getItem('embedMetadataChannels') || 2
      this.customCodec = localStorage.getItem('embedMetadataCodec') || 'aac'

      this.setCurrentValues()

      this.setPreset()
    }
  },
  mounted() {
    this.init()
  }
}
</script>
