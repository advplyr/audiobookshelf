<template>
  <button :aria-label="isRead ? $strings.MessageMarkAsNotFinished : $strings.MessageMarkAsFinished" class="icon-btn rounded-md flex items-center justify-center h-9 w-9 relative" :class="borderless ? '' : 'bg-primary border border-gray-600'" @click="clickBtn">
    <div class="w-5 h-5 text-white relative">
      <svg v-if="isRead" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgb(63, 181, 68)">
        <path d="M19 1H5c-1.1 0-1.99.9-1.99 2L3 15.93c0 .69.35 1.3.88 1.66L12 23l8.11-5.41c.53-.36.88-.97.88-1.66L21 3c0-1.1-.9-2-2-2zm-9 15l-5-5 1.41-1.41L10 13.17l7.59-7.59L19 7l-9 9z" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 1H5c-1.1 0-1.99.9-1.99 2L3 15.93c0 .69.35 1.3.88 1.66L12 23l8.11-5.41c.53-.36.88-.97.88-1.66L21 3c0-1.1-.9-2-2-2zm-7 19.6l-7-4.66V3h14v12.93l-7 4.67zm-2.01-7.42l-2.58-2.59L6 12l4 4 8-8-1.42-1.42z" />
      </svg>
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
