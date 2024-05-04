<template>
  <div id="transcription-panel">
    <transcription-line
      v-for="(cue, index) in cues"
      :key="index"
      :cue="cue"
      ref="transcriptionLine + index"
    ></transcription-line>
  </div>
</template>

<script>
import TranscriptionLine from "./TranscriptionLine.vue";

export default {
  components: {
    TranscriptionLine
  },
  data() {
    return {
      cues: [],
    };
  },
  mounted() {
    this.init()
  },
  methods: {
    init() {
      const trackElement = document.getElementById("transcription-track");
      this.cues = trackElement.track.cues;
    },
  },
};
</script>
<style>
#transcription-panel {
  max-height: 75px;
  overflow-y: auto;
}
</style>
