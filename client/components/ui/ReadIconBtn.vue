<template>
  <button :aria-label="isRead ? $strings.MessageMarkAsNotFinished : $strings.MessageMarkAsFinished" class="icon-btn rounded-md flex items-center justify-center h-9 w-9 relative" :class="borderless ? '' : 'bg-primary border border-gray-600'" @click="clickBtn">
    <div class="w-5 h-5 relative">
      <span v-if="isRead" class="material-symbols fill text-xl text-success">beenhere</span>
      <span v-else class="material-symbols text-xl text-white">beenhere</span>
    </div>
  </button>
</template>

<script>
export default {
  props: {
    isRead: Boolean,
    disabled: Boolean,
    borderless: Boolean
  },
  data() {
    return {}
  },
  computed: {},
  methods: {
    clickBtn(e) {
      e.stopPropagation()
      if (this.disabled) {
        e.preventDefault()
        return
      }
      this.$emit('click')
    }
  },
  mounted() {}
}
</script>

<style>
button.icon-btn::before {
  content: '';
  position: absolute;
  border-radius: 6px;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0);
  transition: all 0.1s ease-in-out;
}
button.icon-btn:hover:not(:disabled)::before {
  background-color: rgba(255, 255, 255, 0.1);
}
button.icon-btn:disabled::before {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>
