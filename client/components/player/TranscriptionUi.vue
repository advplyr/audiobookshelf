<template>
  <div id="transcription-panel">
    <transcription-line
      v-for="(cue, index) in cues"
      :key="index"
      :cue="cue"
      ref="transcriptionLine + index"
      @seek="seek"
    ></transcription-line>
  </div>
</template>

<script>
import TranscriptionLine from "./TranscriptionLine.vue"

export default {
  components: {
    TranscriptionLine
  },
  watch: {
    trackElement() {
      this.setCues()
    }
  },
  data() {
    return {
      cues: [],
      trackElement: null
    }
  },
  mounted() {
    this.init()
  },
  methods: {
    init() {
      this.trackElement = document.getElementById("transcription-track")
      if (this.trackElement && this.trackElement.track) {
        this.setCues()
      }
    },
    seek(time) {
      this.$emit('seek', time)
    },
    setCues() {
      this.cues = this.trackElement.track.cues
    }
  },
}
</script>
<style>
#transcription-panel {
  max-height: 75px;
  overflow-y: auto;
}
</style>
