<template>
  <div :class="{ 'text-warning': isActive }"  class="cursor-pointer" @click.stop="clickSeek">
    <div v-html="cue.text"></div>
  </div>
</template>

<script>
export default {
  props: {
    cue: VTTCue
  },
  data() {
    return {
      isActive: false
    };
  },
  methods: {
    clickSeek() {
      const time = this.cue.startTime;
      this.$emit('seek', time);
    }
  },
  created() {
    this.cue.onenter = () => (this.isActive = true);
    this.cue.onexit = () => (this.isActive = false);
  },
  watch: {
    isActive(newVal) {
      if (newVal) {
        this.$el.scrollIntoView({behavior: 'smooth'});
      }
    }
  }
};
</script>
