<template>
  <div :class="{ 'text-warning': isActive }">
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
